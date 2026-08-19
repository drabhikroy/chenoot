// Persistence for finished runs.
//
// Until now a completed run existed only in the memory of the process that
// produced it, and starting a second run discarded the first. A run costs
// twenty to forty minutes of local model time, so losing one to a button press
// is the most expensive thing this application could do to someone.
//
// Every run is written as a single file under the per-user application data
// directory. Nothing is sent anywhere, and nothing is written outside that
// directory.
//
// Failed runs are kept too. A run that died at Step 5 still documents Steps 1
// through 4, and that is usually exactly what explains the failure.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DIRECTORY = 'runs';

// The listing reads every file to build an index, so a very old collection
// would make the history screen slow to open. Several hundred runs is far
// beyond what anyone will accumulate, and the cap exists so the failure is
// bounded and not because it is expected.
const LISTING_LIMIT = 500;

function runsPath() {
  return path.join(app.getPath('userData'), DIRECTORY);
}

function filePath(runId) {
  // Identifiers are generated internally and are always of the form run-<base36>
  // but this is the one place a value from the renderer could reach the file
  // system, so the shape is checked, not assumed.
  if (!/^run-[a-z0-9]+$/.test(String(runId))) {
    throw new Error('Invalid run identifier.');
  }
  return path.join(runsPath(), runId + '.json');
}

function save(record) {
  fs.mkdirSync(runsPath(), { recursive: true });
  const payload = {
    runId: record.trail.runId,
    savedAt: new Date().toISOString(),
    status: record.instrument ? 'complete' : 'incomplete',
    instrument: record.instrument,
    document: record.document,
    coverage: record.coverage || null,
    trail: record.trail
  };
  fs.writeFileSync(filePath(payload.runId), JSON.stringify(payload), 'utf8');
  return payload.runId;
}

function load(runId) {
  return JSON.parse(fs.readFileSync(filePath(runId), 'utf8'));
}

function remove(runId) {
  fs.unlinkSync(filePath(runId));
}

// Every stored run, deleted together.
//
// Removing them one at a time is fine for a mistake and no use to somebody
// clearing out a machine or handing it on. The directory itself is kept, since
// the next run expects to write into it. A file that fails to unlink is counted
// as remaining rather than aborting the rest, so one locked file does not leave
// the history half cleared with no report of what happened.
function removeAll() {
  const before = list();
  let removed = 0;
  before.forEach(function (entry) {
    try {
      remove(entry.runId);
      removed += 1;
    } catch (error) {
      // Counted by omission.
    }
  });
  return { removed, remaining: before.length - removed };
}

// Summary rows for the history screen. Only what the list displays is returned,
// because sending every full trail across the bridge to render a list of dates
// would be several megabytes for no reason.
function list() {
  let names;
  try {
    names = fs.readdirSync(runsPath()).filter(function (name) {
      return name.endsWith('.json');
    });
  } catch (error) {
    return [];
  }

  const rows = [];
  names.slice(0, LISTING_LIMIT).forEach(function (name) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(runsPath(), name), 'utf8'));
      const trail = record.trail || {};
      const input = trail.input || {};
      rows.push({
        runId: record.runId,
        savedAt: record.savedAt,
        status: record.status,
        construct: (record.instrument && record.instrument.construct) || input.construct || 'Untitled',
        population: input.population || '',
        requestedItems: input.itemCount || null,
        itemCount: record.instrument ? record.instrument.itemCount : null,
        dimensionCount: record.instrument ? record.instrument.dimensions.length : null,
        model: (trail.settings && trail.settings.model) || '',
        durationMs: totalDuration(trail)
      });
    } catch (error) {
      // A file that cannot be parsed is skipped instead of failing the whole
      // listing. One corrupt record should not hide every other run.
    }
  });

  return rows.sort(function (a, b) {
    return String(b.savedAt).localeCompare(String(a.savedAt));
  });
}

function totalDuration(trail) {
  if (!trail.steps) {
    return null;
  }
  return trail.steps.reduce(function (total, step) {
    return total + (step.durationMs || 0);
  }, 0);
}

