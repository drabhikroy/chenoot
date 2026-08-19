// Tests for Steps 5 and 6.

const test = require('node:test');
const assert = require('node:assert');

const step6 = require('../src/main/pipeline/step6-revision');
const step7 = require('../src/main/pipeline/step7-coverage');
const { AuditTrail } = require('../src/main/pipeline/audit');

const SETTINGS = { backend: 'ollama', model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' };
const DIMENSION = { name: 'Vigor', definition: 'Energy brought to the work.', targetItemCount: 2 };

function fresh(number, name) {
  const trail = new AuditTrail({}, SETTINGS);
  return { trail, entry: trail.beginStep(number, name) };
}

// A backend whose rewrite behavior is scripted per call, so a test can decide
// whether an item converges, stalls, or is refused.
function scriptedBackend(rewriteFor, judgments) {
  const backend = {
    calls: 0,
    complete: async function (prompt) {
      backend.calls += 1;
      if (prompt.indexOf('Items to rewrite') !== -1) {
        return { revisions: rewriteFor(backend.calls) };
      }
      return { judgments: judgments || [] };
    },
    withModel: function () { return backend; }
  };
  return backend;
}

function failingItem(id) {
  return {
    id,
    dimension: 'Vigor',
    direction: 'positive',
    text: 'I am always energetic and I never lose focus during my long shifts.'
  };
}

function baseResults(items, assessments) {
  return {
    scoping: { construct: 'Work engagement', dimensions: [DIMENSION] },
    generation: { items },
    critique: { assessments, balance: [] }
  };
}

test('an item that converges is revised and cleared', async function () {
  const { trail, entry } = fresh(6, 'revision');
  const items = [failingItem('vigor-01')];
  const assessments = [{
    itemId: 'vigor-01',
    dimension: 'Vigor',
    pass: false,
    flags: [{ code: 'absolute_term', message: 'absolute', source: 'deterministic' }],
    suggestedRewrite: null
  }];
  const backend = scriptedBackend(function () {
    return [{ item_id: 'vigor-01', text: 'I feel strong at work.' }];
  });

  const output = await step6.run({
    input: {}, results: baseResults(items, assessments), backend, trail, entry
  });

  assert.strictEqual(output.dropped.length, 0);
  assert.strictEqual(output.items[0].text, 'I feel strong at work.');
  assert.strictEqual(output.recoveredCount, 1);
});

test('an item that never converges is dropped at the cap', async function () {
  const { trail, entry } = fresh(6, 'revision');
  const items = [failingItem('vigor-01')];
  const assessments = [{
    itemId: 'vigor-01',
    dimension: 'Vigor',
    pass: false,
    flags: [{ code: 'absolute_term', message: 'absolute', source: 'deterministic' }],
    suggestedRewrite: null
  }];
  // Every rewrite is a different sentence that still fails the measured rubric.
  const backend = scriptedBackend(function (call) {
    return [{ item_id: 'vigor-01', text: 'I am always fully energetic and I never once slow down, attempt ' + call + '.' }];
  });

  const output = await step6.run({
    input: {}, results: baseResults(items, assessments), backend, trail, entry
  });

  assert.strictEqual(output.items.length, 0);
  assert.strictEqual(output.dropped.length, 1);
  assert.ok(output.dropped[0].reasons.includes('absolute_term'));
  const history = trail.toJSON().itemHistory['vigor-01'];
  assert.strictEqual(history.filter(function (e) { return e.event === 'revised'; }).length, step6.MAXIMUM_ITERATIONS);
  assert.ok(history.some(function (e) { return e.event === 'dropped'; }));
});

test('a failed rewrite call leaves items intact and not ending the run', async function () {
  const { trail, entry } = fresh(6, 'revision');
  const items = [failingItem('vigor-01')];
  const assessments = [{
    itemId: 'vigor-01', dimension: 'Vigor', pass: false,
    flags: [{ code: 'absolute_term', message: 'absolute', source: 'deterministic' }],
    suggestedRewrite: null
  }];
  const backend = {
    complete: async function () { throw new Error('offline'); },
    withModel: function () { return this; }
  };

  const output = await step6.run({
    input: {}, results: baseResults(items, assessments), backend, trail, entry
  });

  assert.strictEqual(output.items.length, 1);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'revision_call_failed'; }));
});

test('cosine and median helpers behave', function () {
  assert.strictEqual(step7.cosine([1, 0], [1, 0]), 1);
  assert.strictEqual(step7.cosine([1, 0], [0, 1]), 0);
  assert.strictEqual(step7.median([3, 1, 2]), 2);
  assert.strictEqual(step7.median([4, 1, 2, 3]), 2.5);
  assert.strictEqual(step7.medianAbsoluteDeviation([1, 2, 3], 2), 1);
});

