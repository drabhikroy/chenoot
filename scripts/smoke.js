// A launch check that actually fails when the application is broken.
//
// Written after shipping a build that rendered nothing at all. The check in use
// at the time filtered Electron's output for a handful of phrases and reported
// "launch clean", because the renderer's exception arrives as a CONSOLE line
// and CONSOLE was not one of the phrases. A blank window and a healthy one
// produced identical output.
//
// This starts the application, watches everything it prints, and fails on
// anything that looks like a renderer fault. The noise Electron produces in a
// headless container is filtered by an explicit list, so a new kind of message
// surfaces and not being swallowed.

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUN_SECONDS = 12;

// Lines that mean the renderer did not survive. CONSOLE is included because
// that is how an uncaught exception in the renderer reaches this output at all.
const FAULT = /ReferenceError|TypeError|SyntaxError|Uncaught|is not defined|is not a function|Cannot read|Failed to load|Content Security Policy/i;

// Expected noise from running headless without a display server, a GPU, or a
// session bus. Listed explicitly and not matched loosely, so a message that
// is genuinely new is not mistaken for one of these.
const EXPECTED = [
  /gpu|vulkan|swiftshader|EGL|GLX|dri3|angle|passthrough/i,
  /dbus|bus\.cc|session bus/i,
  /libva|vaapi/i,
  /fontconfig/i,
  /xdg|sandbox|zygote|namespace/i,
  /Failed to send GetTerminationStatus/i
];

function expected(line) {
  return EXPECTED.some(function (pattern) { return pattern.test(line); });
}

const faults = [];
const child = spawn(
  path.join(ROOT, 'node_modules', '.bin', 'electron'),
  ['.', '--no-sandbox', '--enable-logging=stderr'],
  { cwd: ROOT, env: Object.assign({}, process.env, { ELECTRON_ENABLE_LOGGING: '1' }) }
);

function inspect(chunk) {
  String(chunk).split('\n').forEach(function (line) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || expected(trimmed)) {
      return;
    }
    if (FAULT.test(trimmed)) {
      faults.push(trimmed);
    }
  });
}

child.stdout.on('data', inspect);
child.stderr.on('data', inspect);

setTimeout(function () {
  child.kill();

  if (faults.length > 0) {
    console.log('FAIL. The application started but the renderer reported ' +
      faults.length + ' fault' + (faults.length === 1 ? '' : 's') + ':');
    faults.slice(0, 10).forEach(function (line) { console.log('  ' + line); });
    process.exit(1);
  }

  console.log('PASS. Launched and ran for ' + RUN_SECONDS + 's with no renderer faults.');
  process.exit(0);
}, RUN_SECONDS * 1000);
