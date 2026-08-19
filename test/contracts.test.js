// Contract tests.
//
// Three bugs reached a working build during development, and all three were the
// same shape: the interface offered something the code did not do.
//
// The settings screen listed a remote API backend whose module was never
// written, so choosing it threw a module resolution error. A pull button
// invoked a handler that called a method absent from the Ollama backend. The
// results screen offered a Word export that threw by design. Every one was
// found by reading and not by failing, which is the least reliable way to
// find anything.
//
// None of them would have survived this file. Each check below compares what
// one part of the application claims against what another part provides, by
// reading the source, not by running it, so a promise added on one side
// without the other fails the build.
//
// Static analysis is the right tool here despite its bluntness. These are all
// string literals crossing a process boundary, which no type system in this
// stack would catch either, and running the checks needs neither Electron nor a
// model.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

// Collect every distinct capture of a pattern. Duplicates collapse, since the
// question is always whether a name appears at all, not how often.
function collect(source, pattern) {
  const found = new Set();
  let match = pattern.exec(source);
  while (match !== null) {
    found.add(match[1]);
    match = pattern.exec(source);
  }
  pattern.lastIndex = 0;
  return found;
}

function missing(required, provided) {
  return Array.from(required).filter(function (name) { return !provided.has(name); });
}

test('every channel the renderer invokes has a handler', function () {
  const invoked = collect(read('src/main/preload.js'), /ipcRenderer\.invoke\(\s*'([^']+)'/g);
  const handled = collect(read('src/main/ipc.js'), /ipcMain\.handle\(\s*'([^']+)'/g);

  assert.ok(invoked.size > 0, 'no invoked channels were found, so the pattern is wrong');
  assert.deepStrictEqual(
    missing(invoked, handled),
    [],
    'the preload invokes channels that ipc.js does not handle'
  );
});

test('no handler is registered that nothing invokes', function () {
  const invoked = collect(read('src/main/preload.js'), /ipcRenderer\.invoke\(\s*'([^']+)'/g);
  const handled = collect(read('src/main/ipc.js'), /ipcMain\.handle\(\s*'([^']+)'/g);

  // The reverse direction is a weaker signal than the first check, since an
  // unused handler is dead, not broken. It is still worth failing on,
  // because the usual cause is a channel renamed on one side only.
  assert.deepStrictEqual(
    missing(handled, invoked),
    [],
    'ipc.js handles channels nothing invokes'
  );
});

test('every event channel the renderer subscribes to is emitted somewhere', function () {
  const preload = read('src/main/preload.js');
  // The call and not the import. Slicing to the first occurrence of
  // "contextBridge" matched the require line at the top of the file, producing
  // an empty range that quietly passed this check over nothing until the
  // emptiness assertion below caught it.
  const block = preload.slice(
    preload.indexOf('const EVENT_CHANNELS'),
    preload.indexOf('contextBridge.exposeInMainWorld')
  );
  const subscribed = collect(block, /'([a-z:-]+)'/g);

  const emitted = new Set();
  ['src/main/pipeline/orchestrator.js', 'src/main/ipc.js'].forEach(function (file) {
    const source = read(file);
    collect(source, /\.emit\(\s*'([^']+)'/g).forEach(function (name) { emitted.add(name); });
    collect(source, /webContents\.send\(\s*'([^']+)'/g).forEach(function (name) { emitted.add(name); });
    // ipc.js forwards a list of orchestrator events by name, not by
    // literal call, so that list counts as emission too.
    collect(source, /forward\(orchestrator, \[([\s\S]*?)\]/g).forEach(function (list) {
      collect(list, /'([^']+)'/g).forEach(function (name) { emitted.add(name); });
    });
  });

  assert.ok(subscribed.size > 0, 'no subscribed channels were found, so the pattern is wrong');
  assert.deepStrictEqual(
    missing(subscribed, emitted),
    [],
    'the preload allows subscription to events nothing sends'
  );
});

