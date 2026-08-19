// A managed Ollama runtime.
//
// Three ways this application can reach a model, in the order it prefers them.
//
// SYSTEM. Ollama is already installed and running. Nothing to do, and this is
// the right answer for anyone who already works this way, because a second copy
// managed by an application they opened once is worse than the one they chose.
//
// MANAGED. Ollama is not installed, and, not asking someone to install
// system software before they can try anything, the standalone binary is
// downloaded into this application's own data directory and run as a child
// process. It is not registered with the operating system, it starts and stops
// with the run, and deleting it is deleting one folder.
//
// ABSENT. Neither, in which case the interface says so and offers both routes.
//
// The managed path is the one that makes this usable by someone with no
// interest in language models as such, which is most people who need a survey
// instrument. It is also the path that downloads and executes a binary, so what
// it fetches, from where, and what it does with it are stated before it runs
// and are the subject of the download notice.
//
// One honest limitation. The download URLs below are Ollama's published release
// assets, and the shape of those releases is outside this application's
// control. If a release changes its naming, the download fails with a clear
// message, not silently fetching something else, because the target is
// checked for size and executability before it is ever run.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { app } = require('electron');

const RELEASE_BASE = 'https://github.com/ollama/ollama/releases/latest/download';

// Release assets per platform. It requested names like "ollama-darwin",
// received a 404 page, and failed the size check, which is at least the
// failure behaving as designed, not a page being made executable. The names
// below were checked against the release endpoint. Linux has no asset on this
// endpoint at all. Its install path is a script hosted elsewhere, so Linux
// reports as unmanaged and points at that route and not being given a download
// that cannot resolve.
const ASSETS = {
  'darwin-arm64': {
    asset: 'ollama-darwin.tgz',
    archive: 'tgz',
    approximateBytes: 154 * 1024 * 1024
  },
  'darwin-x64': {
    asset: 'ollama-darwin.tgz',
    archive: 'tgz',
    approximateBytes: 154 * 1024 * 1024
  },
  'win32-x64': {
    asset: 'ollama-windows-amd64.zip',
    archive: 'zip',
    approximateBytes: 200 * 1024 * 1024
  }
};

// An archive smaller than this is an error page or a truncated transfer rather
// than a release. Raised from the earlier figure because these are archives of
// a hundred and fifty megabytes and upward, not a single binary.
const MINIMUM_ARCHIVE_BYTES = 20 * 1024 * 1024;

const PORT = 11434;

let child = null;

function platformKey() {
  return os.platform() + '-' + os.arch();
}

function runtimeDirectory() {
  return path.join(app.getPath('userData'), 'runtime');
}

// Where the executable ends up after extraction. The archive layout is the
// publisher's business and can change, so the binary is located by searching,
// not by assuming a path inside it.
function binaryPath() {
  if (!ASSETS[platformKey()]) {
    return null;
  }
  const name = os.platform() === 'win32' ? 'ollama.exe' : 'ollama';
  const direct = path.join(runtimeDirectory(), name);
  if (fs.existsSync(direct)) {
    return direct;
  }
  const found = findExecutable(runtimeDirectory(), name, 0);
  return found || direct;
}

