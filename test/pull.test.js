// Tests for the model pull progress reporting.
//
// What is tested is the mapping from Ollama's raw status objects into
// something the settings screen can render, since that is where the reasoning
// lives. The streaming read itself is exercised by running the application.

const test = require('node:test');
const assert = require('node:assert');
const { describePull } = require('../src/main/backends/ollama');

test('a download reports a fraction', function () {
  const result = describePull({
    status: 'pulling 8eeb52dfb3bb', digest: 'sha256:8eeb', total: 1000, completed: 250
  });
  assert.strictEqual(result.phase, 'downloading');
  assert.strictEqual(result.fraction, 0.25);
  assert.strictEqual(result.done, false);
});

test('a phase without a size reports no fraction, not zero', function () {
  // Reporting zero would make the bar jump back to empty between layers, which
  // reads as the download restarting.
  const result = describePull({ status: 'pulling manifest' });
  assert.strictEqual(result.fraction, null);
  assert.strictEqual(result.phase, 'pulling manifest');
});

test('verification phases pass through as themselves', function () {
  assert.strictEqual(describePull({ status: 'verifying sha256 digest' }).fraction, null);
  assert.strictEqual(describePull({ status: 'writing manifest' }).phase, 'writing manifest');
});

test('completion is reported', function () {
  assert.strictEqual(describePull({ status: 'success' }).done, true);
});

test('a fraction cannot exceed one', function () {
  // Ollama occasionally reports completed above total on the final chunk.
  const result = describePull({ status: 'pulling abc', total: 100, completed: 140 });
  assert.strictEqual(result.fraction, 1);
});

// ---- Status shape --------------------------------------------------------
//
// Three callers read the installed list off a status answer: the settings
// screen builds its model chooser from it, the catalog decides which cards
// still offer a download, and the pull handler confirms that what it fetched
// actually landed. A branch that omits the field turns all three into a crash
// on the path where nothing is running, which is the path a first launch takes.

const { OllamaBackend } = require('../src/main/backends/ollama');

// The fetch used by status is replaced for the duration of one call and not
// stubbed globally, so a failure here cannot leak into another test file.
function withFetch(answer, work) {
  const original = global.fetch;
  global.fetch = answer;
  return work().finally(function () { global.fetch = original; });
}

test('status reports what is installed when the model is present', function () {
  const backend = new OllamaBackend({ model: 'qwen2.5:14b-instruct', embeddingModel: 'nomic-embed-text' });
  return withFetch(function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          models: [{ name: 'qwen2.5:14b-instruct' }, { name: 'nomic-embed-text:latest' }]
        });
      }
    });
  }, async function () {
    const status = await backend.status();
    assert.strictEqual(status.ready, true);
    assert.deepStrictEqual(status.installed, ['qwen2.5:14b-instruct', 'nomic-embed-text:latest']);
  });
});

test('status reports what is installed even when the chosen model is missing', function () {
  // The case that matters most. Someone whose settings name a model they never
  // downloaded needs the list of what they do have, which is exactly the state
  // where the field used to be absent.
  const backend = new OllamaBackend({ model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' });
  return withFetch(function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({ models: [{ name: 'qwen2.5:14b-instruct' }] });
      }
    });
  }, async function () {
    const status = await backend.status();
    assert.strictEqual(status.ready, false);
    assert.strictEqual(status.state, 'model-missing');
    assert.deepStrictEqual(status.installed, ['qwen2.5:14b-instruct']);
  });
});

test('an unreachable backend reports an empty installed list, not none', function () {
  const backend = new OllamaBackend({});
  return withFetch(function () {
    return Promise.reject(new Error('connection refused'));
  }, async function () {
    const status = await backend.status();
    assert.strictEqual(status.state, 'unreachable');
    assert.deepStrictEqual(status.installed, []);
  });
});

// ---- Failure differentiation ---------------------------------------------
//
// Four different things can go wrong at the address, and each has a different
// remedy: start the program, correct the address, wait, or restart it. They all
// produced one sentence telling the person to install Ollama, which is the
// wrong instruction for three of the four and actively misleading for someone
// whose address simply has a typo in it.
//
// Two of these also threw rather than returning. A reply that is not Ollama,
// which is what a proxy or a different program on the same port produces, read
// the model list straight off the parsed body and crashed, surfacing a raw
// JavaScript message where an explanation belonged.

function statusWith(answer) {
  const backend = new OllamaBackend({ model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' });
  const original = global.fetch;
  global.fetch = answer;
  return backend.status().finally(function () { global.fetch = original; });
}

const refused = function () {
  return Promise.reject(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
};
const unresolved = function () {
  return Promise.reject(Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }));
};
const timedOut = function () {
  return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
};
const serverError = function () {
  return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } });
};
const notOllama = function (body) {
  return function () {
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } });
  };
};

test('a refused connection says nothing is listening', async function () {
  const status = await statusWith(refused);
  assert.strictEqual(status.state, 'unreachable');
  assert.match(status.detail, /listening/i);
});

test('an address that does not resolve is named as an address problem', async function () {
  const status = await statusWith(unresolved);
  assert.strictEqual(status.state, 'bad-address');
  // Telling someone to install software they already have is the failure this
  // replaces, so the message must not do that.
  assert.doesNotMatch(status.detail, /install/i);
});

test('a server that does not answer in time is separated from one that is absent', async function () {
  const status = await statusWith(timedOut);
  assert.strictEqual(status.state, 'timeout');
  assert.doesNotMatch(status.detail, /install/i);
});

test('a server answering with an error is reported as running but broken', async function () {
  const status = await statusWith(serverError);
  assert.strictEqual(status.state, 'faulted');
  assert.match(status.detail, /500/);
});

test('a reply that is not Ollama is reported, not thrown', async function () {
  // A null body and a models field of the wrong type both threw before, and
  // both are what something other than Ollama on the port produces.
  for (const body of [null, { models: 'nope' }, {}]) {
    const status = await statusWith(notOllama(body));
    assert.strictEqual(status.state, 'faulted', 'body ' + JSON.stringify(body));
    assert.deepStrictEqual(status.installed, []);
  }
});

test('entries without names are dropped instead of becoming undefined', async function () {
  const status = await statusWith(notOllama({ models: [{ name: 'a:1b' }, {}, null] }));
  assert.deepStrictEqual(status.installed, ['a:1b']);
});