test('every backend the settings screen offers resolves to a module', function () {
  const screen = read('src/renderer/screens/SettingsScreen.jsx');
  // Sliced from the backend select to its own closing tag, not to the
  // next field. Anchoring on a neighbouring element made this depend on source
  // order, and it broke the first time two fields were reordered.
  const start = screen.indexOf('id="backend"');
  const end = screen.indexOf('</select>', start);
  assert.ok(start !== -1 && end !== -1, 'the backend select was not found');
  const offered = collect(screen.slice(start, end), /<option value="([^"]+)"/g);

  assert.ok(offered.size > 1, 'expected the settings screen to offer more than one backend');

  offered.forEach(function (backend) {
    // This is the check that would have caught the missing api.js. The factory
    // is exercised and not inspected, so a backend named in the interface
    // has to be reachable in fact.
    const file = backend === 'ollama' ? 'ollama.js' : backend + '.js';
    assert.ok(
      fs.existsSync(path.join(ROOT, 'src/main/backends', file)),
      'settings offers the "' + backend + '" backend but src/main/backends/' + file + ' does not exist'
    );
  });
});

test('every backend implements the whole interface', function () {
  const { AIBackend } = require('../src/main/backends');
  const required = Object.getOwnPropertyNames(AIBackend.prototype)
    .filter(function (name) { return name !== 'constructor'; });

  assert.ok(required.length >= 4, 'the interface should declare at least four methods');

  ['ollama', 'api'].forEach(function (name) {
    const module = require('../src/main/backends/' + name);
    const Backend = module[Object.keys(module).find(function (key) { return /Backend$/.test(key); })];
    assert.ok(Backend, name + ' exports no backend class');

    required.forEach(function (method) {
      // Inherited implementations do not count. The base class throws, so a
      // backend that has not overridden a method would pass a simple typeof
      // check and fail at the moment it is used.
      assert.ok(
        Object.prototype.hasOwnProperty.call(Backend.prototype, method),
        name + ' does not implement ' + method + ', so it would throw when a step calls it'
      );
    });
  });
});

test('every declared capability is actually implemented', function () {
  // The check that the earlier typeof guards prevented. A backend declaring it
  // can pull has to have a pull method of its own, or the declaration is a
  // promise nothing keeps.
  const CAPABILITY_METHOD = { pull: 'pull', embed: 'embed', remove: 'remove' };

  [
    ['ollama', { host: 'http://localhost:11434' }],
    ['api', { apiProvider: 'openai', apiKey: 'k' }],
    ['api', { apiProvider: 'anthropic', apiKey: 'k' }]
  ].forEach(function ([name, settings]) {
    const module = require('../src/main/backends/' + name);
    const Backend = module[Object.keys(module).find(function (key) { return /Backend$/.test(key); })];
    const instance = new Backend(settings);
    const declared = instance.capabilities();

    Object.keys(declared).forEach(function (capability) {
      if (!declared[capability]) {
        return;
      }
      const method = CAPABILITY_METHOD[capability];
      assert.strictEqual(
        typeof instance[method],
        'function',
        name + ' declares the ' + capability + ' capability but has no ' + method + ' method'
      );
    });
  });
});

test('every capability name maps to a known method', function () {
  // Guards the check above against a capability being added under a name the
  // mapping does not know, which would make it silently unchecked.
  const KNOWN = ['pull', 'embed', 'remove'];
  const { AIBackend } = require('../src/main/backends');
  const declared = Object.keys(new (class extends AIBackend {})().capabilities());
  assert.deepStrictEqual(
    declared.filter(function (name) { return !KNOWN.includes(name); }),
    [],
    'a capability was added without a corresponding entry in the contract test'
  );
});

test('every export format the results screen offers is handled', function () {
  const screen = read('src/renderer/screens/ResultsScreen.jsx');
  const formatsBlock = screen.slice(screen.indexOf('const FORMATS'), screen.indexOf('function AuditTable'));
  const offered = collect(formatsBlock, /id: '([^']+)'/g);

  const exporters = require('../src/main/exports');
  const handled = new Set(
    Object.keys(exporters.WRITERS)
      .concat(exporters.PRINTED)
      .concat(exporters.BINARY)
  );

  assert.ok(offered.size > 0, 'no export formats were found, so the pattern is wrong');
  assert.deepStrictEqual(
    missing(offered, handled),
    [],
    'the results screen offers formats no writer produces'
  );
});

