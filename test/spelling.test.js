// Tests for the American spelling check. Run with: node --test test/
//
// The check is only useful if it stays quiet on correct words that share an
// ending with a British form, so those cases are tested as carefully as the
// ones it is meant to catch.

const test = require('node:test');
const assert = require('node:assert');
const { findBritishSpellings } = require('../standards/prose');

function words(text) {
  return findBritishSpellings(text).map(function (hit) { return hit.word; });
}

test('British forms are reported with the American replacement', function () {
  const hits = findBritishSpellings('The centre of the colour wheel was randomised.');
  assert.deepStrictEqual(
    hits.map(function (h) { return h.word + '>' + h.american; }),
    ['centre>center', 'colour>color', 'randomised>randomized']
  );
});

test('identifiers are read as the words they are made of', function () {
  assert.deepStrictEqual(words('const [x, setCancelling] = useState(false);'), ['cancelling']);
  assert.deepStrictEqual(words('class CancelledError extends Error {}'), ['cancelled']);
});

test('correct words sharing an ending are left alone', function () {
  const clean = 'Four precise promises exercise your hour. We installed, controlled, ' +
    'recalled, and revised the pulling of every item, otherwise it would fall.';
  assert.deepStrictEqual(words(clean), []);
});

test('an allowlisted legacy key is not reported', function () {
  assert.deepStrictEqual(words('scale.fullyLabelled'), []);
});
