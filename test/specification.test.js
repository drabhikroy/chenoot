// Tests for the specification gate.
//
// The distinction this step exists to make is between a gap that changes what
// should be measured and one that merely lowers quality, so most of these check
// that the right things stop the pipeline and the wrong things do not.

const test = require('node:test');
const assert = require('node:assert');

const step1 = require('../src/main/pipeline/step1-specification');
const spec = require('../src/main/pipeline/spec/specification');
const { AuditTrail } = require('../src/main/pipeline/audit');

const SETTINGS = { backend: 'ollama', model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' };

const COMPLETE = {
  purpose: 'Understand engagement among ward nursing staff.',
  researchQuestions: 'How does engagement differ across wards?',
  intendedUse: 'Internal staffing review.',
  targetPopulation: 'Hospital nurses',
  mode: 'web'
};

function fresh() {
  const trail = new AuditTrail({}, SETTINGS);
  return { trail, entry: trail.beginStep(1, 'specification') };
}

function backendReturning(response) {
  return { complete: async function () { return response; } };
}

const CLEAN = backendReturning({ gaps: [], undeclared_sensitive_topics: [] });

test('an empty field and a dash are both absent', function () {
  const found = spec.presence({ purpose: '  ', researchQuestions: '\u2014', targetPopulation: 'Nurses' });
  assert.ok(found.absent.includes('purpose'));
  assert.ok(found.absent.includes('researchQuestions'));
  assert.ok(found.present.includes('targetPopulation'));
});

test('a missing required field stops the pipeline', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({
    input: { specification: { purpose: 'Something.' } },
    backend: CLEAN, trail, entry
  });
  assert.strictEqual(output.needsClarification, true);
  assert.ok(output.missing.some(function (m) { return m.field === 'targetPopulation'; }));
});

test('absent research questions do not stop the pipeline', function () {
  // Requiring these imposed a research framing on work that does not have one.
  // They improve the result and are recorded when absent; they do not gate it.
  const found = spec.presence({ purpose: 'Stated.', targetPopulation: 'Nurses' });
  assert.strictEqual(found.missingRequired.length, 0);
  assert.ok(found.missingImproving.includes('researchQuestions'));
});

test('a missing improving field is recorded and does not stop the pipeline', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({ input: { specification: COMPLETE }, backend: CLEAN, trail, entry });
  assert.ok(!output.needsClarification);
  // Recall period was not stated, and the trail should say so and not the
  // run proceeding as though it had been.
  assert.ok(entry.decisions.some(function (d) {
    return d.code === 'specification_missing_improving' && d.evidence === 'recallPeriod';
  }));
});

test('a blocking gap found by reading stops the pipeline', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({
    input: { specification: COMPLETE },
    backend: backendReturning({
      gaps: [{
        field: 'targetPopulation',
        problem: 'The population named cannot be sampled as described.',
        blocking: true,
        question_to_ask: 'Which students are in scope?'
      }]
    }),
    trail, entry
  });
  assert.strictEqual(output.needsClarification, true);
  assert.match(output.clarificationQuestion, /scope/);
});

test('a non-blocking gap is recorded and worked around', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({
    input: { specification: COMPLETE },
    backend: backendReturning({
      gaps: [{ field: 'analysisPlan', problem: 'Not stated.', blocking: false }]
    }),
    trail, entry
  });
  assert.ok(!output.needsClarification);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'specification_gap_noted'; }));
});

test('undeclared sensitive content is surfaced', async function () {
  const { trail, entry } = fresh();
  await step1.run({
    input: { specification: COMPLETE },
    backend: backendReturning({ gaps: [], undeclared_sensitive_topics: ['workplace conduct'] }),
    trail, entry
  });
  assert.ok(entry.decisions.some(function (d) { return d.code === 'sensitive_topic_undeclared'; }));
});

test('losing the review keeps the presence check', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({
    input: { specification: COMPLETE },
    backend: { complete: async function () { throw new Error('offline'); } },
    trail, entry
  });
  assert.ok(!output.needsClarification);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'specification_review_unavailable'; }));
});

test('research questions parse one per line, with list markers stripped', function () {
  const parsed = spec.parseResearchQuestions('1. How does it vary?\n- What predicts it?\n\n');
  assert.deepStrictEqual(parsed, ['How does it vary?', 'What predicts it?']);
});

test('the model cannot promote an optional field to blocking', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({
    input: { specification: COMPLETE },
    backend: backendReturning({
      // Both are classified as improving. A per-run judgment must not override
      // a classification the person can read off the form before starting.
      gaps: [
        { field: 'respondentPopulation', problem: 'Unclear who responds.', blocking: true },
        { field: 'mode', problem: 'Mode not stated.', blocking: true }
      ]
    }),
    trail, entry
  });
  assert.ok(!output.needsClarification, 'optional fields must not stop the run');
  assert.strictEqual(
    entry.decisions.filter(function (d) { return d.code === 'gap_downgraded'; }).length,
    2
  );
});

test('a blocking gap on a required field still stops the run', async function () {
  const { trail, entry } = fresh();
  const output = await step1.run({
    input: { specification: COMPLETE },
    backend: backendReturning({
      gaps: [{ field: 'purpose', problem: 'The purpose describes a different study.', blocking: true }]
    }),
    trail, entry
  });
  assert.strictEqual(output.needsClarification, true);
});
