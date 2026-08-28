// A walk through every screen and dialog, checking each one rendered. The
// smoke check beside this one starts the application and watches what it
// prints. Most of this application is behind a click. Settings is a dialog,
// Setup is a destination, the model catalog renders only once it has an answer
// from Ollama. A change to any of those can ship a screen that shows nothing
// at all, and the launch check would report clean the whole way. So this one
// drives the interface. It attaches to the running application over the
// DevTools protocol, opens each screen in turn, and asserts that something
// legible arrived: a heading, some text, no error overlay. Node has a
// WebSocket client built in, so this costs no dependency.

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const os = require('node:os');
const fs = require('node:fs');
const PORT = 9222;
// Long enough for Electron to come up on a slow container, checked by polling,
// not waited out, so the ordinary case costs a second.
const ATTACH_TIMEOUT_MS = 30000;

// Every destination in the shell, with something that has to be present once it
// has rendered. The text is matched loosely: this is a check that the screen
// arrived, not a check on its wording, and a test that fails when a heading is
// reworded would be deleted within a month.
const SCREENS = [
  { id: 'landing', expect: /questions written|nine ways to ask/i },
  { id: 'input', expect: /build an instrument/i },
  { id: 'setup', expect: /two things to get going/i },
  { id: 'results', expect: /nothing built yet|instrument record/i },
  { id: 'history', expect: /past runs|nothing has been built|history/i },
  { id: 'formats', expect: /response formats|two-sided scales/i },
  { id: 'itemtypes', expect: /item types|primary response format/i },
  { id: 'help', expect: /help|walkthrough|how this works/i }
];

// The order the bar renders in, checked because it is a decision instead of an
// accident. Destinations first, then the rule, then configuration and Help.
const BAR_ORDER = ['Setup', 'New', 'This run', 'Past runs', 'Appearance', 'Settings', 'Formats', 'Item types', 'Help'];

// The eight resize handles, each with the edges it is allowed to move. The
// panel is centered by its backdrop, so setting only a width grew it from the
// middle and every drag moved two edges in opposite directions, half as far
// each. Nothing in the code looked wrong; the layout was undoing it. A
// measurement catches that and an inspection does not. Every drag here pulls
// inward, shrinking the panel. Shrinking always has somewhere to go, down to
// the minimum the panel enforces, so what is being measured is the handler and
// not how much happened to be free on the day.
const HANDLES = [
  { grip: 'w', dx: 50, dy: 0, moves: ['left'] },
  { grip: 'e', dx: -50, dy: 0, moves: ['right'] },
  { grip: 'n', dx: 0, dy: 40, moves: ['top'] },
  { grip: 's', dx: 0, dy: -40, moves: ['bottom'] },
  { grip: 'nw', dx: 50, dy: 40, moves: ['left', 'top'] },
  { grip: 'ne', dx: -50, dy: 40, moves: ['right', 'top'] },
  { grip: 'sw', dx: 50, dy: -40, moves: ['left', 'bottom'] },
  { grip: 'se', dx: -50, dy: -40, moves: ['right', 'bottom'] }
];

const EDGES = ['left', 'right', 'top', 'bottom'];

// The two layers, which open over whatever is showing, not replacing it.
// Both were rewritten in this pass and neither is reachable without a click.
const LAYERS = [
  { id: 'settings', expect: /backend|writing model/i },
  { id: 'appearance', expect: /theme|palette|appearance/i }
];

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// The protocol endpoint is published once the window exists, so this polls for
// it instead of assuming a fixed startup time.
async function attach() {
  const deadline = Date.now() + ATTACH_TIMEOUT_MS;
  for (;;) {
    try {
      const response = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const targets = await response.json();
      const page = targets.find(function (target) {
        return target.type === 'page' && target.webSocketDebuggerUrl;
      });
      if (page) {
        return page.webSocketDebuggerUrl;
      }
    } catch (error) {
      // Not up yet. The only failure that matters here is running out of time.
    }
    if (Date.now() > deadline) {
      throw new Error('The application did not publish a debugging target within 30 seconds.');
    }
    await wait(400);
  }
}

// A minimal protocol client. One socket, one pending map keyed by request
// identifier, which is the whole of what this needs from the protocol.
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let sequence = 0;

  socket.addEventListener('message', function (event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }
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
        const timer = setTimeout(function () {
          pending.delete(id);
          reject(new Error(method + ' did not answer within ten seconds.'));
        }, 10000);
        pending.set(id, function (message) {
          clearTimeout(timer);
          if (message.error) {
            reject(new Error(method + ' failed: ' + message.error.message));
            return;
          }
          resolve(message.result);
        });
        socket.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
  };
}

