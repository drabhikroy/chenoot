// Captures the screenshots the readme uses.
//
// Generated from the running application so the images in the repository cannot
// drift away from what the application looks like. Run it after a change that
// alters the landing page, and commit what it writes.
//
// It needs a display. On a machine without one, xvfb-run provides it, which is
// what the npm script does.

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'images');
const PORT = 9455;

const wait = function (ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
};

async function attach() {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const response = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const targets = await response.json();
      const page = targets.find(function (t) {
        return t.type === 'page' && t.webSocketDebuggerUrl;
      });
      if (page) {
        return page.webSocketDebuggerUrl;
      }
    } catch (error) {
      // Not up yet.
    }
    if (Date.now() > deadline) {
      throw new Error('The application did not publish a debugging target.');
    }
    await wait(400);
  }
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let sequence = 0;
  socket.addEventListener('message', function (event) {
    const message = JSON.parse(event.data);
    const waiting = pending.get(message.id);
    if (waiting) {
      pending.delete(message.id);
      waiting(message);
    }
  });
  const ready = new Promise(function (resolve, reject) {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', function () {
      reject(new Error('The debugging socket could not be opened.'));
    });
  });
  return {
    ready,
    close: function () { socket.close(); },
    send: function (method, params) {
      sequence += 1;
      const id = sequence;
      return new Promise(function (resolve, reject) {
        const timer = setTimeout(function () { reject(new Error(method + ' timed out')); }, 20000);
        pending.set(id, function (message) {
          clearTimeout(timer);
          if (message.error) {
            reject(new Error(message.error.message));
            return;
          }
          resolve(message.result);
        });
        socket.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception.description);
  }
  return result.result.value;
}

// Screenshots come back base64 encoded on the protocol result. The page domain
// does not have to be turned on first for this one call, which is worth knowing
// because turning it on subscribes to every navigation event for the rest of
// the session and none of them are read here.
async function shot(client, name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(result.data, 'base64'));
}

async function run() {
  // Written into the repository rather than to a scratch directory, since the
  // point is to commit them.
  fs.mkdirSync(OUT, { recursive: true });
  const child = spawn(
    path.join(ROOT, 'node_modules', '.bin', 'electron'),
    ['.', '--no-sandbox', '--remote-debugging-port=' + PORT],
    { cwd: ROOT, stdio: 'ignore' }
  );

  try {
    const client = connect(await attach());
    await client.ready;
    // The first paint, plus the assembly the landing page runs once on arrival.
    await wait(3200);
    await evaluate(client, `(function () {
      const dismiss = Array.from(document.querySelectorAll('.walkthrough button'))
        .find(function (b) { return /skip|done|finish|close/i.test(b.textContent); });
      if (dismiss) { dismiss.click(); }
      return true;
    }())`);
    await wait(2600);

    for (const mode of ['dark', 'light']) {
      await evaluate(client, `(function () {
        document.documentElement.dataset.mode = ${JSON.stringify(mode)};
        window.scrollTo(0, 0);
        return true;
      }())`);
      // Long enough for the appearance change to settle. The palette is applied
      // by an attribute on the root, so there is no asset to load and half a
      // second is generous.
      await wait(500);
      await shot(client, 'landing-' + mode);
    }

    // The specimen sheet, which is the section that shows what the application
    // produces without needing a run to have happened.
    await evaluate(client, `(function () {
      document.documentElement.dataset.mode = 'dark';
      const sheet = document.querySelector('.landing-specimens');
      if (sheet) { sheet.scrollIntoView(); }
      return true;
    }())`);
    await wait(600);
    await shot(client, 'formats-dark');

    client.close();
    process.stdout.write('wrote 3 screenshots to docs/images\n');
  } finally {
    // The application is killed whether or not the capture worked, so a failure
    // partway does not leave an Electron process holding the debugging port
    // against the next run.
    child.kill();
  }
}

run();
