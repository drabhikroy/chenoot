// Tests for citation checking against the bundled reference list.
//
// The claim this makes has to stay narrow. A match means the name and source
// agree with a list of a few dozen instruments; it is not verification against
// the literature, and no test here should imply otherwise.

const test = require('node:test');
const assert = require('node:assert');
const reference = require('../src/main/pipeline/spec/reference-instruments');

test('a correct citation matches', function () {
  const result = reference.verify({
    name: 'Utrecht Work Engagement Scale',
    source: 'Schaufeli et al., 2002'
  });
  assert.strictEqual(result.status, reference.MATCHED);
});

test('an abbreviation matches its instrument', function () {
  // PHQ-9 shares no meaningful tokens with its full name, so abbreviations are
  // checked before token overlap.
  assert.strictEqual(reference.verify({ name: 'PHQ-9', source: 'Kroenke, 2001' }).status,
    reference.MATCHED);
  assert.strictEqual(reference.verify({ name: 'SUS', source: 'Brooke, 1996' }).status,
    reference.MATCHED);
});

test('a name with extra words still matches', function () {
  const result = reference.verify({
    name: 'The Rosenberg Self-Esteem Scale (revised)',
    source: 'Rosenberg, 1965'
  });
  assert.strictEqual(result.status, reference.MATCHED);
});

test('a wrong year on a real instrument is contradicted', function () {
  // The most common shape of a fabricated citation: right instrument, wrong
  // attribution, and the hardest kind to catch by reading.
  const result = reference.verify({
    name: 'Maslach Burnout Inventory',
    source: 'Maslach, 1997'
  });
  assert.strictEqual(result.status, reference.CONTRADICTED);
  assert.match(result.detail, /1981/);
});

test('a wrong author on a real instrument is contradicted', function () {
  const result = reference.verify({
    name: 'Perceived Stress Scale',
    source: 'Lazarus, 1983'
  });
  assert.strictEqual(result.status, reference.CONTRADICTED);
});

test('a nearby year is tolerated', function () {
  // Revisions and second editions are legitimately cited by their own dates.
  const result = reference.verify({
    name: 'Big Five Inventory',
    source: 'John & Srivastava, 2001'
  });
  assert.strictEqual(result.status, reference.MATCHED);
});

test('an unknown name is unmatched, not rejected', function () {
  const result = reference.verify({
    name: 'Departmental Climate Inventory',
    source: 'Someone, 2015'
  });
  assert.strictEqual(result.status, reference.UNMATCHED);
  // The wording has to make clear that this is not evidence of fabrication.
  assert.match(result.detail, /says nothing about whether the scale/);
});

test('every entry carries a name, an author, and a year', function () {
  reference.INSTRUMENTS.forEach(function (entry) {
    assert.ok(entry.name && entry.name.length > 3, 'entry has no usable name');
    assert.ok(entry.author && entry.author.length > 2, entry.name + ' has no author');
    assert.ok(entry.year > 1900 && entry.year < 2030, entry.name + ' has an implausible year');
  });
});

test('abbreviations are unique across the list', function () {
  const seen = new Set();
  reference.INSTRUMENTS.forEach(function (entry) {
    entry.abbreviations.forEach(function (abbreviation) {
      const key = abbreviation.toLowerCase();
      assert.ok(!seen.has(key), abbreviation + ' is used by more than one entry');
      seen.add(key);
    });
  });
});
