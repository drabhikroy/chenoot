// Tests for Steps 2 through 4.

const test = require('node:test');
const assert = require('node:assert');

const step3 = require('../src/main/pipeline/step3-grounding');
const step4 = require('../src/main/pipeline/step4-generation');
const step5 = require('../src/main/pipeline/step5-critique');
const { AuditTrail, PROVENANCE } = require('../src/main/pipeline/audit');

const SETTINGS = { backend: 'ollama', model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' };

const SCOPING = {
  construct: 'Work engagement',
  dimensions: [
    { name: 'Vigor', definition: 'Energy brought to the work.', targetItemCount: 4 },
    { name: 'Absorption', definition: 'Being caught up in the work.', targetItemCount: 4 }
  ],
  totalTargetItems: 8
};

function fresh(stepNumber, stepName) {
  const trail = new AuditTrail({}, SETTINGS);
  return { trail, entry: trail.beginStep(stepNumber, stepName) };
}

function backendReturning(response) {
  return {
    complete: async function () { return response; },
    withModel: function () { return backendReturning(response); }
  };
}

test('grounding is off unless explicitly requested', async function () {
  const { trail, entry } = fresh(3, 'grounding');
  const output = await step3.run({
    input: {},
    results: { scoping: SCOPING },
    backend: backendReturning({ reference_scales: [{ name: 'Invented Scale', phrasing_notes: 'x' }] }),
    trail,
    entry
  });
  assert.strictEqual(output.grounded, false);
  assert.strictEqual(output.referenceScales.length, 0);
  assert.strictEqual(entry.decisions[0].code, 'grounding_skipped');
});

test('every recalled scale is marked unverified in the trail and on the object', async function () {
  const { trail, entry } = fresh(3, 'grounding');
  const output = await step3.run({
    input: { allowModelRecall: true },
    results: { scoping: SCOPING },
    backend: backendReturning({
      reference_scales: [
        { name: 'Scale A', source: 'Someone, 2011', phrasing_notes: 'First person.' },
        { name: 'Scale B', source: '', phrasing_notes: 'Short items.' }
      ]
    }),
    trail,
    entry
  });
  assert.strictEqual(output.grounded, true);
  assert.ok(output.referenceScales.every(function (s) { return s.verified === false; }));
  assert.strictEqual(trail.counts().unverified, 2);
});

test('a failing grounding call does not stop the pipeline', async function () {
  const { trail, entry } = fresh(3, 'grounding');
  const output = await step3.run({
    input: { allowModelRecall: true },
    results: { scoping: SCOPING },
    backend: { complete: async function () { throw new Error('connection refused'); } },
    trail,
    entry
  });
  assert.strictEqual(output.grounded, false);
  assert.strictEqual(output.reason, 'failed');
  assert.strictEqual(entry.decisions[0].code, 'grounding_unavailable');
});

test('generation produces an oversized pool and stable item ids', async function () {
  const { trail, entry } = fresh(4, 'generation');
  const output = await step4.run({
    results: { scoping: SCOPING, grounding: { referenceScales: [], grounded: false } },
    backend: backendReturning({
      items: Array.from({ length: 12 }, function (_v, i) {
        return { text: 'Item number ' + i + ' about the work.', direction: i % 3 === 0 ? 'reverse' : 'positive' };
      })
    }),
    trail,
    entry
  });
  assert.strictEqual(output.items.length, 24);
  assert.ok(output.items.every(function (i) { return /^[a-z]+-\d\d$/.test(i.id); }));
  assert.strictEqual(new Set(output.items.map(function (i) { return i.id; })).size, 24);
});

test('verbatim repeats are dropped before critique', async function () {
  const { trail, entry } = fresh(4, 'generation');
  const output = await step4.run({
    results: {
      scoping: { construct: 'X', dimensions: [SCOPING.dimensions[0]] },
      grounding: { referenceScales: [], grounded: false }
    },
    backend: backendReturning({
      items: [
        { text: 'I bring energy to my work.', direction: 'positive' },
        { text: 'I bring energy to my work!', direction: 'positive' },
        { text: 'I run out of steam quickly.', direction: 'reverse' }
      ]
    }),
    trail,
    entry
  });
  assert.strictEqual(output.items.length, 2);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'verbatim_duplicates_removed'; }));
});

test('critique keeps measured flags when the model half fails', async function () {
  const { trail, entry } = fresh(5, 'critique');
  const output = await step5.run({
    input: {},
    results: {
      scoping: { construct: 'X', dimensions: [SCOPING.dimensions[0]] },
      generation: {
        items: [{
          id: 'vigor-01',
          dimension: 'Vigor',
          direction: 'positive',
          text: 'I am always energetic and I never lose focus during long shifts.'
        }]
      }
    },
    backend: { complete: async function () { throw new Error('offline'); }, withModel: function () { return this; } },
    trail,
    entry
  });
  const flagged = output.assessments[0];
  assert.strictEqual(flagged.pass, false);
  const codes = flagged.flags.map(function (f) { return f.code; });
  assert.ok(codes.includes('double_barreled'));
  assert.ok(codes.includes('absolute_term'));
  assert.ok(entry.decisions.some(function (d) { return d.code === 'judgment_unavailable'; }));
});

test('model flags and measured flags carry different provenance', async function () {
  const { trail, entry } = fresh(5, 'critique');
  await step5.run({
    input: {},
    results: {
      scoping: { construct: 'X', dimensions: [SCOPING.dimensions[0]] },
      generation: {
        items: [{ id: 'vigor-01', dimension: 'Vigor', direction: 'positive', text: 'I care about doing good work.' }]
      }
    },
    backend: backendReturning({
      judgments: [{
        item_id: 'vigor-01',
        leading: false,
        socially_desirable: true,
        desirability_note: 'Nobody reports otherwise.',
        suggested_rewrite: 'I check my work before submitting it.'
      }]
    }),
    trail,
    entry
  });
  const desirability = entry.decisions.find(function (d) { return d.code === 'social_desirability'; });
  assert.strictEqual(desirability.provenance, PROVENANCE.JUDGED);
});

test('a clean item passes with no flags recorded', async function () {
  const { trail, entry } = fresh(5, 'critique');
  const output = await step5.run({
    input: {},
    results: {
      scoping: { construct: 'X', dimensions: [SCOPING.dimensions[0]] },
      generation: {
        items: [{ id: 'vigor-01', dimension: 'Vigor', direction: 'positive', text: 'I feel strong at work.' }]
      }
    },
    backend: backendReturning({
      judgments: [{ item_id: 'vigor-01', leading: false, socially_desirable: false }]
    }),
    trail,
    entry
  });
  assert.strictEqual(output.assessments[0].pass, true);
  assert.strictEqual(entry.decisions.length, 0);
});

test('a configured critique model is recorded and used', async function () {
  const { trail, entry } = fresh(5, 'critique');
  let usedOverride = false;
  const backend = {
    complete: async function () { return { judgments: [] }; },
    withModel: function () { usedOverride = true; return backend; }
  };
  await step5.run({
    input: { critiqueModel: 'qwen2.5:7b-instruct' },
    results: {
      scoping: { construct: 'X', dimensions: [SCOPING.dimensions[0]] },
      generation: {
        items: [{ id: 'vigor-01', dimension: 'Vigor', direction: 'positive', text: 'I feel strong at work.' }]
      }
    },
    backend,
    trail,
    entry
  });
  assert.ok(usedOverride);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'independent_critic'; }));
});
