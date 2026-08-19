// Tests for the model catalog and the machine reading.
//
// The behavior that matters is the consent boundary and the fit banding.
// Everything else in the catalog is prose.

const test = require('node:test');
const assert = require('node:assert');
const catalog = require('../src/main/models/catalog');

test('every model states both strengths and weaknesses', function () {
  catalog.MODELS.forEach(function (model) {
    assert.ok(model.strengths && model.strengths.length > 40, model.id + ' has no strengths');
    // A catalog that only lists strengths is advertising. Each entry has to
    // say where the model struggles at this particular job.
    assert.ok(model.weaknesses && model.weaknesses.length > 40, model.id + ' states no weakness');
  });
});

test('both roles are represented', function () {
  const roles = new Set(catalog.MODELS.map(function (m) { return m.role; }));
  assert.ok(roles.has('generation'));
  assert.ok(roles.has('embedding'));
});

test('fit is banded and not a yes or no', function () {
  const model = { memoryGb: 8 };
  // Comfortable means it runs with room for the rest of the machine.
  assert.strictEqual(catalog.fitFor(model, { memoryGb: 16 }).band, 'comfortable');
  // Tight is a real state: it runs and makes the machine unpleasant.
  assert.strictEqual(catalog.fitFor(model, { memoryGb: 8 }).band, 'tight');
  assert.strictEqual(catalog.fitFor(model, { memoryGb: 4 }).band, 'insufficient');
});

test('with no machine reading the fit is unknown, not assumed', function () {
  const band = catalog.fitFor({ memoryGb: 8 }, null).band;
  assert.strictEqual(band, 'unknown');
});

test('the suggestion is the largest comfortable model, not the largest that fits', function () {
  const suggestion = catalog.suggestFor({ memoryGb: 16 });
  assert.ok(suggestion.generation);
  // A 14B needs 16 and would be tight; the suggestion should stay below that.
  assert.ok(suggestion.generation.memoryGb + 2 <= 16);
  assert.ok(suggestion.embedding);
});

test('a small machine still gets a usable suggestion', function () {
  const suggestion = catalog.suggestFor({ memoryGb: 8 });
  assert.ok(suggestion.generation, 'an eight gigabyte machine should have something to run');
  assert.ok(suggestion.generation.memoryGb <= 6);
});

test('annotation without consent leaves every model unknown', function () {
  const annotated = catalog.annotate(null);
  assert.ok(annotated.every(function (m) { return m.fit.band === 'unknown'; }));
  // Refusing consent costs the fit guidance and nothing else: the catalog
  // and all its prose are still there.
  assert.strictEqual(annotated.length, catalog.MODELS.length);
});

test('every model carries the text the download notice needs', function () {
  catalog.MODELS.forEach(function (model) {
    const notice = catalog.noticeFor(model);
    ['label', 'what', 'source', 'size', 'memory', 'standing'].forEach(function (field) {
      assert.ok(notice[field], model.id + ' notice has no ' + field);
    });
    // The size and memory figures have to come from the entry, not be
    // written by hand, or they drift from the ones on the card beside them.
    assert.ok(notice.size.indexOf(String(model.diskGb)) !== -1);
    assert.ok(notice.memory.indexOf(String(model.memoryGb)) !== -1);
  });
});

test('the notice says the model is not this application`s work', function () {
  // Standing behind third-party weights would be a claim nobody can support.
  const notice = catalog.noticeFor(catalog.MODELS[0]);
  assert.match(notice.standing, /not written or maintained by this application/);
});

// ---- Adoption ------------------------------------------------------------
//
// A downloaded model is written into settings by the pull handler, and the
// field it goes into is decided here. Getting that mapping wrong puts an
// embedding model in the writing slot, which fails at the fourth step of a run
// and not at the moment of the mistake, so it is worth a test.

test('a model identifier resolves to the settings field it belongs in', function () {
  assert.strictEqual(catalog.settingKeyFor('qwen2.5:14b-instruct'), 'model');
  assert.strictEqual(catalog.settingKeyFor('nomic-embed-text'), 'embeddingModel');
});

test('a model outside the catalog is placed by its name', function () {
  // Unknown writing models are the common case and land in the writing slot.
  assert.strictEqual(catalog.settingKeyFor('some-new-model:9b'), 'model');
  // Every published embedding family names the job in the model name, and a
  // writing model called embed would be a first.
  assert.strictEqual(catalog.settingKeyFor('mxbai-embed-large'), 'embeddingModel');
});

test('a tag is matched against the family it belongs to', function () {
  // The catalog carries one tag per family and a person can install another, so
  // the role lookup works on the base name.
  assert.strictEqual(catalog.roleOf('qwen2.5:32b-instruct'), 'generation');
});

test('installed matching distinguishes a bare name from a tagged one', function () {
  const held = ['qwen2.5:14b-instruct', 'nomic-embed-text:latest'];
  // A bare name matches any tag of the same family.
  assert.strictEqual(catalog.isInstalled('nomic-embed-text', held), true);
  // A tagged name has to match exactly, so two tags stay distinguishable.
  assert.strictEqual(catalog.isInstalled('qwen2.5:14b-instruct', held), true);
  assert.strictEqual(catalog.isInstalled('qwen2.5:7b-instruct', held), false);
});

test('nothing is installed when nothing is held', function () {
  // The empty case is reached whenever Ollama is not answering, which is an
  // ordinary state on the setup screen, not a fault.
  assert.strictEqual(catalog.isInstalled('qwen2.5:14b-instruct', []), false);
  assert.strictEqual(catalog.isInstalled('qwen2.5:14b-instruct', undefined), false);
});