// Expressions are evaluated in the page and their values returned. Anything
// thrown inside the page is raised here and not resolving to undefined,
// which is the difference between a check and a formality.
async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const thrown = result.exceptionDetails.exception;
    throw new Error(thrown && thrown.description ? thrown.description : 'evaluation threw');
  }
  return result.result.value;
}

// Navigation goes through the buttons a person would use, not through
// application state, so that a destination unreachable by clicking fails here.
async function navigate(client, id) {
  const clicked = await evaluate(client, `(function () {
    const buttons = Array.from(document.querySelectorAll('.bar-item'));
    const wanted = ${JSON.stringify(id)};
    const labels = {
      landing: null, input: 'new', setup: 'setup', results: 'this run', history: 'past runs',
      formats: 'formats', itemtypes: 'item types', help: 'help',
      settings: 'settings', appearance: 'appearance'
    };
    if (labels[wanted] === null) {
      const home = document.querySelector('.bar-mark');
      if (!home) { return false; }
      home.click();
      return true;
    }
    const target = buttons.find(function (button) {
      return button.textContent.trim().toLowerCase() === labels[wanted];
    });
    if (!target) { return false; }
    target.click();
    return true;
  }())`);
  if (!clicked) {
    throw new Error('No navigation control for ' + id);
  }
  // A render and any settling effect it schedules.
  await wait(900);
}

async function visibleText(client) {
  return evaluate(client, 'document.body.innerText || ""');
}

async function panelBox(client) {
  return evaluate(client, `(function () {
    const panel = document.querySelector('.modal');
    if (!panel) { return null; }
    const box = panel.getBoundingClientRect();
    return {
      left: Math.round(box.left), right: Math.round(box.right),
      top: Math.round(box.top), bottom: Math.round(box.bottom)
    };
  }())`);
}

// A drag, sent as the three pointer events a real one produces. Synthesized,
// not performed through the input domain of the protocol, because the
// handler listens for pointer events and this is what it will receive.
async function drag(client, grip, dx, dy) {
  await evaluate(client, `(function () {
    const handle = document.querySelector('.modal-grip-${grip}');
    if (!handle) { return false; }
    const box = handle.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const base = { bubbles: true, pointerId: 1, clientX: x, clientY: y };
    handle.dispatchEvent(new PointerEvent('pointerdown', base));
    const to = Object.assign({}, base, { clientX: x + (${dx}), clientY: y + (${dy}) });
    document.dispatchEvent(new PointerEvent('pointermove', to));
    document.dispatchEvent(new PointerEvent('pointerup', to));
    return true;
  }())`);
  await wait(250);
}

// Every handle in turn, on a panel closed and reopened each time. By the fifth
// it had reached the minimum size it refuses to go below, and every handle
// after that correctly did nothing and was reported as broken. Each
// measurement needs a panel at its opening size, which means closing the one
// before it. A tolerance of two pixels absorbs subpixel layout rounding
// without admitting the failure this checks for, which moved edges by tens.
async function checkHandles(client, open, failures) {
  for (const handle of HANDLES) {
    await open();
    const before = await panelBox(client);
    if (!before) {
      failures.push('the panel was not open when handle ' + handle.grip + ' was tried');
      return;
    }
    await drag(client, handle.grip, handle.dx, handle.dy);
    const after = await panelBox(client);
    EDGES.forEach(function (edge) {
      const distance = Math.abs(after[edge] - before[edge]);
      const shouldMove = handle.moves.indexOf(edge) !== -1;
      if (shouldMove && distance < 2) {
        failures.push('handle ' + handle.grip + ' did not move the ' + edge + ' edge');
      }
      if (!shouldMove && distance > 2) {
        failures.push('handle ' + handle.grip + ' moved the ' + edge + ' edge by ' + distance);
      }
    });
  }
}

