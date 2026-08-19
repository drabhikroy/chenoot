// Checking whether the model list or the runtime has moved on.
//
// This is the only outbound request this application makes that is not a model
// call, so it is off by default and what it does is stated precisely.
//
// What is sent: an ordinary HTTPS GET to a public release endpoint. No account,
// no identifier, no machine details, no record of what you have built or asked
// for. The request carries what any request carries, which is that some
// computer somewhere asked for a public file. That is not nothing, and anyone
// who would rather it did not happen should leave this off, which costs only
// the notice that a newer version exists.
//
// What comes back: a version string. It is compared against what is installed
// and reported. Nothing is downloaded, installed, or changed by a check.

const RUNTIME_RELEASE = 'https://api.github.com/repos/ollama/ollama/releases/latest';

// Short, because this is a convenience and a slow network should not make the
// screen it sits on feel broken.
const TIMEOUT_MS = 8000;

function compareVersions(a, b) {
  const left = String(a).replace(/^v/, '').split('.').map(Number);
  const right = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] || 0;
    const r = right[i] || 0;
    if (l !== r) {
      return l > r ? 1 : -1;
    }
  }
  return 0;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// The latest published runtime version. Returns a result, not throwing,
// because a failed check is an ordinary outcome on a machine that is offline
// and should not be reported as an error.
async function checkRuntime(installedVersion) {
  try {
    const data = await fetchWithTimeout(RUNTIME_RELEASE);
    const latest = String(data.tag_name || '').replace(/^v/, '');
    if (!latest) {
      return { ok: false, reason: 'The release feed returned no version.' };
    }
    return {
      ok: true,
      latest,
      installed: installedVersion || null,
      newer: installedVersion ? compareVersions(latest, installedVersion) > 0 : null,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      reason: error.name === 'AbortError'
        ? 'The check timed out.'
        : 'The check could not reach the release feed. This usually means no internet connection.'
    };
  }
}

// Exactly what a check does, in the words the interface uses. Kept beside the
// code so the description and the behavior cannot drift.
const DISCLOSURE = {
  sends: [
    'A request for a public file, the same as opening a web page',
    'Nothing about you, your machine, or anything you have built'
  ],
  receives: [
    'A version number, compared against what is installed',
    'Nothing is downloaded or changed by a check'
  ]
};

module.exports = { checkRuntime, compareVersions, DISCLOSURE };
