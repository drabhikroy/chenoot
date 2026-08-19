// The audit trail. This is the artifact the project exists to produce, so it is
// defined before the steps that write to it never accumulated as an
// afterthought once the pipeline works.
//
// Three properties are load bearing.
//
// It is append-only. Nothing that has been recorded is ever edited or removed,
// including entries that a later step supersedes. A trail that can be revised
// after the fact documents a conclusion, not a process.
//
// It records raw step input and output, not the summary shown on screen. The
// interface deliberately hides raw model output to keep cognitive load down
// while the pipeline runs, and the trail is where that hidden material goes.
// Anything omitted from both is simply lost.
//
// Every decision carries provenance. A reader needs to know whether a flag came
// from a measurement, from a model judgment, or from something the model
// recalled but nobody checked, because those three warrant very different levels
// of trust and they are indistinguishable once written as plain sentences.

// Provenance values, in descending order of how much weight a reader should
// place on them.
//
// MEASURED covers anything computed from the text itself, such as a reading
// grade or a cosine similarity. It is reproducible.
//
// JUDGED covers a model assessment against a stated criterion, such as whether
// an item leads the respondent. It is not reproducible but it is grounded in
// text the model was shown.
//
// RECALLED covers anything the model produced from its own memory with no
// source available to check, which in practice means the Step 2 reference
// scales when the run is offline. Names, authors, and years in this category
// are frequently fabricated. They are recorded because the trail records
// everything, and they are marked because presenting them beside measured
// findings without a marker would be the single most misleading thing this
// application could do.
const PROVENANCE = {
  MEASURED: 'measured',
  JUDGED: 'judged',
  RECALLED: 'recalled-unverified',
  USER: 'user-supplied'
};

const TRAIL_VERSION = 1;

class AuditTrail {
  constructor(runInput, settings) {
    this.version = TRAIL_VERSION;
    this.runId = 'run-' + Date.now().toString(36);
    this.startedAt = new Date().toISOString();
    this.completedAt = null;
    this.input = runInput;
    // Backend and model are recorded because the same input on a different
    // model produces a different instrument, and a trail that omits which model
    // ran cannot be reasoned about later.
    this.settings = {
      backend: settings.backend,
      model: settings.model,
      embeddingModel: settings.embeddingModel
    };
    this.steps = [];
    // Per-item history, keyed by item id. Step 5 writes a row here for every
    // revision attempt, so a dropped item can be traced back through all three
    // of its failures instead of appearing only as a count.
    this.itemHistory = new Map();
  }

  beginStep(number, name) {
    const entry = {
      number,
      name,
      status: 'running',
      startedAt: new Date().toISOString(),
      durationMs: null,
      input: null,
      output: null,
      summary: null,
      decisions: []
    };
    this.steps.push(entry);
    return entry;
  }

  completeStep(entry, { input, output, summary, durationMs }) {
    entry.status = 'complete';
    entry.input = input;
    entry.output = output;
    entry.summary = summary;
    entry.durationMs = durationMs;
    return entry;
  }

  failStep(entry, error, durationMs) {
    entry.status = 'error';
    entry.durationMs = durationMs;
    entry.summary = 'Step failed: ' + error.message;
    // The stack is kept out of the trail. It describes this application rather
    // than the instrument, and the trail is a document about the instrument.
    entry.error = { message: error.message, name: error.name };
    return entry;
  }

  // Record a single decision against a step. Provenance is required rather
  // than defaulted, so that adding a new decision type forces the author to
  // state how much it can be trusted.
  recordDecision(entry, { code, description, evidence, provenance }) {
    if (!Object.values(PROVENANCE).includes(provenance)) {
      throw new Error('Decision "' + code + '" has no valid provenance.');
    }
    entry.decisions.push({
      code,
      description,
      evidence: evidence === undefined ? null : evidence,
      provenance,
      at: new Date().toISOString()
    });
  }

  recordItemEvent(itemId, event) {
    if (!this.itemHistory.has(itemId)) {
      this.itemHistory.set(itemId, []);
    }
    this.itemHistory.get(itemId).push(
      Object.assign({ at: new Date().toISOString() }, event)
    );
  }

  finish() {
    this.completedAt = new Date().toISOString();
    return this;
  }

  // Serialize for export. The Map is converted here and not being stored as
  // a plain object, because keyed insertion order matters for reading the item
  // history in the order events actually occurred.
  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      input: this.input,
      settings: this.settings,
      steps: this.steps,
      itemHistory: Object.fromEntries(this.itemHistory)
    };
  }

  // Counts used by the results screen to label the trail panel before a reader
  // opens it, so the panel can say how much is inside without being expanded.
  counts() {
    const decisions = this.steps.reduce(function (total, step) {
      return total + step.decisions.length;
    }, 0);
    const unverified = this.steps.reduce(function (total, step) {
      return total + step.decisions.filter(function (d) {
        return d.provenance === PROVENANCE.RECALLED;
      }).length;
    }, 0);
    return {
      steps: this.steps.length,
      decisions,
      unverified,
      itemsTracked: this.itemHistory.size
    };
  }
}

module.exports = { AuditTrail, PROVENANCE, TRAIL_VERSION };
