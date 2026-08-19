// Tests for the deterministic rubric. Run with: node --test test/
//
// Each case is a real survey item shape and not a synthetic string, because
// the checks are heuristics and a heuristic is only worth what it does on
// realistic input.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  checkItem,
  checkDimensionBalance,
  readingGrade
} = require('../src/main/pipeline/rubric/deterministic');

function codes(flags) {
  return flags.map(function (f) { return f.code; });
}

test('catches a double-barreled item', function () {
  const flags = checkItem({
    text: 'My supervisor gives me clear direction and recognizes my contributions.',
    direction: 'positive'
  });
  assert.ok(codes(flags).includes('double_barreled'));
});

test('leaves a compound noun alone', function () {
  const flags = checkItem({
    text: 'I read the terms and conditions before agreeing.',
    direction: 'positive'
  });
  assert.ok(!codes(flags).includes('double_barreled'));
});

test('flags an item above the reading level target', function () {
  const flags = checkItem({
    text: 'Organizational communication modalities demonstrate considerable ' +
      'heterogeneity across departmental configurations.',
    direction: 'positive'
  });
  assert.ok(codes(flags).includes('reading_level'));
});

test('passes a plainly written item', function () {
  const flags = checkItem({
    text: 'I know what my manager expects of me.',
    direction: 'positive'
  });
  assert.deepStrictEqual(flags, []);
});

test('flags an absolute', function () {
  const flags = checkItem({
    text: 'I am always able to finish my work on time.',
    direction: 'positive'
  });
  assert.ok(codes(flags).includes('absolute_term'));
});

test('flags a negated reverse-keyed item but not a negated positive one', function () {
  const reverse = checkItem({
    text: 'I do not feel supported by my team.',
    direction: 'reverse'
  });
  const positive = checkItem({
    text: 'I do not feel supported by my team.',
    direction: 'positive'
  });
  assert.ok(codes(reverse).includes('negated_reverse_item'));
  assert.ok(!codes(positive).includes('negated_reverse_item'));
});

test('reading grade rises with word and syllable complexity', function () {
  const simple = readingGrade('I like my job.');
  const complex = readingGrade(
    'Institutional accountability mechanisms necessitate comprehensive documentation.'
  );
  assert.ok(complex > simple);
});

test('reports a dimension with too few reverse-keyed items', function () {
  const items = [
    { dimension: 'Autonomy', direction: 'positive', text: 'a' },
    { dimension: 'Autonomy', direction: 'positive', text: 'b' },
    { dimension: 'Autonomy', direction: 'positive', text: 'c' },
    { dimension: 'Autonomy', direction: 'positive', text: 'd' }
  ];
  const findings = checkDimensionBalance(items);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].code, 'reverse_keying_low');
});

test('accepts a balanced dimension', function () {
  const items = [
    { dimension: 'Autonomy', direction: 'positive', text: 'a' },
    { dimension: 'Autonomy', direction: 'positive', text: 'b' },
    { dimension: 'Autonomy', direction: 'reverse', text: 'c' },
    { dimension: 'Autonomy', direction: 'positive', text: 'd' }
  ];
  assert.deepStrictEqual(checkDimensionBalance(items), []);
});

test('ignores balance on a dimension too small to judge', function () {
  const items = [
    { dimension: 'Autonomy', direction: 'positive', text: 'a' },
    { dimension: 'Autonomy', direction: 'positive', text: 'b' }
  ];
  assert.deepStrictEqual(checkDimensionBalance(items), []);
});

test('a grade equal to the target at reported precision is not flagged', function () {
  // The comparison and the message have to agree. Testing 8.04 against 8 and
  // then printing "grade 8.0, above the target of 8" reads as a fault in the
  // application, not a finding about the item.
  const readability = require('../src/main/pipeline/rubric/readability');
  // Find text that lands just above a whole grade before rounding.
  const candidates = [
    'It is easy for me to balance my work and my school responsibilities today.',
    'I can balance the work and the school responsibilities that I have.',
    'Balancing my work and my school responsibilities is easy for me to do.'
  ];
  candidates.forEach(function (text) {
    const raw = readability.score(text, 'flesch-kincaid');
    const reported = Math.round(raw * 10) / 10;
    const flags = checkItem({ text, direction: 'positive' }, { maximumGrade: Math.ceil(reported) });
    const reading = flags.filter(function (f) { return f.code === 'reading_level'; });
    if (reported <= Math.ceil(reported)) {
      assert.strictEqual(
        reading.length, 0,
        'grade ' + reported + ' was flagged against a target of ' + Math.ceil(reported)
      );
    }
  });
});

test('a grade genuinely above the target is still flagged', function () {
  const flags = checkItem({
    text: 'Institutional accountability mechanisms necessitate comprehensive documentation procedures.',
    direction: 'positive'
  }, { maximumGrade: 8 });
  assert.ok(flags.some(function (f) { return f.code === 'reading_level'; }));
});

