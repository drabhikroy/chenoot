// Tests for the readability measures.
//
// The behavior worth pinning is not the arithmetic, which is published and
// fixed, but the guard around sample size. A formula derived on a hundred word
// sample will happily return a number for a ten word item, and that number
// looks exactly as authoritative as a real one.

const test = require('node:test');
const assert = require('node:assert');
const readability = require('../src/main/pipeline/rubric/readability');

const SIMPLE = 'I feel strong at work.';
const HARD = 'Institutional accountability mechanisms necessitate comprehensive documentation.';

test('eight measures are available', function () {
  assert.strictEqual(Object.keys(readability.MEASURES).length, 8);
});

test('only measures valid at item length are offered per item', function () {
  const perItem = readability.itemLevelMeasures();
  assert.ok(perItem.includes('flesch-kincaid'));
  assert.ok(perItem.includes('automated-readability'));
  // SMOG needs thirty sentences and Gunning Fog is unstable on short text.
  assert.ok(!perItem.includes('smog'));
  assert.ok(!perItem.includes('gunning-fog'));
});

test('a measure refuses instead of extrapolating below its sample', function () {
  // The honest answer for SMOG on one sentence is no answer at all.
  assert.strictEqual(readability.score(SIMPLE, 'smog'), null);
  assert.ok(readability.score(SIMPLE, 'flesch-kincaid') !== null);
});

test('harder text scores higher on every grade measure', function () {
  readability.itemLevelMeasures().forEach(function (id) {
    if (readability.MEASURES[id].higherIsEasier) {
      return;
    }
    const easy = readability.score(SIMPLE, id);
    const hard = readability.score(HARD, id);
    assert.ok(hard > easy, id + ' did not rank the harder sentence higher');
  });
});

test('reading ease runs the other way', function () {
  const easy = readability.score(SIMPLE, 'flesch-reading-ease');
  const hard = readability.score(HARD, 'flesch-reading-ease');
  assert.ok(easy > hard, 'higher should mean easier on this scale');
});

test('an instrument is scored across the whole pool', function () {
  const items = Array.from({ length: 40 }, function (_v, i) {
    return 'I feel strong at work in situation number ' + i;
  });
  const result = readability.scoreInstrument(items, 'smog');
  // Forty items is a large enough sample for SMOG, where one item was not.
  assert.strictEqual(result.belowMinimum, false);
  assert.ok(result.value > 0);
});

test('an instrument below a measure sample says so, not returning a figure', function () {
  const result = readability.scoreInstrument(['I feel strong at work.'], 'smog');
  assert.strictEqual(result.belowMinimum, true);
  assert.strictEqual(result.value, null);
});

test('every measure carries prose explaining where it should not be trusted', function () {
  Object.keys(readability.MEASURES).forEach(function (id) {
    const m = readability.MEASURES[id];
    assert.ok(m.summary && m.summary.length > 40, id + ' has no usable summary');
    assert.ok(m.caution && m.caution.length > 30, id + ' states no caution');
  });
});
