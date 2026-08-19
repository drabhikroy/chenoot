// Settings persistence.
//
// Everything is written to the per-user application data directory and nowhere
// else. No settings file is bundled with the application, and nothing here
// leaves the machine.
//
// The API key is the one field treated differently. It is encrypted with the
// operating system keychain through Electron safeStorage when that is
// available, and refused, not written in the clear when it is not. A
// key sitting readable in a JSON file is worse than a key the person has to
// enter again, and the second failure is at least visible to them.

const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const FILE_NAME = 'settings.json';

const { DEFAULTS, WRITABLE } = require('./settings-keys');

function settingsPath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function load() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    return Object.assign({}, DEFAULTS, JSON.parse(raw));
  } catch (error) {
    // A missing or unreadable file is not an error worth surfacing. Defaults
    // are a working configuration, and a first launch has no file by
    // definition.
    return Object.assign({}, DEFAULTS);
  }
}

function persist(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

function save(incoming) {
  const current = load();
  const next = Object.assign({}, current);

  WRITABLE.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      next[key] = incoming[key];
    }
  });

  if (Object.prototype.hasOwnProperty.call(incoming, 'apiKey')) {
    const key = String(incoming.apiKey || '');
    if (key.length === 0) {
      next.apiKeyEncrypted = null;
    } else if (safeStorage.isEncryptionAvailable()) {
      next.apiKeyEncrypted = safeStorage.encryptString(key).toString('base64');
    } else {
      throw new Error(
        'The system keychain is unavailable, so the API key was not saved. ' +
        'Use the local Ollama backend, or start the application on a session where the keychain is unlocked.'
      );
    }
  }

  return persist(next);
}

// Decrypted only at the moment a request is about to be made, and never
// returned to the renderer. The settings screen shows whether a key is present,
// which is all the interface needs to know.
function apiKey() {
  const stored = load().apiKeyEncrypted;
  if (!stored || !safeStorage.isEncryptionAvailable()) {
    return null;
  }
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch (error) {
    return null;
  }
}

// The shape the renderer receives. The encrypted blob is replaced by a boolean,
// so the ciphertext never crosses the bridge.
function forRenderer() {
  const settings = load();
  const view = Object.assign({}, settings);
  delete view.apiKeyEncrypted;
  view.hasApiKey = Boolean(settings.apiKeyEncrypted);
  return view;
}

// The machine reading is written separately from the writable key list,
// because it is produced by the main process, not supplied by the
// renderer and must not be settable from that side.
function saveMachine(reading) {
  const current = load();
  current.machine = reading;
  return persist(current);
}

// Back to defaults, by deleting the file rather than by writing the defaults
// into it. A key added to DEFAULTS in a later version would otherwise be missing
// from a file written by this version, and load already treats an absent file as
// the defaults.
function reset() {
  try {
    fs.unlinkSync(settingsPath());
  } catch (error) {
    // Already absent is the state this function exists to produce.
  }
  return Object.assign({}, DEFAULTS);
}

module.exports = {
  load, save, saveMachine, apiKey, forRenderer, settingsPath, reset, DEFAULTS, WRITABLE
};
