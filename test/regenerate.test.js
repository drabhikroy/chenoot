// Tests for per-item format changes.
//
// The behavior worth pinning is the split: which changes rewrite the item and
// which only swap anchors. Getting that wrong either wastes a model call on a
// relabeling or silently leaves a stem that does not suit its new format.

const test = require('node:test');
const assert = require('node:assert');
const regenerate = require('../src/main/pipeline/regenerate');

const ITEM = {
  id: 'vigor-01',
  dimension: 'Vigor',
  direction: 'positive',
  text: 'I feel strong at work.'
};
const DIMENSION = { name: 'Vigor', definition: 'Energy brought to the work.' };

function backendReturning(response) {
  return { complete: async function () { return response; } };
}

test('the catalog and the open formats are both offered', function () {
  const formats = regenerate.availableFormats();
  assert.ok(formats.length >= 25);
  assert.ok(formats.some(function (f) { return f.id === 'agreement-7'; }));
  assert.ok(formats.some(function (f) { return f.id === 'open-text'; }));
});

test('a change of length within a family is a relabeling', function () {
  assert.strictEqual(regenerate.isRelabelOnly('agreement-5', 'agreement-7'), true);
  assert.strictEqual(regenerate.isRelabelOnly('frequency-vague-5', 'frequency-vague-7'), true);
});

test('a change of response dimension is not', function () {
  assert.strictEqual(regenerate.isRelabelOnly('agreement-5', 'frequency-vague-5'), false);
  assert.strictEqual(regenerate.isRelabelOnly('agreement-5', 'difficulty-5'), false);
  // Same family, opposite polarity, so the judgment being asked for changed.
  assert.strictEqual(regenerate.isRelabelOnly('agreement-5', 'open-text'), false);
});

test('a relabeling makes no model call and leaves the item alone', async function () {
  let called = false;
  const outcome = await regenerate.applyFormat({
    item: ITEM,
    fromFormat: 'agreement-5',
    toFormat: 'agreement-7',
    construct: 'Work engagement',
    dimension: DIMENSION,
    backend: { complete: async function () { called = true; return {}; } }
  });
  assert.strictEqual(called, false, 'a relabeling must not cost a model call');
  assert.strictEqual(outcome.regenerated, false);
  assert.strictEqual(outcome.item.text, ITEM.text);
  assert.strictEqual(outcome.item.format, 'agreement-7');
  assert.strictEqual(outcome.scaleLabels.length, 7);
});

test('a change of dimension rewrites the item', async function () {
  const outcome = await regenerate.applyFormat({
    item: ITEM,
    fromFormat: 'agreement-5',
    toFormat: 'frequency-vague-5',
    construct: 'Work engagement',
    dimension: DIMENSION,
    backend: backendReturning({ text: 'I arrive at work with energy to spare.' })
  });
  assert.strictEqual(outcome.regenerated, true);
  assert.strictEqual(outcome.item.text, 'I arrive at work with energy to spare.');
  assert.strictEqual(outcome.item.format, 'frequency-vague-5');
});

test('keying is cleared when the item stops being a scale', async function () {
  const outcome = await regenerate.applyFormat({
    item: Object.assign({}, ITEM, { direction: 'reverse' }),
    fromFormat: 'agreement-5',
    toFormat: 'open-text',
    construct: 'Work engagement',
    dimension: DIMENSION,
    backend: backendReturning({ text: 'What gives you energy at work?' })
  });
  // An open question has no direction to reverse, so carrying the field across
  // would leave a value that means nothing.
  assert.strictEqual(outcome.item.direction, null);
});

test('response options are kept for the formats that need them', async function () {
  const outcome = await regenerate.applyFormat({
    item: ITEM,
    fromFormat: 'agreement-5',
    toFormat: 'single-select',
    construct: 'Work engagement',
    dimension: DIMENSION,
    backend: backendReturning({
      text: 'Which best describes your energy at work?',
      response_options: ['Consistently high', 'Variable', 'Consistently low']
    })
  });
  assert.strictEqual(outcome.item.responseOptions.length, 3);
});

test('a rewritten scale item is still checked against the measured rubric', async function () {
  const outcome = await regenerate.applyFormat({
    item: ITEM,
    fromFormat: 'agreement-5',
    toFormat: 'difficulty-5',
    construct: 'Work engagement',
    dimension: DIMENSION,
    backend: backendReturning({
      text: 'I always find the work demanding and I never take a break during shifts.'
    })
  });
  const codes = outcome.flags.map(function (f) { return f.code; });
  assert.ok(codes.includes('absolute_term'));
  assert.ok(codes.includes('double_barreled'));
});

test('an unknown format is refused and not guessed at', async function () {
  await assert.rejects(regenerate.applyFormat({
    item: ITEM,
    fromFormat: 'agreement-5',
    toFormat: 'sliding-scale',
    construct: 'X',
    dimension: DIMENSION,
    backend: backendReturning({})
  }), /Unknown format/);
});

test('every scale format carries its own anchors', function () {
  // Without these the interface can name a format on an item and render the
  // instrument's anchors underneath it, which is what it was doing.
  const formats = regenerate.availableFormats();
  formats.filter(function (f) { return f.kind === 'scale'; }).forEach(function (format) {
    assert.ok(Array.isArray(format.labels), format.id + ' carries no anchors');
    assert.strictEqual(
      format.labels.length, format.points,
      format.id + ' reports ' + format.points + ' points and carries ' + format.labels.length
    );
  });
});

test('open formats carry no anchors, since they have none', function () {
  const formats = regenerate.availableFormats();
  formats.filter(function (f) { return f.kind === 'open'; }).forEach(function (format) {
    assert.ok(!format.labels, format.id + ' should not carry anchors');
  });
});