// A finished run on disk, so the results screen has something to draw. It goes
// into the throwaway profile the walk runs against, which is thrown away with
// it. Before that it was written into the real archive under the home
// directory, where it stayed, so anybody who ran this check ended up with a
// fabricated run sitting among their own.
function writeProbeRun(profile) {
  const directory = path.join(profile, 'runs');
  fs.mkdirSync(directory, { recursive: true });

  const labels = [
    'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'
  ];
  const items = [
    { id: 'chk-01', text: 'I decide how to do my work.', direction: 'positive', flags: [], readingGrade: 8, wordCount: 7 },
    { id: 'chk-02', text: 'My schedule is set for me.', direction: 'reverse', flags: [], readingGrade: 7, wordCount: 6 }
  ];
  const now = new Date().toISOString();

  fs.writeFileSync(path.join(directory, 'run-screencheck.json'), JSON.stringify({
    runId: 'run-screencheck',
    savedAt: now,
    status: 'complete',
    instrument: {
      construct: 'Screen check',
      population: 'nobody',
      purpose: 'exercising the results screen',
      scale: {
        scaleType: 'agreement-5',
        scaleLabel: 'Five-point agreement',
        scaleLabels: labels,
        polarity: 'bipolar',
        points: 5,
        hasMidpoint: true,
        fullyLabelled: true,
        family: 'agreement',
        justification: 'The construct is bipolar.',
        order: 'positive-first'
      },
      dimensions: [
        { name: 'Autonomy', definition: 'Control over work.', targetItemCount: 2, items }
      ],
      administrationOrder: ['chk-01', 'chk-02']
    },
    document: { text: 'FINAL INSTRUMENT' },
    coverage: { finalItems: items, distributions: [{ dimension: 'Autonomy', kept: 2, dropped: 0 }] },
    trail: {
      runId: 'run-screencheck',
      startedAt: now,
      settings: { model: 'probe' },
      steps: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
        return {
          number: n,
          name: 'step' + n,
          state: 'complete',
          decisions: [{
            code: 'probe', description: 'A decision.', evidence: 'e',
            provenance: 'measured', at: now
          }],
          startedAt: now, endedAt: now, durationMs: 1000
        };
      })
    }
  }), 'utf8');
}