// Depth-limited search for the executable inside whatever the archive unpacked
// to. Limited because a runaway walk of a user data directory is a poor way to
// discover that an archive layout changed.
function findExecutable(directory, name, depth) {
  if (depth > 4) {
    return null;
  }
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === name) {
      return full;
    }
    if (entry.isDirectory()) {
      const nested = findExecutable(full, name, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

// Whether this application can fetch and manage Ollama on the platform it is
// running on, which is a different question from whether Ollama runs here. The
// environment variable is a hook for the screen check, and it is the only one
// in the application. It changes which button appears and nothing else: an
// install attempted behind it still fails on its own missing release asset,
// with the message that path already gives.
function isSupported() {
  if (process.env.CHENOOT_FORCE_SUPPORTED === '1') {
    return true;
  }
  return Boolean(ASSETS[platformKey()]);
}

function isInstalled() {
  const target = binaryPath();
  if (!target) {
    return false;
  }
  try {
    const stat = fs.statSync(target);
    // Executables are tens of megabytes. A file below a megabyte here is a
    // stub or a partial extraction, not the program.
    return stat.isFile() && stat.size > 1024 * 1024;
  } catch (error) {
    return false;
  }
}

// Whether anything is answering on the Ollama port, whoever started it. A
// system installation and a managed one are indistinguishable from here, which
// is correct: the pipeline talks to a port, not to a process it owns.
async function isReachable(host) {
  try {
    const response = await fetch((host || 'http://localhost:' + PORT) + '/api/tags');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function status(host) {
  const reachable = await isReachable(host);
  return {
    supported: isSupported(),
    platform: platformKey(),
    managedInstalled: isInstalled(),
    managedRunning: Boolean(child) && child.exitCode === null,
    reachable,
    // Where the model weights end up, which is a different question from where
    // the program lives and the one people ask when they want the disk space
    // back.
    runtimePath: runtimeDirectory(),
    source: reachable ? (child && child.exitCode === null ? 'managed' : 'system') : 'absent'
  };
}

// Download and unpack the release, reporting progress throughout.
//
// Four phases, and each one is reported separately, because they take very
// different amounts of time and a single bar that sits at a hundred percent
// through the slowest of them is worse than no bar. Downloading is minutes.
// Verifying is instant. Extracting is tens of seconds. Starting is a few.
//
// The archive is written under a temporary name and only unpacked after the
// size check passes, so a failed transfer cannot leave something that looks
// installed.
async function install(onProgress, signal) {
  const spec = ASSETS[platformKey()];
  if (!spec) {
    throw new Error(
      'There is no Ollama release for ' + platformKey() + ' that this application can manage. ' +
      'Installing Ollama yourself will still work, and Help has the instructions.'
    );
  }

  await fsp.mkdir(runtimeDirectory(), { recursive: true });
  const archive = path.join(runtimeDirectory(), spec.asset);

  const report = function (phase, detail, completed, total) {
    if (onProgress) {
      onProgress({
        phase,
        detail,
        completed,
        total,
        fraction: total > 0 ? Math.min(1, completed / total) : null
      });
    }
  };

  report('downloading', 'Contacting the release page', 0, 0);

  const response = await fetch(RELEASE_BASE + '/' + spec.asset, { signal, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      'The release page returned HTTP ' + response.status + ' for ' + spec.asset +
      '. The published file names may have changed.'
    );
  }

  // Falls back to the known approximate size when the server sends no length,
  // so the bar still moves instead of sitting indeterminate for minutes.
  const total = Number(response.headers.get('content-length')) || spec.approximateBytes;
  let received = 0;
  const handle = await fsp.open(archive, 'w');

  try {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await handle.write(value);
      received += value.length;
      report('downloading', 'Downloading Ollama', received, total);
    }
  } finally {
    await handle.close();
  }

  report('verifying', 'Checking what arrived', 1, 1);
  const stat = await fsp.stat(archive);
  if (stat.size < MINIMUM_ARCHIVE_BYTES) {
    await fsp.unlink(archive).catch(function () { return null; });
    throw new Error(
      'What arrived was ' + Math.round(stat.size / 1024) + ' KB, far too small to be the ' +
      'release. It was discarded and not unpacked.'
    );
  }

  report('extracting', 'Unpacking', 0, 0);
  await extract(archive, spec.archive);
  await fsp.unlink(archive).catch(function () { return null; });

  const target = binaryPath();
  if (!target || !fs.existsSync(target)) {
    throw new Error('The archive unpacked but no Ollama executable was found inside it.');
  }
  if (os.platform() !== 'win32') {
    await fsp.chmod(target, 0o755);
  }

  // Unpacked, not running. The final phase belongs to whoever performs that
  // last step.
  report('unpacked', 'Unpacked', 1, 1);
  return { ok: true, path: target, bytes: stat.size };
}

// Unpacking uses the tools the operating system already ships,, not
// carrying an archive library for one operation. tar is present on macOS by
// default; Expand-Archive is part of PowerShell on Windows.
function extract(archive, kind) {
  return new Promise(function (resolve, reject) {
    const directory = runtimeDirectory();
    const command = kind === 'zip'
      ? { file: 'powershell', args: ['-NoProfile', '-Command',
          'Expand-Archive -LiteralPath "' + archive + '" -DestinationPath "' + directory + '" -Force'] }
      : { file: 'tar', args: ['-xzf', archive, '-C', directory] };

    const unpack = spawn(command.file, command.args, { stdio: 'ignore' });
    unpack.on('error', function (error) {
      reject(new Error('Unpacking failed: ' + error.message));
    });
    unpack.on('exit', function (code) {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Unpacking exited with code ' + code + '.'));
      }
    });
  });
}

// Start the managed binary. Does nothing if something is already answering,
// since a second server on the same port would fail anyway and the first one is
// as good as this one.
async function start(host, onProgress) {
  if (await isReachable(host)) {
    return { ok: true, source: 'already-running' };
  }
  if (!isInstalled()) {
    throw new Error('The managed runtime is not installed.');
  }

  child = spawn(binaryPath(), ['serve'], {
    stdio: 'ignore',
    // Detached false, so the process belongs to this application and goes when
    // it goes, not being left running by a quit.
    detached: false,
    env: Object.assign({}, process.env, { OLLAMA_HOST: '127.0.0.1:' + PORT })
  });

  child.on('exit', function () { child = null; });

  // Waiting for the port and not for a fixed delay. A cold start on a slow
  // disk takes seconds and a fast one takes almost none, and thirty seconds is
  // the outer bound, not the expectation. The earlier ten second ceiling
  // was reached often enough on spinning disks to matter.
  //
  // Every attempt is reported. A silent wait of this length is the difference
  // between an application that is working and one that appears to have hung,
  // and the two are indistinguishable to the person watching unless something
  // says which is happening.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isReachable(host)) {
      return { ok: true, source: 'managed' };
    }
    if (onProgress) {
      onProgress({
        phase: 'starting',
        detail: 'Starting Ollama',
        elapsedSeconds: Math.round(attempt * 0.25),
        completed: 0,
        total: 0,
        fraction: null
      });
    }
    await new Promise(function (resolve) { setTimeout(resolve, 250); });
  }

  throw new Error(
    'Ollama was installed and started but did not answer within thirty seconds. ' +
    'It may still come up on its own. Check again in a moment, or start Ollama yourself.'
  );
}