// Vectors are hand-built so similarity is exact, not model-dependent.
function vectorFor(id) {
  const map = {
    'v-01': [1, 0, 0],
    'v-02': [0.999, 0.045, 0],
    'v-03': [0.6, 0.8, 0],
    'v-04': [0, 1, 0],
    'v-05': [0, 0, 1]
  };
  return map[id];
}

function embeddingBackend() {
  const texts = new Map();
  return {
    register: function (id, text) { texts.set(text, id); },
    embed: async function (text) { return vectorFor(texts.get(text)); }
  };
}

function coverageResults(ids, targetItemCount) {
  const items = ids.map(function (id) {
    return { id, dimension: 'Vigor', direction: 'positive', text: 'text for ' + id };
  });
  return {
    scoping: {
      construct: 'X',
      dimensions: [{ name: 'Vigor', definition: 'd', targetItemCount }]
    },
    revision: {
      items,
      assessments: items.map(function (i) {
        return { itemId: i.id, dimension: 'Vigor', pass: true, flags: [] };
      })
    }
  };
}

test('a near-duplicate pair is reduced to one item', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  // Target is set to exactly what deduplication will leave, so this case
  // exercises duplicate removal on its own without the selection pass below
  // also firing.
  const results = coverageResults(['v-01', 'v-02', 'v-03', 'v-04', 'v-05'], 4);
  const backend = embeddingBackend();
  results.revision.items.forEach(function (i) { backend.register(i.id, i.text); });

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.removedDuplicates.length, 1);
  assert.strictEqual(output.finalItems.length, 4);
  assert.ok(output.removedDuplicates[0].similarity > step7.ABSOLUTE_FLOOR);
});

test('a surplus dimension is narrowed to its target count', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  const results = coverageResults(['v-01', 'v-03', 'v-04', 'v-05'], 2);
  const backend = embeddingBackend();
  results.revision.items.forEach(function (i) { backend.register(i.id, i.text); });

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.finalItems.length, 2);
  assert.strictEqual(output.trimmed.length, 2);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'narrowed_to_target'; }));
});

test('narrowing keeps a reverse keyed item instead of ranking it away', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  const results = coverageResults(['v-01', 'v-03', 'v-04', 'v-05'], 2);
  // The one reverse item carries a flag, so ranking on quality alone would drop
  // it. Direction-aware selection has to keep it anyway.
  results.revision.items[3].direction = 'reverse';
  results.revision.assessments[3] = {
    itemId: 'v-05',
    dimension: 'Vigor',
    pass: false,
    flags: [{ code: 'item_length', message: 'long', source: 'deterministic' }]
  };
  const backend = embeddingBackend();
  results.revision.items.forEach(function (i) { backend.register(i.id, i.text); });

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.finalItems.length, 2);
  assert.ok(output.finalItems.some(function (i) { return i.direction === 'reverse'; }));
});

test('a dimension at or below target is left alone', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  const results = coverageResults(['v-01', 'v-03'], 2);
  const backend = embeddingBackend();
  results.revision.items.forEach(function (i) { backend.register(i.id, i.text); });

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.finalItems.length, 2);
  assert.strictEqual(output.trimmed.length, 0);
});

test('coverage is restored when deduplication would take a dimension under target', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  const results = coverageResults(['v-01', 'v-02'], 2);
  const backend = embeddingBackend();
  results.revision.items.forEach(function (i) { backend.register(i.id, i.text); });

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.finalItems.length, 2);
  assert.strictEqual(output.removedDuplicates.length, 0);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'duplicate_restored'; }));
});

test('the similarity distribution is written to the trail', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  const results = coverageResults(['v-01', 'v-02', 'v-03', 'v-04', 'v-05'], 2);
  const backend = embeddingBackend();
  results.revision.items.forEach(function (i) { backend.register(i.id, i.text); });

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.distributions.length, 1);
  assert.strictEqual(output.distributions[0].rule, 'adaptive');
  assert.ok(entry.decisions.some(function (d) { return d.code === 'similarity_distribution'; }));
});

test('losing embeddings skips redundancy without losing the pipeline', async function () {
  const { trail, entry } = fresh(7, 'coverage');
  const results = coverageResults(['v-01', 'v-02', 'v-03'], 2);
  const backend = { embed: async function () { throw new Error('model not pulled'); } };

  const output = await step7.run({ results, backend, trail, entry });

  assert.strictEqual(output.finalItems.length, 3);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'embeddings_unavailable'; }));
});
