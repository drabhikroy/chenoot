// Tests for Step 1, the orchestrator, and the audit trail.
//
// The backend is stubbed throughout. None of this needs a model running, which
// is the point of putting the backend behind an interface.

const test = require('node:test');
const assert = require('node:assert');

const step2 = require('../src/main/pipeline/step2-scoping');
const step4 = require('../src/main/pipeline/step4-generation');
const { Orchestrator, CancelledError } = require('../src/main/pipeline/orchestrator');
const { AuditTrail, PROVENANCE } = require('../src/main/pipeline/audit');

const SETTINGS = { backend: 'ollama', model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' };

// What Step 1 hands forward, which scoping now reads instead of raw input.
const SPECIFICATION_RESULT = {
  specification: { targetPopulation: 'adults', purpose: 'stated' },
  researchQuestions: ['How does this vary by group?'],
  constraints: { mode: 'web' }
};

function stubBackend(response) {
  return { complete: async function () { return response; }, embed: async function () { return [0]; } };
}

test('quotas are reapportioned to hit the requested total exactly', function () {
  const dimensions = [
    { target_item_count: 5 },
    { target_item_count: 5 },
    { target_item_count: 5 }
  ];
  const allocated = step2.reconcileQuotas(dimensions, 20);
  assert.strictEqual(allocated.reduce(function (a, b) { return a + b; }, 0), 20);
});

test('no dimension falls below the reliability floor', function () {
  const dimensions = [
    { target_item_count: 40 },
    { target_item_count: 1 },
    { target_item_count: 1 }
  ];
  const allocated = step2.reconcileQuotas(dimensions, 15);
  allocated.forEach(function (count) {
    assert.ok(count >= step2.MINIMUM_ITEMS_PER_DIMENSION);
  });
  assert.strictEqual(allocated.reduce(function (a, b) { return a + b; }, 0), 15);
});

// ---- The requested length is a constraint --------------------------------
//
// Someone asked for five items and received nine. The rule that a dimension
// needs three items to be measurable was being enforced by multiplying the
// requested total, not by limiting the dimensions, so five dimensions
// turned five items into fifteen. Length is usually a constraint someone has
// for a reason, and an instrument that does not fit where it was meant to go is
// the wrong instrument, not a generous version of the right one.

test('the dimension ceiling follows from the requested length', function () {
  // Three items each, so five items buys one dimension and twelve buys four.
  assert.strictEqual(step2.dimensionCeiling(5), 1);
  assert.strictEqual(step2.dimensionCeiling(12), 4);
  assert.strictEqual(step2.dimensionCeiling(9), 3);
});

test('a very short instrument still gets one dimension and not none', function () {
  // Integer division reaches zero below the floor, and a zero here would leave
  // the instrument with nothing to measure.
  assert.strictEqual(step2.dimensionCeiling(2), 1);
  assert.strictEqual(step2.dimensionCeiling(0), 1);
  // A count that is missing or unparseable returned NaN, and a NaN ceiling
  // slices every dimension away without raising anything.
  assert.strictEqual(step2.dimensionCeiling(undefined), 1);
  assert.strictEqual(step2.dimensionCeiling(NaN), 1);
});

test('scoping returns the requested number of items and not more', async function () {
  const trail = new AuditTrail({ construct: 'attitudes' }, SETTINGS);
  const entry = trail.beginStep(2, 'scoping');
  const output = await step2.run({
    input: { construct: 'attitudes', population: 'faculty', purpose: 'stated', itemCount: 5 },
    results: { specification: SPECIFICATION_RESULT },
    // Five dimensions against five items, which is the shape that produced the
    // nine item instrument.
    backend: stubBackend({
      construct: 'attitudes',
      operationalizable: true,
      dimensions: [
        { name: 'One', definition: 'first', target_item_count: 3 },
        { name: 'Two', definition: 'second', target_item_count: 3 },
        { name: 'Three', definition: 'third', target_item_count: 3 },
        { name: 'Four', definition: 'fourth', target_item_count: 3 },
        { name: 'Five', definition: 'fifth', target_item_count: 3 }
      ]
    }),
    trail,
    entry
  });

  assert.strictEqual(output.totalTargetItems, 5);
  assert.strictEqual(output.dimensions.length, 1);
  const total = output.dimensions.reduce(function (sum, dimension) {
    return sum + dimension.targetItemCount;
  }, 0);
  assert.strictEqual(total, 5);
});

test('dimensions set aside by the ceiling are named in the trail', async function () {
  const trail = new AuditTrail({ construct: 'attitudes' }, SETTINGS);
  const entry = trail.beginStep(2, 'scoping');
  await step2.run({
    input: { construct: 'attitudes', population: 'faculty', purpose: 'stated', itemCount: 6 },
    results: { specification: SPECIFICATION_RESULT },
    backend: stubBackend({
      construct: 'attitudes',
      operationalizable: true,
      dimensions: [
        { name: 'Kept one', definition: 'a', target_item_count: 3 },
        { name: 'Kept two', definition: 'b', target_item_count: 3 },
        { name: 'Dropped one', definition: 'c', target_item_count: 3 }
      ]
    }),
    trail,
    entry
  });

  // Discarding without saying so would leave a reader unable to tell that the
  // construct was narrowed at all.
  const capped = entry.decisions.find(function (decision) {
    return decision.code === 'dimensions_capped';
  });
  assert.ok(capped, 'no decision recorded for the capped dimensions');
  assert.match(capped.evidence, /Dropped one/);
});

test('a construct the model cannot decompose pauses, not failing', async function () {
  const trail = new AuditTrail({ construct: 'quality' }, SETTINGS);
  const entry = trail.beginStep(1, 'scoping');
  const output = await step2.run({
    input: { construct: 'quality', population: 'adults', purpose: 'unclear', itemCount: 12 },
    results: { specification: SPECIFICATION_RESULT },
    backend: stubBackend({
      construct: 'quality',
      operationalizable: false,
      clarification_question: 'Quality of what?',
      dimensions: []
    }),
    trail,
    entry
  });
  assert.strictEqual(output.needsClarification, true);
  assert.strictEqual(entry.decisions[0].code, 'construct_not_operationalizable');
});

test('quota repair is written to the trail when the model arithmetic is wrong', async function () {
  const trail = new AuditTrail({ construct: 'burnout' }, SETTINGS);
  const entry = trail.beginStep(1, 'scoping');
  await step2.run({
    input: { construct: 'burnout', population: 'nurses', purpose: 'staffing review', itemCount: 18 },
    results: { specification: SPECIFICATION_RESULT },
    backend: stubBackend({
      construct: 'burnout',
      operationalizable: true,
      dimensions: [
        { name: 'Exhaustion', definition: 'Depleted energy.', target_item_count: 9 },
        { name: 'Detachment', definition: 'Distance from the work.', target_item_count: 9 },
        { name: 'Efficacy', definition: 'Sense of doing the job well.', target_item_count: 9 }
      ]
    }),
    trail,
    entry
  });
  const codes = entry.decisions.map(function (d) { return d.code; });
  assert.ok(codes.includes('item_quota_reconciled'));
  assert.strictEqual(entry.decisions[0].provenance, PROVENANCE.MEASURED);
});

test('a decision without valid provenance is refused', function () {
  const trail = new AuditTrail({}, SETTINGS);
  const entry = trail.beginStep(1, 'scoping');
  assert.throws(function () {
    trail.recordDecision(entry, { code: 'x', description: 'y', provenance: 'probably fine' });
  }, /provenance/);
});

test('unverified recall is counted separately from everything else', function () {
  const trail = new AuditTrail({}, SETTINGS);
  const entry = trail.beginStep(2, 'grounding');
  trail.recordDecision(entry, {
    code: 'reference_recalled',
    description: 'Named a scale from memory with no source available.',
    provenance: PROVENANCE.RECALLED
  });
  trail.recordDecision(entry, {
    code: 'reading_level',
    description: 'Measured.',
    provenance: PROVENANCE.MEASURED
  });
  assert.strictEqual(trail.counts().unverified, 1);
  assert.strictEqual(trail.counts().decisions, 2);
});

test('orchestrator emits a completion event per step in order', async function () {
  const trail = new AuditTrail({}, SETTINGS);
  const steps = [1, 2, 3].map(function (n) {
    return {
      number: n,
      name: 'step' + n,
      run: async function () { return { value: n }; },
      describe: function (output) { return 'Produced ' + output.value + '.'; }
    };
  });
  const orchestrator = new Orchestrator({ backend: stubBackend({}), steps, trail });

  const seen = [];
  orchestrator.on('step:complete', function (event) { seen.push(event.number); });

  const result = await orchestrator.run({}, null);
  assert.deepStrictEqual(seen, [1, 2, 3]);
  assert.strictEqual(result.status, 'complete');
  assert.strictEqual(trail.counts().steps, 3);
});

test('orchestrator stops between steps when the signal is aborted', async function () {
  const trail = new AuditTrail({}, SETTINGS);
  const controller = new AbortController();
  const steps = [1, 2].map(function (n) {
    return {
      number: n,
      name: 'step' + n,
      run: async function () { controller.abort(); return { value: n }; },
      describe: function () { return 'done'; }
    };
  });
  const orchestrator = new Orchestrator({ backend: stubBackend({}), steps, trail });
  await assert.rejects(orchestrator.run({}, controller.signal), CancelledError);
  assert.strictEqual(trail.counts().steps, 1);
});

test('orchestrator halts and reports when a step asks for clarification', async function () {
  const trail = new AuditTrail({}, SETTINGS);
  const steps = [
    {
      number: 1,
      name: 'scoping',
      run: async function () { return { needsClarification: true, clarificationQuestion: 'Which sense?' }; },
      describe: function () { return 'Paused.'; }
    },
    {
      number: 2,
      name: 'grounding',
      run: async function () { throw new Error('should never run'); },
      describe: function () { return 'x'; }
    }
  ];
  const orchestrator = new Orchestrator({ backend: stubBackend({}), steps, trail });
  const result = await orchestrator.run({}, null);
  assert.strictEqual(result.status, 'awaiting-clarification');
});

test('a failed step is recorded before the error propagates', async function () {
  const trail = new AuditTrail({}, SETTINGS);
  const steps = [{
    number: 1,
    name: 'scoping',
    run: async function () { throw new Error('model unreachable'); },
    describe: function () { return 'x'; }
  }];
  const orchestrator = new Orchestrator({ backend: stubBackend({}), steps, trail });
  await assert.rejects(orchestrator.run({}, null), /model unreachable/);
  assert.strictEqual(trail.steps[0].status, 'error');
  assert.match(trail.steps[0].summary, /model unreachable/);
});

// ---- An empty run is a failed run ----------------------------------------
//
// A five item request came back as an instrument record with a serial number, a
// build date, a response scale, and a paragraph explaining why that scale fits
// the construct, listing zero items. Every step after generation only removes
// items, so an empty pool stays empty and arrives at assembly looking like
// finished work. Somebody waited eight minutes for it.
//
// The usual cause is a model ignoring the response schema, which the pipeline
// cannot repair by carrying on. Failing at the step that actually broke names
// the construct and points at the model.

test('generation refuses to pass on an empty pool', async function () {
  const trail = new AuditTrail({ construct: 'attitudes' }, SETTINGS);
  const entry = trail.beginStep(4, 'generation');
  await assert.rejects(
    step4.run({
      input: { construct: 'attitudes', itemCount: 5 },
      results: {
        scoping: {
          construct: 'attitudes',
          dimensions: [{ name: 'Only', definition: 'the one', targetItemCount: 5 }]
        },
        grounding: { referenceScales: [] }
      },
      // A model answering with the right shape and nothing in it, which is what
      // schema non-compliance looks like by the time it reaches this step.
      backend: stubBackend({ items: [] }),
      trail,
      entry
    }),
    /no usable items/i
  );
});

test('generation also refuses when every item is blank', async function () {
  const trail = new AuditTrail({ construct: 'attitudes' }, SETTINGS);
  const entry = trail.beginStep(4, 'generation');
  await assert.rejects(
    step4.run({
      input: { construct: 'attitudes', itemCount: 5 },
      results: {
        scoping: {
          construct: 'attitudes',
          dimensions: [{ name: 'Only', definition: 'the one', targetItemCount: 5 }]
        },
        grounding: { referenceScales: [] }
      },
      // Empty strings are dropped during collection, so the pool empties without
      // the model having returned an empty list.
      backend: stubBackend({ items: [{ text: '   ' }, { text: '' }] }),
      trail,
      entry
    }),
    /no usable items/i
  );
});
