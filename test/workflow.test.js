// Whole-workflow tests. Run with: node --test test/
//
// These go through the same main-process handlers the renderer calls, with the
// real nine steps, the real audit trail, the real run archive, and the real
// exporters. Only Electron and the model are replaced. Some faults only show
// when the pieces run together, such as a change to a finished instrument that
// has to survive closing the run and opening it again from the archive.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadMainProcess, brief } = require('./helpers/main-process');

function itemsIn(instrument) {
  return instrument.dimensions.reduce(function (all, dimension) {
    return all.concat(dimension.items);
  }, []);
}

test('a run returns exactly the items asked for, with unique ids, and is saved', async function () {
  const main = loadMainProcess();
  try {
    for (const count of [4, 12, 20]) {
      const outcome = await main.invoke('pipeline:start', brief(count));
      assert.strictEqual(outcome.status, 'complete', String(count));
      const items = itemsIn(outcome.instrument);
      assert.strictEqual(items.length, count);
      assert.strictEqual(outcome.instrument.itemCount, count);
      const ids = items.map(function (item) { return item.id; });
      assert.strictEqual(new Set(ids).size, ids.length);
      const reverse = items.filter(function (item) { return item.direction === 'reverse'; }).length;
      assert.strictEqual(outcome.instrument.reverseKeyedCount, reverse);
    }
    const listed = (await main.invoke('runs:list')).runs;
    assert.strictEqual(listed.length, 3);
  } finally {
    main.cleanup();
  }
});

test('every export format builds from a finished run', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(12));
    for (const format of ['json', 'csv', 'txt', 'qualtrics', 'qualtrics-txt', 'redcap', 'google-forms', 'plain', 'docx']) {
      const outcome = await main.invoke('export:run', format);
      assert.ok(outcome.ok, format + ': ' + outcome.detail);
      assert.ok(fs.statSync(outcome.path).size > 0, format);
    }
  } finally {
    main.cleanup();
  }
});

test('reversing the scale order is kept when the run is reopened', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(12));
    const runId = (await main.invoke('runs:list')).runs[0].runId;
    assert.strictEqual(main.savedRun(runId).instrument.scale.order, 'positive-first');

    const flipped = await main.invoke('items:scale-order', { order: 'negative-first' });
    assert.ok(flipped.ok);
    assert.strictEqual(flipped.saveProblem, null);
    assert.strictEqual(main.savedRun(runId).instrument.scale.order, 'negative-first');

    const reopened = await main.invoke('runs:load', runId);
    assert.strictEqual(reopened.instrument.scale.order, 'negative-first');
  } finally {
    main.cleanup();
  }
});

test('a changed item format is kept when the run is reopened', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(12));
    const runId = (await main.invoke('runs:list')).runs[0].runId;
    const first = main.savedRun(runId).instrument.dimensions[0].items[0];
    const changed = await main.invoke('item:regenerate', { itemId: first.id, format: 'agreement-7' });
    assert.ok(changed.ok, changed.detail);

    const saved = main.savedRun(runId).instrument.dimensions[0].items[0];
    assert.strictEqual(saved.id, first.id);
    assert.strictEqual(saved.format, 'agreement-7');
    // The record of the change is saved with it.
    const assembly = main.savedRun(runId).trail.steps.slice(-1)[0];
    assert.ok(assembly.decisions.some(function (d) { return /^item_format_/.test(d.code); }));
  } finally {
    main.cleanup();
  }
});

test('an edit to a run reopened from the archive is saved to that same run', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(12));
    await main.invoke('pipeline:start', brief(8));
    const runs = (await main.invoke('runs:list')).runs;
    const older = runs[1].runId;
    await main.invoke('runs:load', older);
    await main.invoke('items:scale-order', { order: 'negative-first' });
    assert.strictEqual(main.savedRun(older).instrument.scale.order, 'negative-first');
    assert.strictEqual(main.savedRun(runs[0].runId).instrument.scale.order, 'positive-first');
    assert.strictEqual((await main.invoke('runs:list')).runs.length, 2);
  } finally {
    main.cleanup();
  }
});