// ---- Bipolar midpoints name both ends ------------------------------------
//
// A respondent at the middle of a bipolar scale is neither one thing nor the
// other, and the label has to say so. A midpoint reading Neither, or Good, or
// anything that names one end only, asks people to place themselves on a point
// whose meaning they have to infer.

const scaleCatalog = require('../src/main/pipeline/scales/catalog');

test('every bipolar midpoint names both ends of its scale', function () {
  const problems = [];
  Object.keys(scaleCatalog.CATALOG).forEach(function (id) {
    const scale = scaleCatalog.CATALOG[id];
    if (scale.polarity !== 'bipolar' || !scale.labels || scale.labels.length % 2 === 0) {
      return;
    }
    const middle = scale.labels[(scale.labels.length - 1) / 2];
    // Two acceptable forms. Neither X nor Y for scales with opposed ends, and a
    // plain statement of no change for the ones measuring movement, where
    // "neither more nor less" would be worse English than "about the same".
    const namesBoth = /^Neither .+ nor .+/i.test(middle);
    const noChange = /^(about the same|stayed the same|no change|unchanged)$/i.test(middle);
    if (!namesBoth && !noChange) {
      problems.push(id + ' has midpoint "' + middle + '"');
    }
  });
  assert.deepStrictEqual(problems, []);
});

test('a balanced bipolar scale offers as many points below the middle as above', function () {
  // The quality scale ran Poor, Fair, Good, Very good, Excellent, which put four
  // of its five points at or above neutral.
  const quality = scaleCatalog.CATALOG['quality-5'];
  assert.strictEqual(quality.labels.length, 5);
  assert.match(quality.labels[2], /^Neither/);
  assert.match(quality.labels[0], /poor/i);
  assert.match(quality.labels[4], /good/i);
});

// ---- Scale presentation order --------------------------------------------
//
// Anchors are stored ascending because that is the order scoring uses. What a
// respondent sees is a separate decision, and the default puts the most
// positive anchor first, which is what most published instruments do.
//
// Presentation order is not reverse keying. A reverse-keyed item is worded
// against the construct and its score is inverted. Confusing the two silently
// inverts a score, so the two live in different fields and these tests hold
// them apart.

const scaleOrder = require('../src/main/pipeline/scales/direction');

test('the default prints the most positive anchor first', function () {
  const stored = ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'];
  const shown = scaleOrder.presentedAnchors(stored, scaleOrder.orderFor({}, {}));
  assert.strictEqual(shown[0], 'Very satisfied');
  assert.strictEqual(shown[4], 'Very dissatisfied');
});

test('the stored order is never modified', function () {
  // Scoring needs the ascending order whichever way the anchors were shown, so
  // reversing has to work on a copy.
  const stored = ['Low', 'Middle', 'High'];
  scaleOrder.presentedAnchors(stored, scaleOrder.DESCENDING);
  assert.deepStrictEqual(stored, ['Low', 'Middle', 'High']);
});

test('an item overrides the instrument, and the instrument overrides the default', function () {
  const instrument = { scale: { order: scaleOrder.ASCENDING } };
  assert.strictEqual(scaleOrder.orderFor({}, instrument), scaleOrder.ASCENDING);
  assert.strictEqual(
    scaleOrder.orderFor({ scaleOrder: scaleOrder.DESCENDING }, instrument),
    scaleOrder.DESCENDING
  );
  assert.strictEqual(scaleOrder.orderFor({}, {}), scaleOrder.DESCENDING);
});

test('the printed numbers follow the anchors so the result stays scorable', function () {
  // A descending five point scale prints 5 4 3 2 1. The anchor shown first is
  // still point five, which is what lets a completed questionnaire be scored
  // without knowing how it was laid out.
  assert.deepStrictEqual(scaleOrder.pointsFor(5, scaleOrder.DESCENDING), [5, 4, 3, 2, 1]);
  assert.deepStrictEqual(scaleOrder.pointsFor(5, scaleOrder.ASCENDING), [1, 2, 3, 4, 5]);
});

test('the renderer and the main process agree about order', function () {
  // Two copies of these rules exist because the renderer cannot require from
  // the main process. They have to answer the same way.
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'renderer', 'scale-order.js'), 'utf8'
  );
  assert.match(source, /export const DESCENDING = 'positive-first'/);
  assert.match(source, /export const ASCENDING = 'negative-first'/);
  assert.strictEqual(scaleOrder.DESCENDING, 'positive-first');
  assert.strictEqual(scaleOrder.ASCENDING, 'negative-first');
});

test('the renderer prints the scale point beside each anchor', function () {
  // The results screen printed the position in the row instead of the point on
  // the scale, so a descending five point scale numbered the most positive
  // anchor 1. It read correctly and scored backwards, which is the failure this
  // whole separation exists to prevent.
  const screen = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'renderer', 'screens', 'ResultsScreen.jsx'), 'utf8'
  );
  assert.match(screen, /scalePoints\[index\]/);
  assert.doesNotMatch(
    screen.slice(screen.indexOf('anchor-row'), screen.indexOf('anchor-row') + 700),
    /\{index \+ 1\}/
  );
});
