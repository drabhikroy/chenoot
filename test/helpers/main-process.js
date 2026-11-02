// Loads the real main-process handlers for a test, with Electron replaced by a
// small fake and the model replaced by the scripted backend. Each call gets a
// fresh copy of the main-process modules and its own temporary profile folder,
// so one test cannot see state another left behind.

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const Module = require('node:module');
const { ScriptedBackend } = require('./scripted-backend');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = path.join(ROOT, 'src', 'main');

function loadMainProcess(options) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'chenoot-test-'));
  const handlers = {};
  const fakeWindow = {
    isDestroyed: function () { return false; },
    webContents: {
      send: function () {},
      printToPDF: async function () { return Buffer.from('%PDF-1.4'); }
    }
  };
  let saveCount = 0;
  const electron = {
    app: {
      getPath: function () { return userData; },
      isPackaged: false,
      getVersion: function () { return '0.0.0-test'; },
      getName: function () { return 'Chenoot'; }
    },
    ipcMain: { handle: function (name, fn) { handlers[name] = fn; }, on: function () {} },
    dialog: {
      showSaveDialog: async function () {
        saveCount += 1;
        return { canceled: false, filePath: path.join(userData, 'export-' + saveCount) };
      }
    },
    safeStorage: {
      isEncryptionAvailable: function () { return true; },
      encryptString: function (text) { return Buffer.from('sealed:' + text); },
      decryptString: function (buffer) { return String(buffer).replace(/^sealed:/, ''); }
    },
    shell: { openExternal: function () {} }
  };
  const backends = {
    createBackend: function () { return new ScriptedBackend(options && options.backend); }
  };

  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return electron;
    }
    if (request === './backends' && parent && parent.filename === path.join(MAIN, 'ipc.js')) {
      return backends;
    }
    return original(request, parent, isMain);
  };
  Object.keys(require.cache).forEach(function (key) {
    if (key.indexOf(MAIN) === 0) {
      delete require.cache[key];
    }
  });

  try {
    require(path.join(MAIN, 'ipc.js')).registerHandlers(function () { return fakeWindow; });
  } finally {
    Module._load = original;
  }

  return {
    userData,
    invoke: function (name) {
      const args = Array.prototype.slice.call(arguments, 1);
      return handlers[name].apply(null, [{ sender: {} }].concat(args));
    },
    savedRun: function (runId) {
      return JSON.parse(fs.readFileSync(path.join(userData, 'runs', runId + '.json'), 'utf8'));
    },
    cleanup: function () {
      fs.rmSync(userData, { recursive: true, force: true });
    }
  };
}

// A brief that satisfies every required field.
function brief(itemCount) {
  return {
    construct: 'Workplace autonomy',
    population: 'Registered nurses on inpatient units',
    purpose: 'A baseline before a scheduling pilot',
    itemCount,
    relatedConstructs: [],
    specification: {
      targetPopulation: 'Registered nurses on inpatient units',
      purpose: 'A baseline before a scheduling pilot'
    }
  };
}

module.exports = { loadMainProcess, brief };