test('nothing is offered that is known to be unimplemented', function () {
  const screen = read('src/renderer/screens/ResultsScreen.jsx');
  const formatsBlock = screen.slice(screen.indexOf('const FORMATS'), screen.indexOf('function AuditTable'));
  const offered = collect(formatsBlock, /id: '([^']+)'/g);
  const { PLANNED } = require('../src/main/exports');

  // A format on the planned list is one that throws by design. Offering it is
  // exactly the bug this file exists to catch.
  const wrong = Array.from(offered).filter(function (id) { return PLANNED.includes(id); });
  assert.deepStrictEqual(wrong, [], 'the results screen offers formats that throw by design');
});

test('the step labels in the renderer match the pipeline registry', function () {
  const main = read('src/renderer/main.jsx');
  const block = main.slice(main.indexOf('const STEPS = ['), main.indexOf('function initialStates'));
  const labels = collect(block, /name: '([^']+)'/g);

  const { steps } = require('../src/main/pipeline');

  // Counts have to match exactly. The graduated rule positions its graduations
  // by index, so a renderer holding seven labels against eight steps would
  // draw progress against the wrong marks for the whole run.
  assert.strictEqual(
    labels.size,
    steps.length,
    'the renderer lists ' + labels.size + ' steps and the pipeline has ' + steps.length
  );
});