async function run() {
  // A throwaway profile, so the walk always meets a machine that has not been
  // set up yet. The first setup step offers to install the runtime only when
  // the runtime is absent, and any machine this has already run on has it, so
  // without this the check reads the state of whoever ran it rather than the
  // state of the screen.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chenoot-screens-'));

  // A settings file pointing at a port nothing answers on. The runtime status
  // is derived from whether an address responds, and with no settings file the
  // check falls back to the default Ollama port. Any machine with Ollama
  // installed is answering there, which sits outside the profile and beyond
  // what the profile can isolate, so the first setup step reported itself ready
  // and offered nothing to click. A dead address puts that step into the state
  // this check was written for, without an environment hook and without
  // touching the application.
  fs.writeFileSync(
    path.join(profile, 'settings.json'),
    JSON.stringify({ backend: 'ollama', host: 'http://127.0.0.1:49213' }),
    'utf8'
  );

  const child = spawn(
    path.join(ROOT, 'node_modules', '.bin', 'electron'),
    ['.', '--no-sandbox', '--user-data-dir=' + profile, '--remote-debugging-port=' + PORT],
    {
      cwd: ROOT,
      stdio: 'ignore',
      // The managed install path exists on macOS and Windows and not here, and
      // the download notice sits behind it. Forcing the supported branch is
      // what makes that dialog reachable from a check at all.
      env: Object.assign({}, process.env, { CHENOOT_FORCE_SUPPORTED: '1' })
    }
  );

  const failures = [];
  let client = null;

  try {
    const url = await attach();
    client = connect(url);
    await client.ready;
    // The first paint, plus the settings read that follows it.
    await wait(2500);

    // The walkthrough opens over a first launch and covers the shell, so it is
    // dismissed before anything else is reached for. Its presence is checked
    // and not assumed, since a machine that has run this before will not
    // show it.
    await evaluate(client, `(function () {
      const dismiss = Array.from(document.querySelectorAll('.walkthrough button'))
        .find(function (button) { return /skip|done|finish|close/i.test(button.textContent); });
      if (dismiss) { dismiss.click(); }
      return true;
    }())`);
    await wait(500);

    const order = await evaluate(client, `(function () {
      return Array.from(document.querySelectorAll('.bar-item')).map(function (button) {
        return button.textContent.trim();
      });
    }())`);
    if (order.join('|') !== BAR_ORDER.join('|')) {
      failures.push('the bar reads ' + order.join(', ') + ', not ' + BAR_ORDER.join(', '));
    }

    for (const screen of SCREENS) {
      await navigate(client, screen.id);
      const text = await visibleText(client);
      // Empty is the failure this whole file exists for.
      if (text.trim().length < 40) {
        failures.push(screen.id + ' rendered almost nothing');
      } else if (!screen.expect.test(text)) {
        failures.push(screen.id + ' rendered without its expected content');
      }
    }

    for (const layer of LAYERS) {
      await navigate(client, layer.id);
      const text = await evaluate(client, `(function () {
        const panel = document.querySelector('.modal');
        return panel ? panel.innerText : '';
      }())`);
      if (!text || text.trim().length < 20) {
        failures.push(layer.id + ' opened as an empty panel');
      } else if (!layer.expect.test(text)) {
        failures.push(layer.id + ' opened without its expected content');
      }
      // Closed by the key instead of the button, which checks the one behavior
      // the download notice was missing before it moved onto the shared modal.
      await evaluate(client, `(function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }())`);
      await wait(400);
      const stillOpen = await evaluate(client, 'Boolean(document.querySelector(".modal"))');
      if (stillOpen) {
        failures.push(layer.id + ' did not close on Escape');
      }
    }

    // The panel is reopened for each handle, through the same control a person
    // would use, so a dialog that cannot be reopened fails here too.
    await checkHandles(client, async function () {
      await evaluate(client, `(function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }())`);
      await wait(350);
      await navigate(client, 'settings');
    }, failures);

    await evaluate(client, `(function () {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    }())`);
    await wait(400);

    // The download notice, which is the dialog shown before anything is
    // fetched from outside the application. It had its own backdrop and panel
    // until this pass, which left it the one dialog that could not be resized
    // and did not answer the Escape key, so both are checked here, not
    // taken on the word of the component.
    await navigate(client, 'setup');
    await wait(700);

    const opened = await evaluate(client, `(function () {
      const button = Array.from(document.querySelectorAll('button'))
        .find(function (item) { return /set it up for me/i.test(item.textContent); });
      if (!button) { return false; }
      button.click();
      return true;
    }())`);
    if (!opened) {
      failures.push('the first setup step offered no way to open the download notice');
    } else {
      await wait(800);
      const notice = await evaluate(client, `(function () {
        const panel = document.querySelector('.modal.notice');
        return panel ? panel.innerText : '';
      }())`);
      if (!/before downloading/i.test(notice)) {
        failures.push('the download notice did not open');
      }
      const grips = await evaluate(
        client, 'document.querySelectorAll(".modal.notice .modal-grip").length'
      );
      if (grips !== 8) {
        failures.push('the download notice carries ' + grips + ' resize handles, not eight');
      }
      await checkHandles(client, async function () {
        await evaluate(client, `(function () {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return true;
        }())`);
        await wait(350);
        await evaluate(client, `(function () {
          const button = Array.from(document.querySelectorAll('button'))
            .find(function (item) { return /set it up for me/i.test(item.textContent); });
          if (button) { button.click(); }
          return true;
        }())`);
        await wait(700);
      }, failures);
      await evaluate(client, `(function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }())`);
      await wait(400);
      if (await evaluate(client, 'Boolean(document.querySelector(".modal.notice"))')) {
        failures.push('the download notice did not close on Escape');
      }
    }

    // The results screen, opened from a run written to disk for the purpose.
    //
    // Every other screen here renders without a finished run behind it, so this
    // one went unchecked until a missing prop blanked the whole window on the
    // one screen a person reaches only after waiting several minutes for it.
    // The fixture is small and it exercises the parts that need real data:
    // dimensions, items, anchors, distributions, and a full audit trail.
    writeProbeRun(profile);
    await navigate(client, 'history');
    await wait(900);
    const probeOpened = await evaluate(client, `(function () {
      const row = Array.from(document.querySelectorAll('.history-open'))
        .find(function (b) { return /Screen check/.test(b.textContent); });
      if (!row) { return false; }
      row.click();
      return true;
    }())`);
    if (!probeOpened) {
      failures.push('the probe run did not appear under past runs');
    } else {
      await wait(1600);
      const text = await visibleText(client);
      if (!/Screen check/i.test(text) || text.trim().length < 200) {
        failures.push('the results screen did not render the opened run');
      }
      if (/could not be shown/i.test(text)) {
        failures.push('the results screen threw and fell back to the error boundary');
      }
    }

    // Anything the renderer threw during all of that. React swallows nothing
    // here: an uncaught exception leaves the root empty, which the checks above
    // would already have caught, and this is the belt for everything else.
    const rootFilled = await evaluate(client, `(function () {
      const root = document.getElementById('root');
      return Boolean(root && root.children.length > 0);
    }())`);
    if (!rootFilled) {
      failures.push('the application root emptied during the walk');
    }
  } catch (error) {
    failures.push(error.message);
  } finally {
    if (client) {
      client.close();
    }
    child.kill();
    // The profile goes with the run that made it. A short wait first, since the
    // window is still writing as it closes and pulling the directory out from
    // under it produces noise that means nothing.
    await wait(600);
    fs.rmSync(profile, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    process.stderr.write('FAIL. ' + failures.length + ' screen problems:\n');
    failures.forEach(function (line) { process.stderr.write('  ' + line + '\n'); });
    process.exit(1);
  }
  process.stdout.write(
    'PASS. ' + (SCREENS.length + LAYERS.length + 1) + ' screens opened and rendered, ' +
    (HANDLES.length * 2) + ' resize handle drags moved only their own edges.\n'
  );
}

run();