// A runtime estimate for a requested item count. So, not modeling it, the
// estimate is measured from what this machine and this model have actually
// done before. With no history there is nothing honest to say beyond a wide
// range, and the basis is reported so the interface can say which it is
// giving. A run has a fixed cost and a per item cost, and the first estimate
// treated it as though it had only the second. Nine steps run whether the
// instrument holds four items or forty. Reading the specification, splitting
// the construct into dimensions, and choosing a response scale each cost one
// model call and do not grow with the item count. Drafting, critiquing,
// revising, and narrowing do grow with it. Multiplying a single per item
// figure by the requested count therefore overshot badly at the default of
// twenty, where it reported half an hour, and would undershoot at three. These
// two numbers are what a mid sized model on an ordinary laptop does. They are
// a starting point for a machine with no history, not a measurement, and the
// interface says so.
const FALLBACK_FIXED_SECONDS = 150;
const FALLBACK_SECONDS_PER_ITEM = 34;

// The machine the figures above assume. Anything faster is scaled down and
// anything slower is scaled up.
const REFERENCE_CORES = 8;
const REFERENCE_MODEL_GB = 8;

// How much faster or slower this machine and this model are than the reference.
//
// Cores and model size are the two things that move generation time by a factor
// rather than a few percent, and both are already known: the machine reading is
// taken during setup and the model memory comes from the catalog. Memory beyond
// what the model needs does not speed anything up, so it is not in here.
//
// Clamped hard at both ends. This is a rough correction to a rough figure, and
// a machine reporting two cores should not be told to expect four hours.
function speedFactor(context) {
  const reading = (context && context.machine) || null;
  const modelGb = (context && context.modelMemoryGb) || REFERENCE_MODEL_GB;

  let factor = 1;
  if (reading && reading.cores > 0) {
    factor *= Math.sqrt(REFERENCE_CORES / reading.cores);
  }
  factor *= modelGb / REFERENCE_MODEL_GB;

  return Math.min(2.5, Math.max(0.45, factor));
}

// The arithmetic, separated from the file reading so it can be tested without
// an Electron application object standing behind it.
function estimateFrom(rows, requestedItems, context) {
  const completed = (rows || []).filter(function (row) {
    return row.status === 'complete' && row.durationMs > 0 && row.itemCount > 0;
  });

  if (completed.length === 0) {
    const factor = speedFactor(context);
    return {
      seconds: Math.round(
        (FALLBACK_FIXED_SECONDS + requestedItems * FALLBACK_SECONDS_PER_ITEM) * factor
      ),
      basis: 'default',
      sampleSize: 0
    };
  }

  // With runs at two or more different lengths, the fixed and per item costs can
  // be separated instead of assumed. Two points define the line; more than two
  // are reduced to the shortest and longest, which is cruder than a fit and far
  // more resistant to one slow run in the middle.
  const byCount = completed.slice().sort(function (a, b) {
    return a.itemCount - b.itemCount;
  });
  const shortest = byCount[0];
  const longest = byCount[byCount.length - 1];

  if (longest.itemCount > shortest.itemCount) {
    const perItem =
      ((longest.durationMs - shortest.durationMs) / 1000) /
      (longest.itemCount - shortest.itemCount);
    const fixed = shortest.durationMs / 1000 - perItem * shortest.itemCount;
    // A negative slope or a negative intercept means the two runs disagree about
    // which way length works, which happens when a model was cold for one of
    // them. Fall through to the median rate in that case.
    if (perItem > 0 && fixed > 0) {
      return {
        seconds: Math.round(fixed + requestedItems * perItem),
        basis: 'measured',
        sampleSize: completed.length
      };
    }
  }

  // Median, not mean. One run that stalled on a cold model start should
  // not drag every future estimate upward.
  const rates = completed
    .map(function (row) { return (row.durationMs / 1000) / row.itemCount; })
    .sort(function (a, b) { return a - b; });
  const middle = Math.floor(rates.length / 2);
  const perItem = rates.length % 2 === 0
    ? (rates[middle - 1] + rates[middle]) / 2
    : rates[middle];

  return {
    seconds: Math.round(requestedItems * perItem),
    basis: 'measured',
    sampleSize: completed.length
  };
}

function estimate(requestedItems, context) {
  return estimateFrom(list(), requestedItems, context);
}

module.exports = {
  save, load, remove, removeAll, list, estimate, estimateFrom, speedFactor, runsPath,
  FALLBACK_FIXED_SECONDS, FALLBACK_SECONDS_PER_ITEM
};