test('every settings key the interface writes is on the writable list', function () {
  const screen = read('src/renderer/screens/SettingsScreen.jsx');
  const written = collect(screen, /update\('([a-zA-Z]+)'/g);
  const { WRITABLE } = require('../src/main/settings-keys');

  // apiKey is deliberately absent from the writable list. It takes a separate
  // path through the keychain, so it is excluded here, not treated as a
  // failure.
  const checked = Array.from(written).filter(function (key) { return key !== 'apiKey'; });
  const allowed = new Set(WRITABLE);

  assert.deepStrictEqual(
    checked.filter(function (key) { return !allowed.has(key); }),
    [],
    'the settings screen writes keys the store filters out, so those edits would be silently discarded'
  );
});

test('the packaging configuration includes production dependencies', function () {
  const manifest = require('../package.json');
  const files = manifest.build.files || [];

  // An explicit files array replaces electron-builder's default, which would
  // otherwise have carried node_modules into the package. Omitting it produces
  // a build that launches, passes every other check, and then fails the first
  // time someone exports to Word, because the module is simply absent.
  //
  // This is checked here and not caught by building, since a full build
  // takes minutes and this takes none.
  const carriesModules = files.some(function (pattern) {
    return pattern.indexOf('node_modules') !== -1;
  });

  assert.ok(
    Object.keys(manifest.dependencies || {}).length === 0 || carriesModules,
    'package.json declares runtime dependencies but build.files does not include node_modules, ' +
    'so they would be missing from every packaged build'
  );
});

test('the packaging configuration is intact', function () {
  const manifest = require('../package.json');

  // Written after an extract command overwrote package.json with the stripped
  // manifest from inside a built package, which silently removed every script
  // and the whole build block. Nothing failed until a rebuild produced an
  // application with the wrong name.
  ['appId', 'productName', 'files'].forEach(function (key) {
    assert.ok(manifest.build && manifest.build[key], 'build.' + key + ' is missing');
  });
  ['test', 'standards', 'build:renderer', 'start'].forEach(function (script) {
    assert.ok(manifest.scripts && manifest.scripts[script], 'the ' + script + ' script is missing');
  });
  assert.ok(manifest.devDependencies && manifest.devDependencies.electron, 'electron is not declared');
});

test('the run input carries every field a step reads from it', function () {
  // The specification was silently dropped when ipc rebuilt the raw input,
  // which left the gate reporting every required field absent on a form that
  // had been filled in completely. Nothing failed; the run simply stopped for
  // the wrong reason.
  const source = read('src/main/ipc.js');
  const built = source.slice(source.indexOf('const input = {'), source.indexOf('if (input.construct.length'));

  // Fields the pipeline reads off the run input. A step that starts reading a
  // new one has to have it added here, which is the point.
  ['construct', 'itemCount', 'specification', 'critiqueModel', 'maximumGrade'].forEach(function (field) {
    assert.ok(
      built.indexOf(field + ':') !== -1,
      'ipc builds the run input without ' + field + ', so steps reading it would see nothing'
    );
  });
});

test('the halt path does not name a specific step', function () {
  // Reading results.scoping worked until a step was inserted ahead of it, at
  // which point the clarification path threw on undefined. The result carries
  // the halting output instead, so step order can change freely.
  const source = read('src/main/ipc.js');
  const halt = source.slice(source.indexOf("status: 'awaiting-clarification'") - 900, source.indexOf('} catch (error) {'));
  assert.ok(
    halt.indexOf('results.scoping') === -1 && halt.indexOf('results.specification') === -1,
    'the clarification path reaches into a named step, which breaks when the order changes'
  );
});

test('the stylesheet is a plausible size and structurally balanced', function () {
  // Written after a scripted edit inserted one block eighty-three thousand
  // times, producing a ninety-megabyte stylesheet that every other check passed
  // happily: the bundler does not read it, the tests do not parse it, and the
  // application still launched. Size and brace balance are the two cheapest
  // signals that something has gone structurally wrong.
  const css = read('src/renderer/styles/direction.css');
  assert.ok(css.length < 400000, 'the stylesheet is ' + css.length + ' characters, which is implausible');

  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (stripped.match(/\{/g) || []).length;
  const close = (stripped.match(/\}/g) || []).length;
  assert.strictEqual(open, close, 'braces do not balance: ' + open + ' open, ' + close + ' close');
});

test('no stylesheet rule is repeated verbatim more than twice', function () {
  // Catches the same failure by its shape, not by total size, so a
  // smaller runaway insertion is caught too.
  const css = read('src/renderer/styles/direction.css');
  const counts = new Map();
  css.split('\n').forEach(function (line) {
    const trimmed = line.trim();
    // Rule openings only. A property declaration such as a font-family appears
    // legitimately in many rules, and counting those made this fail on
    // ordinary stylesheets. What a runaway insertion duplicates is whole
    // rules, selector and all.
    if (!trimmed.includes('{') || trimmed.startsWith('/*') || trimmed.startsWith('@')) {
      return;
    }
    // :root is exempt. Token declarations are added alongside the sections that
    // introduce them, which puts the selector in the file several times on
    // purpose. It is the one selector where a repeat is a choice, not an
    // accident.
    if (trimmed.startsWith(':root')) {
      return;
    }
    counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
  });
  const repeated = Array.from(counts.entries()).filter(function (entry) { return entry[1] > 2; });
  assert.deepStrictEqual(
    repeated.map(function (entry) { return entry[1] + 'x ' + entry[0].slice(0, 50); }),
    []
  );
});

test('no renderer file uses an identifier it does not import or define', function () {
  // The blank-screen failure: a component kept a reference to BUILD_STAMP after
  // its import was removed. It built without complaint, because a bundler is
  // happy to emit an undefined global, and it threw at first render.
  const fs = require('node:fs');
  const files = [];
  (function walk(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.jsx')) {
        files.push(full);
      }
    });
  }(path.join(ROOT, 'src', 'renderer')));

  // Capitalised identifiers only. Those are components and module constants,
  // which is where this class of mistake lands; lowercase locals are too
  // numerous to track without parsing properly.
  const problems = [];
  files.forEach(function (file) {
    const source = fs.readFileSync(file, 'utf8');
    const imported = new Set();
    (source.match(/import\s*\{([^}]+)\}/g) || []).forEach(function (statement) {
      statement.replace(/import\s*\{|\}/g, '').split(',').forEach(function (name) {
        imported.add(name.trim().split(' as ').pop().trim());
      });
    });
    (source.match(/^(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)/gm) || []).forEach(function (declaration) {
      imported.add(declaration.split(/\s+/)[1]);
    });

    // Destructured props count as defined. A component receiving a component as
    // a prop is an ordinary pattern, and treating it as an undefined reference
    // made this fail on correct code the first time it ran.
    // The pattern spans lines, because a component with eight props is
    // routinely written across three of them and a single-line match sees none
    // of those props at all.
    (source.match(/function\s+\w+\s*\(\s*\{[\s\S]*?\}/g) || []).forEach(function (signature) {
      signature
        .replace(/^[^{]*\{/, '')
        // The closing brace comes along with the last name when the signature
        // wraps, which left "Calibration}" in the set and the real name out of
        // it, so the check failed on the one file it was meant to pass.
        .replace(/\}\s*$/, '')
        .split(',')
        .forEach(function (name) {
          imported.add(name.trim().split(/[=:]/)[0].trim());
        });
    });

    // Used inside a JSX expression, which is where an undefined constant throws.
    const used = new Set();
    (source.match(/\{([A-Z][A-Za-z0-9_]*)\}/g) || []).forEach(function (usage) {
      used.add(usage.slice(1, -1));
    });

    used.forEach(function (name) {
      if (!imported.has(name)) {
        problems.push(path.relative(ROOT, file) + ' uses ' + name + ' without importing it');
      }
    });
  });

  assert.deepStrictEqual(problems, []);
});

