// Electron main process.
//
// The renderer runs sandboxed with context isolation on and Node integration
// off. Nothing in the interface can touch the file system, spawn a process, or
// reach the network except through the small set of channels declared in
// ipc.js, and the preload script is the only bridge across that line.
//
// This is where the portfolio convention of writing scripts inline does not
// carry over. In a Shiny application inline JavaScript avoids a separate assets
// directory and costs nothing. In Electron it requires unsafe-inline in the
// content security policy, which is the single most common way an Electron
// application becomes exploitable. The underlying intent, that the application
// is self-contained and fetches nothing at runtime, is kept and is in fact
// stricter here: the policy below permits no remote origin of any kind.

const { app, BrowserWindow, session, shell } = require('electron');
const path = require('node:path');
const { registerHandlers } = require('./ipc');

// One storage folder, whichever way the application was started. Electron
// names the user data folder after the application, and the application has
// two names: the package name when it is run from source, and the product name
// when it is packaged. Those resolve to different folders, so the settings,
// the downloaded Ollama runtime, the model selection, and the run history all
// appeared to reset when someone moved between a built copy and a development
// one. The application was reading a different directory and finding it empty,
// which looks exactly like having been wiped. Setting the name before anything
// asks for a path pins both to the same place. It has to happen here, at the
// top of the main process, because settings and the runtime both resolve their
// paths on first use and the first use can come from a handler registered
// below.
app.setName('Chenoot');

// Pinning the name fixes the problem going forward and orphans whatever was
// written before the fix, which for an existing user is every setting, the
// downloaded runtime, and the whole run history. Copying rather than moving
// means a failure partway leaves the original intact, and the marker file
// stops this running on every launch.
function adoptEarlierStorage() {
  const fs = require('node:fs');
  const current = app.getPath('userData');
  const previous = path.join(path.dirname(current), 'chenoot');
  if (previous === current || !fs.existsSync(previous)) {
    return;
  }
  const marker = path.join(current, '.adopted-earlier-storage');
  if (fs.existsSync(marker)) {
    return;
  }
  try {
    fs.mkdirSync(current, { recursive: true });
    fs.readdirSync(previous, { withFileTypes: true }).forEach(function (entry) {
      const from = path.join(previous, entry.name);
      const to = path.join(current, entry.name);
      if (fs.existsSync(to)) {
        return;
      }
      fs.cpSync(from, to, { recursive: true });
    });
    fs.writeFileSync(marker, new Date().toISOString(), 'utf8');
  } catch (error) {
    // Failing to start over this would be worse than the thing it is trying to
    // repair.
  }
}

adoptEarlierStorage();

// Local model traffic is the one exception to the network policy, and it is
// made by the main process instead of the renderer. The renderer itself is
// permitted no outbound connections at all.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 840,
    minWidth: 900,
    minHeight: 700,
    // Painted before the renderer loads so the window does not flash white on
    // open. The value matches the dark background token, since dark is default.
    backgroundColor: '#0E141D',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // Devtools stay available in development and are closed off in a packaged
      // build, where an opened console is a support problem, not a tool.
      devTools: !app.isPackaged
    }
  });

  // Shown once the first paint is ready, so the window appears complete rather
  // than assembling itself in front of the person.
  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Any attempt to open a new window is refused and handed to the system
  // browser instead. A packaged application has no legitimate reason to open a
  // second Electron window pointing anywhere.
  mainWindow.webContents.setWindowOpenHandler(function ({ url }) {
    // Anchors in the interface carry target blank, which arrives here. They are
    // handed to the system browser, not opened as a second Electron
    // window, and everything else is refused.
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Navigation away from the bundled page is refused outright. Without this a
  // link in rendered content could replace the whole interface.
  mainWindow.webContents.on('will-navigate', function (event) {
    event.preventDefault();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(function () {
  session.defaultSession.webRequest.onHeadersReceived(function (details, callback) {
    callback({
      responseHeaders: Object.assign({}, details.responseHeaders, {
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY]
      })
    });
  });

  // Permission requests are denied wholesale. This application needs no camera,
  // microphone, location, or notifications, so there is no case to evaluate.
  session.defaultSession.setPermissionRequestHandler(function (_contents, _permission, callback) {
    callback(false);
  });

  registerHandlers(function () { return mainWindow; });
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// A managed runtime is a child of this application and goes when it goes. The
// binary and any models stay on disk unless the person asked otherwise, so
// stopping it costs them nothing next time.
app.on('before-quit', function () {
  try {
    const runtime = require('./ollama-runtime');
    runtime.stop();
    // Removal on quit is opt in. It is the right choice for someone who tried
    // this once and the wrong one for everybody else, so it is never the
    // default and it never happens silently without having been asked for.
    const settings = require('./settings').load();
    if (settings.keepRuntimeOnQuit === false) {
      runtime.remove({ includeModels: false });
    }
  } catch (error) {
    // Failing to stop a process that may never have started is not worth
    // blocking a quit over.
  }
});

app.on('window-all-closed', function () {
  // Standard platform behavior: macOS applications stay resident when their
  // last window closes, everything else exits.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { CONTENT_SECURITY_POLICY };
