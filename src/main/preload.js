// The bridge between the sandboxed renderer and the main process.
//
// This file is the entire attack surface of the interface, so it is written to
// be read in one sitting. Every capability the renderer has appears below, the
// channel names are literals, not parameters, and nothing accepts a
// channel name from the caller. A renderer that has been compromised can call
// these eight functions and nothing else.

const { contextBridge, ipcRenderer } = require('electron');

// Event channels the renderer may subscribe to. Listing them here, not
// accepting an arbitrary channel means a subscription cannot be turned into a
// way to observe traffic it was not meant to see.
const EVENT_CHANNELS = [
  'run:start',
  'run:complete',
  'run:canceled',
  'step:start',
  'step:complete',
  'step:progress',
  'step:note',
  'step:error',
  'clarification:needed',
  'backend:pull-progress',
  'items:format-progress'
];

contextBridge.exposeInMainWorld('chenoot', {
  // The host platform, read once at load. The interface needs it because macOS
  // hides the title bar and places window controls over the top-left of the
  // content, which the layout has to make room for. This is a constant rather
  // than a capability, so it is a value and not a function.
  platform: process.platform,

  // Pipeline control.
  start: function (input) { return ipcRenderer.invoke('pipeline:start', input); },
  cancel: function () { return ipcRenderer.invoke('pipeline:cancel'); },

  // Backend and settings.
  backendStatus: function () { return ipcRenderer.invoke('backend:status'); },
  pullModel: function (model) { return ipcRenderer.invoke('backend:pull', model); },
  cancelPull: function () { return ipcRenderer.invoke('backend:pull-cancel'); },
  removeModel: function (model) { return ipcRenderer.invoke('backend:remove', model); },
  getSettings: function () { return ipcRenderer.invoke('settings:get'); },
  saveSettings: function (settings) { return ipcRenderer.invoke('settings:save', settings); },

  // Run archive. Identifiers are opaque to the renderer and validated on the
  // other side before they reach the file system.
  specificationFields: function () { return ipcRenderer.invoke('spec:fields'); },
  readabilityMeasures: function () { return ipcRenderer.invoke('readability:measures'); },
  runtimeStatus: function () { return ipcRenderer.invoke('runtime:status'); },
  runtimeInstall: function () { return ipcRenderer.invoke('runtime:install'); },
  runtimeStart: function () { return ipcRenderer.invoke('runtime:start'); },
  runtimeRemove: function (options) { return ipcRenderer.invoke('runtime:remove', options); },
  updateDisclosure: function () { return ipcRenderer.invoke('updates:disclosure'); },
  checkUpdates: function () { return ipcRenderer.invoke('updates:check'); },
  machineDisclosure: function () { return ipcRenderer.invoke('machine:disclosure'); },
  machineConsent: function (granted) { return ipcRenderer.invoke('machine:consent', granted); },
  modelCatalog: function () { return ipcRenderer.invoke('models:catalog'); },
  exportPlatforms: function () { return ipcRenderer.invoke('export:platforms'); },
  itemFormats: function () { return ipcRenderer.invoke('item:formats'); },
  regenerateItem: function (request) { return ipcRenderer.invoke('item:regenerate', request); },
  formatAllItems: function (request) { return ipcRenderer.invoke('items:format-all', request); },
  setScaleOrder: function (request) { return ipcRenderer.invoke('items:scale-order', request); },
  removeAllRuns: function () { return ipcRenderer.invoke('runs:remove-all'); },
  resetApp: function (request) { return ipcRenderer.invoke('app:reset', request); },
  getDraft: function () { return ipcRenderer.invoke('spec:draft-get'); },
  saveDraft: function (working) { return ipcRenderer.invoke('spec:draft-save', working); },
  listRuns: function () { return ipcRenderer.invoke('runs:list'); },
  loadRun: function (runId) { return ipcRenderer.invoke('runs:load', runId); },
  deleteRun: function (runId) { return ipcRenderer.invoke('runs:delete', runId); },
  estimateRun: function (itemCount) { return ipcRenderer.invoke('runs:estimate', itemCount); },

  // Export. The renderer names a format and the main process decides where the
  // file goes, so a path never crosses this boundary in either direction.
  exportRun: function (format) { return ipcRenderer.invoke('export:run', format); },
  // Separate from exportRun because the renderer has to prepare the view first.
  exportPdf: function () { return ipcRenderer.invoke('export:pdf'); },

  // Subscription. Returns its own unsubscribe function so a component can clean
  // up without needing a second exposed method to do it.
  on: function (channel, handler) {
    if (!EVENT_CHANNELS.includes(channel)) {
      throw new Error('Unknown channel: ' + channel);
    }
    // The Electron event object is not passed through. It carries a sender
    // reference, and handing that to renderer code would undo the isolation
    // this file exists to hold.
    const listener = function (_event, payload) { handler(payload); };
    ipcRenderer.on(channel, listener);
    return function () { ipcRenderer.removeListener(channel, listener); };
  }
});
