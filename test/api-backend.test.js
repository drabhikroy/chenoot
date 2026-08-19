// Tests for the remote API backend.
//
// fetch is replaced for each case, so no network call is made and no key is
// needed. What is being tested is the shape of the request each provider gets
// and how failures are handled, which is where the two providers differ.

const test = require('node:test');
const assert = require('node:assert');
const { ApiBackend } = require('../src/main/backends/api');

function withFetch(handler, run) {
  const original = global.fetch;
  global.fetch = handler;
  return run().finally(function () { global.fetch = original; });
}

function ok(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: function () { return null; } },
    json: async function () { return body; }
  };
}

test('a missing key is reported before any request is made', async function () {
  const backend = new ApiBackend({ apiProvider: 'anthropic' });
  const status = await backend.status();
  assert.strictEqual(status.ready, false);
  assert.strictEqual(status.state, 'no-key');
  await assert.rejects(backend.complete('x', null), /No API key is saved/);
});

test('anthropic requests a schema as a forced tool', async function () {
  let sent = null;
  const backend = new ApiBackend({ apiProvider: 'anthropic', apiKey: 'k' });
  await withFetch(async function (_url, init) {
    sent = JSON.parse(init.body);
    return ok({ content: [{ type: 'tool_use', name: 'record', input: { value: 7 } }] });
  }, async function () {
    const result = await backend.complete('prompt', { type: 'object' });
    assert.deepStrictEqual(result, { value: 7 });
  });
  assert.strictEqual(sent.tool_choice.name, 'record');
  assert.strictEqual(sent.tools.length, 1);
});

test('openai requests a schema through response format', async function () {
  let sent = null;
  const backend = new ApiBackend({ apiProvider: 'openai', apiKey: 'k' });
  await withFetch(async function (_url, init) {
    sent = JSON.parse(init.body);
    return ok({ choices: [{ message: { content: '{"value":7}' } }] });
  }, async function () {
    const result = await backend.complete('prompt', { type: 'object' });
    assert.deepStrictEqual(result, { value: 7 });
  });
  assert.strictEqual(sent.response_format.type, 'json_schema');
});

test('a rejected key says what to do about it', async function () {
  const backend = new ApiBackend({ apiProvider: 'openai', apiKey: 'bad' });
  await withFetch(async function () {
    return {
      ok: false,
      status: 401,
      headers: { get: function () { return null; } },
      text: async function () { return 'unauthorized'; }
    };
  }, async function () {
    await assert.rejects(backend.complete('x', null), /rejected. Check it in Settings/);
  });
});

test('a rate limit is retried, not reported', async function () {
  let calls = 0;
  const backend = new ApiBackend({ apiProvider: 'openai', apiKey: 'k' });
  await withFetch(async function () {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
        // A provider supplied delay is honored, and zero keeps the test quick.
        headers: { get: function (name) { return name === 'retry-after' ? '0' : null; } },
        text: async function () { return 'slow down'; }
      };
    }
    return ok({ choices: [{ message: { content: 'fine' } }] });
  }, async function () {
    const result = await backend.complete('x', null);
    assert.strictEqual(result, 'fine');
  });
  assert.strictEqual(calls, 2);
});

test('anthropic reports that embeddings are unavailable instead of failing obscurely', async function () {
  const backend = new ApiBackend({ apiProvider: 'anthropic', apiKey: 'k' });
  await assert.rejects(backend.embed('text'), /no embeddings endpoint/);
});

test('withModel keeps the provider and key', function () {
  const backend = new ApiBackend({ apiProvider: 'openai', apiKey: 'k', model: 'a' });
  const other = backend.withModel('b');
  assert.strictEqual(other.provider, 'openai');
  assert.strictEqual(other.apiKey, 'k');
  assert.strictEqual(other.model, 'b');
});

test('a base url override redirects both endpoints', function () {
  const backend = new ApiBackend({
    apiProvider: 'openai', apiKey: 'k', apiBaseUrl: 'https://gateway.example/v1/'
  });
  assert.strictEqual(backend.endpoint('completions'), 'https://gateway.example/v1/chat/completions');
  assert.strictEqual(backend.endpoint('embeddings'), 'https://gateway.example/v1/embeddings');
});
