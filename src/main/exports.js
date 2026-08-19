// Export writers.
//
// Every writer takes a finished run and returns a string plus a suggested file
// name. None of them touch the file system; the caller decides where anything
// goes. That split keeps the formatting testable without a dialog and keeps
// path handling in one place.

// Fields are quoted whenever they contain a delimiter, a quote, or a line
// break, and embedded quotes are doubled. Survey items regularly contain
// commas, so this is load bearing, not defensive.
function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function csvRow(values) {
  return values.map(csvField).join(',');
}

function safeName(construct) {
  return String(construct)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'instrument';
}

// The full machine-readable record: instrument and audit trail together in one
// file. Splitting them would let one be shared without the other, and the trail
// is only meaningful attached to the instrument it explains.
function toJson({ instrument, trail }) {
  return {
    fileName: safeName(instrument.construct) + '.json',
    contents: JSON.stringify({ instrument, auditTrail: trail.toJSON() }, null, 2)
  };
}

// One row per item, in administration order and not grouped order, because
// a CSV is what someone loads into survey software and administration order is
// what they need there.
function toCsv({ instrument }) {
  const byId = new Map();
  instrument.dimensions.forEach(function (dimension) {
    dimension.items.forEach(function (item) {
      byId.set(item.id, { item, dimension });
    });
  });

  const rows = [csvRow([
    'position', 'item_id', 'dimension', 'item_text', 'keying',
    'scale_type', 'scale_points', 'anchors'
  ])];

  instrument.administrationOrder.forEach(function (id, index) {
    const record = byId.get(id);
    if (!record) {
      return;
    }
    rows.push(csvRow([
      index + 1,
      record.item.id,
      record.dimension.name,
      record.item.text,
      record.item.direction === 'reverse' ? 'reverse' : 'positive',
      instrument.scale.scaleType,
      instrument.scale.points,
      instrument.scale.scaleLabels.join(' | ')
    ]));
  });

  return {
    fileName: safeName(instrument.construct) + '-items.csv',
    // Trailing newline, because a file without one is a nuisance in every tool
    // that concatenates or diffs.
    contents: rows.join('\n') + '\n'
  };
}

// The readable audit document produced by Step 8, written as it stands.
function toText({ instrument, document }) {
  return {
    fileName: safeName(instrument.construct) + '-audit.txt',
    contents: document
  };
}

// Platform targets live in their own module and are folded in here, so the
// export handler has one place to look regardless of whether a format is a
// generic file or an import for a particular service.
const platforms = require('./exports-platforms');

const WRITERS = Object.assign({
  json: toJson,
  csv: toCsv,
  txt: toText
}, Object.keys(platforms.PLATFORMS).reduce(function (all, id) {
  all[id] = platforms.PLATFORMS[id].write;
  return all;
}, {}));

// What each platform target is, for the interface to render. Kept beside the
// writers, not duplicated in the renderer.
const PLATFORM_INFO = Object.keys(platforms.PLATFORMS).map(function (id) {
  return {
    id,
    label: platforms.PLATFORMS[id].label,
    hint: platforms.PLATFORMS[id].hint
  };
});

// PDF is produced by printing the results view, not by a writer here, so
// it has no entry in WRITERS. The layout on paper is the layout the person
// approved on screen, and no second implementation exists to drift away from
// the first. See printToPdf in ipc.js.
const PRINTED = ['pdf'];

// Word is produced asynchronously and returns a Buffer instead of a string, so
// it does not fit the synchronous string-returning shape the writers above
// share. It lives in its own module and is reached through writeBinary.
const BINARY = ['docx'];

// Nothing is planned and unimplemented any more.
const PLANNED = [];

function write(format, run) {
  const writer = WRITERS[format];
  if (!writer) {
    if (PRINTED.includes(format)) {
      throw new Error(format.toUpperCase() + ' is produced by printing, not by a writer.');
    }
    if (BINARY.includes(format)) {
      throw new Error(format.toUpperCase() + ' is binary and is produced by writeBinary.');
    }
    if (PLANNED.includes(format)) {
      throw new Error(format.toUpperCase() + ' export is not implemented yet.');
    }
    throw new Error('Unknown export format: ' + format);
  }
  return writer(run);
}

// Binary formats. Separated from write, not folded into it, because a
// caller has to know whether it is holding text or bytes before it writes a
// file, and a single function returning either would push that question onto
// every caller.
async function writeBinary(format, run) {
  if (format !== 'docx') {
    throw new Error('Unknown binary export format: ' + format);
  }
  const { toDocx } = require('./exports-docx');
  return {
    fileName: safeName(run.instrument.construct) + '.docx',
    contents: await toDocx(run)
  };
}

module.exports = {
  write, writeBinary, toJson, toCsv, toText, csvField, safeName,
  WRITERS, PLANNED, PRINTED, BINARY, PLATFORM_INFO
};
