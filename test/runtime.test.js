// Tests for the managed runtime and the update check.
//
// The download itself is not exercised: it fetches a real release asset over
// the network, and a test that did that would be testing GitHub. What is tested
// is everything around it, which is where the decisions are.

const test = require('node:test');
const assert = require('node:assert');

// Electron is stubbed so the module can be loaded outside an application.
const runtime = (function () {
  const Module = require('node:module');
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { app: { getPath: function () { return '/tmp/chenoot-test'; } } };
    }
    return original(request, parent, isMain);
  };
  const loaded = require('../src/main/ollama-runtime');
  Module._load = original;
  return loaded;
}());

const updates = require('../src/main/updates');

test('every asset entry names a real archive and how to unpack it', function () {
  // The first version of this table guessed at names like "ollama-darwin",
  // every one of which returns a 404. These were checked against the release
  // endpoint, and all of them are archives, not bare executables, which
  // is what the guessing got wrong.
  Object.keys(runtime.ASSETS).forEach(function (key) {
    const spec = runtime.ASSETS[key];
    assert.ok(spec.asset && /\.(tgz|zip)$/.test(spec.asset), key + ' names no archive');
    assert.ok(['tgz', 'zip'].includes(spec.archive), key + ' says nothing about unpacking');
    assert.ok(spec.approximateBytes > 10 * 1024 * 1024, key + ' has an implausible size');
  });
});

test('linux is absent, not guessed at', function () {
  // Linux has no asset on this endpoint. Its install path is a script hosted
  // elsewhere, so it reports unmanaged and points there, and not being
  // offered a download that cannot resolve.
  assert.ok(!runtime.ASSETS['linux-x64']);
  assert.ok(!runtime.ASSETS['linux-arm64']);
});

test('an unsupported platform reports, not guessing an asset', function () {
  // platformKey reflects the host running the test, so the check is on the
  // relationship between the two, not on a specific value.
  const supported = runtime.isSupported();
  assert.strictEqual(supported, Boolean(runtime.ASSETS[runtime.platformKey()]));
  if (!supported) {
    assert.strictEqual(runtime.binaryPath(), null);
  }
});

test('nothing is considered installed until a real binary is present', function () {
  // The size floor is what stops a redirect page or a truncated transfer being
  // treated as a program and made executable.
  assert.strictEqual(runtime.isInstalled(), false);
});

test('version comparison handles multi-digit segments', function () {
  // The naive string comparison this replaces reported 0.1.10 as older than
  // 0.1.2, which would tell someone up to date that they were behind.
  assert.strictEqual(updates.compareVersions('0.1.10', '0.1.2'), 1);
  assert.strictEqual(updates.compareVersions('0.1.2', '0.1.10'), -1);
  assert.strictEqual(updates.compareVersions('1.0.0', '1.0.0'), 0);
  assert.strictEqual(updates.compareVersions('v2.0', '1.9.9'), 1);
});

test('a failed check is reported as an outcome and not thrown', async function () {
  // Offline is an ordinary state for an application that otherwise needs no
  // network, and it should not surface as an error.
  const result = await updates.checkRuntime('0.1.0');
  assert.ok(typeof result.ok === 'boolean');
  if (!result.ok) {
    assert.ok(result.reason && result.reason.length > 10);
  }
});

test('the update disclosure states what is sent and what returns', function () {
  assert.ok(updates.DISCLOSURE.sends.length >= 2);
  assert.ok(updates.DISCLOSURE.receives.length >= 2);
  // The claim that nothing about the person is transmitted has to be in the
  // disclosure the interface renders, not only in a comment.
  assert.ok(updates.DISCLOSURE.sends.some(function (line) {
    return /nothing about you/i.test(line);
  }));
});

test('the runtime notice names its source and disclaims authorship', function () {
  const notice = runtime.notice();
  assert.match(notice.source, /official Ollama release/);
  assert.match(notice.standing, /not written by this application/);
  assert.ok(notice.size && notice.memory);
});
