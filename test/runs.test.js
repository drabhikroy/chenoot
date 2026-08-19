// Tests for the run archive arithmetic.
//
// The store itself needs an Electron application object to resolve the user
// data directory, so only the parts that can be separated from the file system
// are exercised here. That separation is why estimateFrom takes rows rather
// than reading them.

const test = require('node:test');
const assert = require('node:assert');

// Required in isolation, not through the module, which pulls in electron.
const {
  estimateFrom, speedFactor, FALLBACK_FIXED_SECONDS, FALLBACK_SECONDS_PER_ITEM
} = (function () {
  const Module = require('node:module');
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: function () { return '/tmp'; } } };
    }
    return original(request, parent, isMain);
  };
  const loaded = require('../src/main/runs');
  Module._load = original;
  return loaded;
}());

function row(itemCount, seconds, status) {
  return {
    status: status || 'complete',
    itemCount,
    durationMs: seconds * 1000
  };
}

test('with no history the estimate falls back to a stated default', function () {
  const result = estimateFrom([], 10);
  assert.strictEqual(result.basis, 'default');
  // Fixed cost plus per item cost. The old assertion multiplied a single rate
  // by the count, which is the arithmetic that made twenty items always read
  // half an hour.
  assert.strictEqual(
    result.seconds,
    FALLBACK_FIXED_SECONDS + 10 * FALLBACK_SECONDS_PER_ITEM
  );
  assert.strictEqual(result.sampleSize, 0);
});

test('a single past run sets the rate', function () {
  const result = estimateFrom([row(12, 600)], 6);
  assert.strictEqual(result.basis, 'measured');
  // 600 seconds over 12 items is 50 per item, so 6 items is 300.
  assert.strictEqual(result.seconds, 300);
  assert.strictEqual(result.sampleSize, 1);
});

test('one very slow run does not drag the estimate', function () {
  // Four ordinary runs at 50 seconds an item and one at 500. A mean would
  // report roughly 140 an item; the median holds at 50.
  const rows = [row(10, 500), row(10, 500), row(10, 500), row(10, 500), row(10, 5000)];
  const result = estimateFrom(rows, 10);
  assert.strictEqual(result.seconds, 500);
});

test('incomplete runs are excluded from the rate', function () {
  const rows = [row(10, 500), row(10, 100000, 'incomplete')];
  assert.strictEqual(estimateFrom(rows, 10).seconds, 500);
});

test('runs with no recorded duration are excluded', function () {
  const rows = [row(10, 500), { status: 'complete', itemCount: 10, durationMs: 0 }];
  const result = estimateFrom(rows, 10);
  assert.strictEqual(result.sampleSize, 1);
  assert.strictEqual(result.seconds, 500);
});

// ---- Estimating a run ----------------------------------------------------
//
// The first version multiplied a flat rate by the item count and nothing else,
// so the default of twenty items always reported half an hour no matter what
// machine or model was behind it. Nine steps run whether the instrument holds
// four items or forty, and treating a run as purely per item overshoots at the
// top of the range and undershoots at the bottom.

test('a run has a fixed cost as well as a per item one', function () {
  const context = { machine: { cores: 8, memoryGb: 16 }, modelMemoryGb: 8 };
  const four = estimateFrom([], 4, context).seconds;
  const forty = estimateFrom([], 40, context).seconds;
  // Ten times the items is not ten times the time, because most of the
  // pipeline does not grow with the count.
  assert.ok(forty < four * 10, 'the estimate scales purely per item');
  assert.ok(forty > four, 'more items should still take longer');
});

test('a faster machine and a smaller model shorten the estimate', function () {
  const slow = estimateFrom([], 20, {
    machine: { cores: 4, memoryGb: 8 }, modelMemoryGb: 16
  }).seconds;
  const quick = estimateFrom([], 20, {
    machine: { cores: 16, memoryGb: 64 }, modelMemoryGb: 5
  }).seconds;
  assert.ok(quick < slow);
});

test('the scaling is clamped at both ends', function () {
  // A rough correction to a rough figure. A machine reporting one core should
  // not be told to expect four hours for twenty items.
  const absurd = speedFactor({ machine: { cores: 1 }, modelMemoryGb: 70 });
  const tiny = speedFactor({ machine: { cores: 128 }, modelMemoryGb: 1 });
  assert.ok(absurd <= 2.5);
  assert.ok(tiny >= 0.45);
});

test('two runs of different lengths separate the fixed cost from the rest', function () {
  // Five items in five minutes and twenty-five in twenty-one describes a fixed
  // cost of about three minutes and forty seconds an item. An estimate for
  // fifteen should land between the two measurements rather than extrapolating
  // from either rate alone.
  const rows = [
    { status: 'complete', durationMs: 300000, itemCount: 5 },
    { status: 'complete', durationMs: 1260000, itemCount: 25 }
  ];
  const middle = estimateFrom(rows, 15).seconds;
  assert.ok(middle > 300 && middle < 1260, 'got ' + middle);
  assert.strictEqual(estimateFrom(rows, 15).basis, 'measured');
});

test('runs that disagree about the effect of length fall back to the median rate', function () {
  // A cold model start can make the shorter run the slower one. That describes
  // a negative slope, which is not a fact about the pipeline.
  const rows = [
    { status: 'complete', durationMs: 900000, itemCount: 5 },
    { status: 'complete', durationMs: 600000, itemCount: 20 }
  ];
  const outcome = estimateFrom(rows, 10);
  assert.strictEqual(outcome.basis, 'measured');
  assert.ok(outcome.seconds > 0);
});