function stop() {
  if (child && child.exitCode === null) {
    child.kill();
    child = null;
    return true;
  }
  return false;
}

// Remove the binary and, when asked, the models alongside it. Kept separate
// because they are very different amounts of disk and someone reclaiming space
// usually wants the models instead of the program.
// Removing what was downloaded. Either part can go without the other.
//
// keepBinary exists for the case where somebody wants the disk space the models
// occupy and wants to go on using Ollama. Without it, asking for the models to
// go also took the program that reads them, which is a large download to repeat
// for no reason.
async function remove({ includeModels, keepBinary }) {
  const removed = [];
  if (!keepBinary) {
    stop();
    try {
      await fsp.rm(binaryPath(), { force: true });
      removed.push('runtime');
    } catch (error) {
      // Nothing to remove is the ordinary case and not a fault.
    }
  }
  if (includeModels) {
    try {
      await fsp.rm(path.join(os.homedir(), '.ollama', 'models'), { recursive: true, force: true });
      removed.push('models');
    } catch (error) {
      return { ok: false, removed, detail: 'The models could not be removed: ' + error.message };
    }
  }
  return { ok: true, removed };
}

// What the download notice says about the runtime itself, in the same shape the
// model notices use so the dialog does not need a second layout.
function notice() {
  return {
    label: 'Ollama',
    what: 'Ollama is the program that runs language models on your machine. This application ' +
      'talks to it and does not replace it. Downloading it here puts a single file inside this ' +
      'application\u2019s own folder, not installing anything system wide.',
    source: 'It is downloaded from the official Ollama release page on GitHub, which is where ' +
      'its developers publish it.',
    url: 'https://github.com/ollama/ollama/releases',
    size: 'about 150 MB for the program itself, with models downloaded separately',
    memory: 'Very little on its own. Memory is used by whichever model is loaded.',
    standing: 'Ollama is open source, widely used, and maintained by its own team. It is not ' +
      'written by this application, so how it behaves is their work, not ours. You can ' +
      'remove it at any time from Setup, and doing so deletes the folder it lives in.'
  };
}

module.exports = {
  status, install, start, stop, remove, notice,
  isSupported, isInstalled, isReachable, runtimeDirectory, binaryPath, platformKey, ASSETS
};