test('a run request outside the accepted shape is refused, not reshaped', async function () {
  const main = loadMainProcess();
  try {
    const cases = [
      [null, /empty/],
      [Object.assign(brief(12), { construct: { name: 'x' } }), /construct/i],
      [Object.assign(brief(12), { construct: '   ' }), /construct/i],
      [brief(-5), /whole number/],
      [brief(2.5), /whole number/],
      [brief(3), /whole number/],
      [brief(121), /whole number/],
      [brief('12abc'), /whole number/]
    ];
    for (const [input, message] of cases) {
      const outcome = await main.invoke('pipeline:start', input);
      assert.strictEqual(outcome.status, 'invalid', JSON.stringify(input && input.itemCount));
      assert.match(outcome.message, message);
    }
    assert.strictEqual((await main.invoke('runs:list')).runs.length, 0);
    // The limits themselves are accepted.
    assert.strictEqual((await main.invoke('pipeline:start', brief(4))).status, 'complete');
  } finally {
    main.cleanup();
  }
});

test('the library lists the newest runs when there are more than it holds', async function () {
  const main = loadMainProcess();
  try {
    const directory = path.join(main.userData, 'runs');
    fs.mkdirSync(directory, { recursive: true });
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 510; i += 1) {
      const time = start + i * 3600000;
      const runId = 'run-' + time.toString(36);
      fs.writeFileSync(path.join(directory, runId + '.json'), JSON.stringify({
        runId,
        savedAt: new Date(time).toISOString(),
        status: 'complete',
        instrument: { construct: 'Run ' + i, itemCount: 4, dimensions: [{}] },
        trail: { input: {} }
      }));
    }
    const listed = (await main.invoke('runs:list')).runs;
    assert.strictEqual(listed.length, 500);
    assert.strictEqual(listed[0].construct, 'Run 509');
    assert.strictEqual(listed[499].construct, 'Run 10');

    const cleared = await main.invoke('runs:remove-all');
    assert.strictEqual(cleared.removed, 510);
    assert.strictEqual(cleared.remaining, 0);
    assert.deepStrictEqual(fs.readdirSync(directory), []);
  } finally {
    main.cleanup();
  }
});

test('changing every item to another format is kept when the run is reopened', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(8));
    const runId = (await main.invoke('runs:list')).runs[0].runId;
    const outcome = await main.invoke('items:format-all', { format: 'agreement-7' });
    assert.ok(outcome.ok, outcome.detail);
    assert.ok(outcome.changed > 0);
    const saved = itemsIn(main.savedRun(runId).instrument);
    const converted = saved.filter(function (item) { return item.format === 'agreement-7'; }).length;
    assert.strictEqual(converted, outcome.changed);
  } finally {
    main.cleanup();
  }
});

test('an edit to an open run that was deleted does not bring it back', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(8));
    const runId = (await main.invoke('runs:list')).runs[0].runId;
    await main.invoke('runs:delete', runId);
    assert.ok((await main.invoke('items:scale-order', { order: 'negative-first' })).ok);
    assert.strictEqual((await main.invoke('runs:list')).runs.length, 0);

    await main.invoke('pipeline:start', brief(8));
    await main.invoke('runs:remove-all');
    await main.invoke('items:scale-order', { order: 'negative-first' });
    assert.strictEqual((await main.invoke('runs:list')).runs.length, 0);
  } finally {
    main.cleanup();
  }
});

test('a temporary file left by an interrupted save is not listed as a run', async function () {
  const main = loadMainProcess();
  try {
    await main.invoke('pipeline:start', brief(8));
    const runId = (await main.invoke('runs:list')).runs[0].runId;
    fs.writeFileSync(path.join(main.userData, 'runs', runId + '.json.999.tmp'), '{"half":');
    const listed = (await main.invoke('runs:list')).runs;
    assert.strictEqual(listed.length, 1);
    assert.strictEqual((await main.invoke('runs:load', runId)).ok, true);
  } finally {
    main.cleanup();
  }
});

test('the main process and the form hold the same item count limits', function () {
  const read = function (file) {
    return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  };
  const limits = function (source) {
    return ['MINIMUM_ITEMS', 'MAXIMUM_ITEMS'].map(function (name) {
      const match = source.match(new RegExp('const ' + name + ' = (\\d+);'));
      return match ? Number(match[1]) : null;
    });
  };
  const main = limits(read('src/main/ipc.js'));
  const form = limits(read('src/renderer/screens/InputScreen.jsx'));
  assert.ok(main[0] !== null && main[1] !== null);
  assert.deepStrictEqual(main, form);
});