// ---- Every screen is reachable -------------------------------------------
//
// The screens the router can show, against the destinations anything can
// actually ask for.
//
// This is written after a screen went unreachable and stayed that way. Merging
// the model catalog into Setup left the standalone models screen with a branch
// in the router, an import, seventy lines of its own, and no route to it from
// anywhere. It went on passing every check: the file parsed, the component
// rendered in isolation, the standards gate read it happily. Help even went on
// referring people to it, so the interface described a place a person could not
// get to.
//
// Unreachable code is ordinarily a tidiness problem. A whole unreachable screen
// is a correctness one, because the text around it keeps promising it.

test('every screen the router can show can be navigated to', function () {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'main.jsx'), 'utf8');
  const shell = fs.readFileSync(
    path.join(ROOT, 'src', 'renderer', 'components', 'Shell.jsx'), 'utf8'
  );

  // What the router branches on.
  const rendered = new Set();
  (main.match(/screen === '([a-z-]+)'/g) || []).forEach(function (branch) {
    rendered.add(branch.replace(/^screen === '/, '').replace(/'$/, ''));
  });

  // What anything can ask to see. Both the navigation bar and every call that
  // sets the screen directly, since a destination reachable only from a button
  // inside another screen is still reachable.
  const reachable = new Set();
  (shell.match(/id: '([a-z-]+)'/g) || []).forEach(function (item) {
    reachable.add(item.replace(/^id: '/, '').replace(/'$/, ''));
  });
  (main.match(/setScreen\('([a-z-]+)'\)/g) || []).forEach(function (call) {
    reachable.add(call.replace(/^setScreen\('/, '').replace(/'\)$/, ''));
  });
  // Controls in the shell that navigate without being a bar item. The wordmark
  // is one: it returns to the landing page, which keeps that page reachable
  // without giving it a place among the working destinations. Counting only
  // bar items reported the landing page as orphaned when it is one click away
  // from every screen in the application.
  (shell.match(/onNavigate\('([a-z-]+)'\)/g) || []).forEach(function (call) {
    reachable.add(call.replace(/^onNavigate\('/, '').replace(/'\)$/, ''));
  });
  // The default, which needs no route because it is where the application opens.
  reachable.add('input');

  const orphaned = Array.from(rendered).filter(function (screen) {
    return !reachable.has(screen);
  });
  assert.deepStrictEqual(orphaned, [],
    'these screens are rendered by the router but nothing navigates to them');
});
