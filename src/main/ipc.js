// IPC handlers. One per channel declared in preload.js, and no others.
//
// Everything expensive lives on this side of the bridge: the orchestrator, the
// backend, the audit trail, and the finished run. The renderer holds only what
// it draws, which is why an export needs no data to be sent back across.

const { ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');

const { createBackend } = require('./backends');
const { steps } = require('./pipeline');
const { Orchestrator, CancelledError } = require('./pipeline/orchestrator');
const { AuditTrail } = require('./pipeline/audit');
const settingsStore = require('./settings');
const exporters = require('./exports');
const runs = require('./runs');
const specification = require('./pipeline/spec/specification');
const regenerate = require('./pipeline/regenerate');
const catalog = require('./models/catalog');
const scaleDirection = require('./pipeline/scales/direction');
const machine = require('./machine');
const runtime = require('./ollama-runtime');
const updates = require('./updates');
const draft = require('./draft');

// One run at a time. The pipeline is long and model-bound, so a second
// concurrent run would compete for the same local model and make both slower
// while producing two audit trails nobody asked for.
let activeRun = null;
let lastCompletedRun = null;
// One pull at a time, for the same reason as one run at a time: two concurrent
// downloads of multi-gigabyte models compete for the same connection and finish
// later than either would alone.
let activePull = null;

function buildBackend() {
  const settings = settingsStore.load();
  return createBackend({
    backend: settings.backend,
    host: settings.host,
    model: settings.model,
    embeddingModel: settings.embeddingModel,
    apiProvider: settings.apiProvider,
    apiBaseUrl: settings.apiBaseUrl,
    apiKey: settings.backend === 'api' ? settingsStore.apiKey() : null
  });
}

// Counts are recomputed when a run is loaded from disk and never stored
// alongside it, so an archived run and a live one report identically even if
// the counting changes in a later version.
function countsFor(trail) {
  const steps = trail.steps || [];
  const decisions = steps.reduce(function (total, step) {
    return total + step.decisions.length;
  }, 0);
  const unverified = steps.reduce(function (total, step) {
    return total + step.decisions.filter(function (d) {
      return d.provenance === 'recalled-unverified';
    }).length;
  }, 0);
  return {
    steps: steps.length,
    decisions,
    unverified,
    itemsTracked: Object.keys(trail.itemHistory || {}).length
  };
}

function registerHandlers(getWindow) {
  // Forwards orchestrator events to the renderer. Guarded on the window still
  // existing, since a run continues after a window closes and would otherwise
  // throw on every event.
  function forward(orchestrator, channels) {
    channels.forEach(function (channel) {
      orchestrator.on(channel, function (payload) {
        const window = getWindow();
        if (window && !window.isDestroyed()) {
          window.webContents.send(channel, payload);
        }
      });
    });
  }

  ipcMain.handle('pipeline:start', async function (_event, rawInput) {
    if (activeRun) {
      return { status: 'busy' };
    }

    const settings = settingsStore.load();
    // Settings that affect the pipeline are folded into the run input here, so
    // a step reads one object and the audit trail records the configuration
    // that actually applied, not the defaults.
    const input = {
      construct: String(rawInput.construct || '').trim(),
      population: String(rawInput.population || '').trim(),
      purpose: String(rawInput.purpose || '').trim(),
      itemCount: Number(rawInput.itemCount) || 20,
      relatedConstructs: Array.isArray(rawInput.relatedConstructs) ? rawInput.relatedConstructs : [],
      specification: (rawInput.specification && typeof rawInput.specification === 'object')
        ? rawInput.specification
        : {},
      allowModelRecall: Boolean(settings.allowModelRecall),
      critiqueModel: settings.critiqueModel || '',
      readabilityMeasure: settings.readabilityMeasure,
      maximumGrade: settings.maximumGrade,
      maximumWords: settings.maximumWords
    };

    if (input.construct.length === 0) {
      return { status: 'invalid', message: 'A construct name is required.' };
    }

    const trail = new AuditTrail(input, settings);
    const controller = new AbortController();
    const orchestrator = new Orchestrator({ backend: buildBackend(), steps, trail });

    forward(orchestrator, [
      'run:start', 'run:complete', 'run:canceled',
      'step:start', 'step:complete', 'step:progress', 'step:note',
      'step:error', 'clarification:needed'
    ]);

    activeRun = { controller, trail };

    try {
      const result = await orchestrator.run(input, controller.signal);
      if (result.status === 'complete') {
        const assembly = result.results.assembly;
        lastCompletedRun = {
          instrument: assembly.instrument,
          document: assembly.document,
          coverage: {
            distributions: result.results.coverage.distributions,
            removedDuplicates: result.results.coverage.removedDuplicates,
            crossDimensionAlerts: result.results.coverage.crossDimensionAlerts,
            trimmed: result.results.coverage.trimmed || []
          },
          trail
        };
        // Written to disk before the result is returned. A run that reaches
        // this point has already cost the person half an hour, and it should
        // survive a crash, a quit, or a second run started on top of it.
        try {
          runs.save(lastCompletedRun);
        } catch (error) {
          // Failing to archive is not a reason to withhold a finished
          // instrument. The result still returns and the person still has it.
        }
        return {
          status: 'complete',
          instrument: assembly.instrument,
          document: assembly.document,
          counts: assembly.counts,
          // The structured trail crosses too, because the audit panel renders a
          // table from it. Sending only the rendered document would force the
          // renderer to parse prose back into rows, which is the kind of thing
          // that works until someone edits a heading.
          trail: trail.toJSON(),
          // Step 6 measures a similarity distribution per dimension and, until
          // now, only wrote it to the trail as prose. The results screen plots
          // it, so the numbers cross the bridge as numbers.
          coverage: {
            distributions: result.results.coverage.distributions,
            removedDuplicates: result.results.coverage.removedDuplicates,
            crossDimensionAlerts: result.results.coverage.crossDimensionAlerts,
            trimmed: result.results.coverage.trimmed || []
          }
        };
      }
      const halted = result.halted || {};
      return {
        status: result.status,
        question: halted.clarificationQuestion || '',
        missing: halted.missing || []
      };
    } catch (error) {
      if (error instanceof CancelledError) {
        return { status: 'canceled' };
      }
      // The partial trail is kept. Nothing is discarded. A run that failed at
      // Step 5 still documents Steps 1 through 4, and that is often exactly
      // what someone needs in order to understand why it failed.
      lastCompletedRun = { instrument: null, document: null, trail };
      try {
        runs.save(lastCompletedRun);
      } catch (saveError) {
        // As above. A failed archive should not compound a failed run.
      }
      return { status: 'error', message: error.message };
    } finally {
      activeRun = null;
    }
  });

  // Cancellation is acknowledged immediately and not awaited. The current step has to
  // finish before the orchestrator can check the signal, so telling the renderer
  // "cancelling" immediately is both accurate and better than a button that
  // appears to do nothing for the next forty seconds.
  ipcMain.handle('pipeline:cancel', async function () {
    if (!activeRun) {
      return { status: 'idle' };
    }
    activeRun.controller.abort();
    return { status: 'cancelling' };
  });

  // Status is rebuilt from settings on every call and never cached, since
  // the interesting cases are all transitions: Ollama being started, a model
  // finishing its pull, a host being corrected in settings.
  ipcMain.handle('backend:status', async function () {
    try {
      const backend = buildBackend();
      const status = await backend.status();
      return Object.assign({ capabilities: backend.capabilities() }, status);
    } catch (error) {
      return {
        ready: false,
        state: 'error',
        detail: error.message,
        capabilities: { pull: false, embed: false }
      };
    }
  });

  // Removing a model, which is the other half of being able to download one.
  // Downloading was a button and undoing it was homework. A model currently
  // named in settings is refused. The pipeline would fail on its next run with
  // a missing model, which is a worse outcome than being told to choose
  // another one first, and the interface can only offer this on models that
  // are not in use anyway.
  ipcMain.handle('backend:remove', async function (_event, model) {
    const settings = settingsStore.load();
    const backend = createBackend(settings);
    if (!backend.capabilities().remove) {
      return { ok: false, detail: 'This backend has no local copy to remove.' };
    }
    // Removing the model in use is allowed, and what follows is handled here.
    // It was refused, on the reasoning that the pipeline would fail on its
    // next run with a missing model. The setting is moved to another installed
    // model of the same kind, or cleared if there is none, and the answer says
    // which happened so nothing is discovered later.
    const key = catalog.settingKeyFor(model);
    const wasInUse = model === settings.model || model === settings.embeddingModel;

    try {
      await backend.remove(model);
    } catch (error) {
      return { ok: false, detail: error.message };
    }

    // Confirmed against what Ollama reports, not read off the response,
    // for the same reason the pull is: an answer saying the work was done is
    // weaker evidence than the state afterwards.
    const after = await backend.status();
    if (catalog.isInstalled(model, after.installed || [])) {
      return {
        ok: false,
        detail: 'Ollama accepted the request but ' + model + ' is still installed.'
      };
    }

    let replacement = null;
    if (wasInUse) {
      // The best remaining candidate is another installed model doing the same
      // job. Falling back to the shipped default would name something that is
      // very likely not installed either, which is the state that made the
      // setup screen claim a missing model was running.
      const role = catalog.roleOf(model);
      replacement = (after.installed || []).find(function (name) {
        return name !== model && catalog.roleOf(name) === role;
      }) || '';
      settingsStore.save({ [key]: replacement });
    }

    return { ok: true, model, wasInUse, replacement };
  });

  // Pulling streams progress back to the settings screen as it runs. The
  // handler resolves only when the pull finishes, so the renderer awaits one
  // promise and watches one channel, with no polling.
  ipcMain.handle('backend:pull', async function (_event, model) {
    if (activePull) {
      return { ok: false, detail: 'A model is already being pulled.' };
    }
    const backend = buildBackend();
    if (!backend.capabilities().pull) {
      return { ok: false, detail: 'This backend does not pull models.' };
    }

    const controller = new AbortController();
    activePull = controller;
    try {
      await backend.pull(model, function (progress) {
        const window = getWindow();
        if (window && !window.isDestroyed()) {
          window.webContents.send('backend:pull-progress', Object.assign({ model }, progress));
        }
      }, controller.signal);

      // Confirmed, never assumed. The stream finishing means the request
      // ended, not that a model landed: a pull can complete having failed
      // partway, and reporting success on that leaves someone with an
      // application that says it is ready and a pipeline that cannot run.
      const after = await backend.status();
      const present = !(after.missing || []).some(function (name) {
        return name.split(':')[0] === model.split(':')[0];
      });

      if (!present) {
        return {
          ok: false,
          detail: 'The download finished but ' + model + ' is not showing as installed. ' +
            'It may have failed partway. Trying again is usually enough.'
        };
      }

      // Adopted, not merely downloaded. Downloading a model and then not using
      // it is not a thing anyone means to do. The choice is written where the
      // pipeline reads it, and Settings offers every installed model if the
      // person wants a different one afterwards.
      const key = catalog.settingKeyFor(model);
      const previous = settingsStore.load()[key];
      let adopted = null;
      if (previous !== model) {
        settingsStore.save({ [key]: model });
        adopted = { key, model, previous };
      }
      return { ok: true, model, verified: true, adopted };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { ok: false, canceled: true };
      }
      return { ok: false, detail: error.message };
    } finally {
      activePull = null;
    }
  });

  ipcMain.handle('backend:pull-cancel', async function () {
    if (activePull) {
      activePull.abort();
    }
    return { ok: true };
  });

  // forRenderer strips the encrypted key and substitutes a boolean, so the
  // ciphertext never crosses the bridge even though the renderer needs to know
  // whether a key is present.
  ipcMain.handle('settings:get', async function () {
    return settingsStore.forRenderer();
  });

  ipcMain.handle('settings:save', async function (_event, incoming) {
    try {
      settingsStore.save(incoming || {});
      return { ok: true, settings: settingsStore.forRenderer() };
    } catch (error) {
      // The keychain failure path lands here, and its message is written for a
      // person, not for a log.
      return { ok: false, detail: error.message };
    }
  });

  // PDF is printed from the live results view, never composed separately.
  // The person has already read that layout and approved it by getting this
  // far, and a second implementation would be a second thing to keep correct.
  //
  // The renderer opens the audit panel and applies a printing class before
  // calling this, so what lands on paper is the whole document and not a
  // screenshot of a collapsed one.
  // The specification field definitions, including which are required. The
  // input screen renders from these and holds no copy of its own, so a
  // field added to the model appears in the interface without a second edit.
  // The working specification survives a failed run, a quit, and a crash. It is
  // saved on every edit and not on submit, since the case it exists for
  // is the one where submit never happens.
  // Every format one item could take. Sent to the renderer so the picker is
  // built from the catalog. The interface keeps no list of its own.
  // The readability measures, with the prose that explains what each one does
  // and where it should not be trusted. Sent to the renderer so the settings
  // screen renders from the definitions, not from a copy.
  // What would be read, before anything is read. The consent screen renders
  // from this never from its own copy of the list.
  // ---- Managed runtime --------------------------------------------------
  ipcMain.handle('runtime:status', async function () {
    const settings = settingsStore.load();
    try {
      const state = await runtime.status(settings.host);
      return Object.assign({ ok: true, notice: runtime.notice() }, state);
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  // Installing reports progress on the same channel the model pull uses, so the
  // interface has one place to listen and one bar to render.
  ipcMain.handle('runtime:install', async function () {
    if (activePull) {
      return { ok: false, detail: 'Something is already downloading.' };
    }
    const controller = new AbortController();
    activePull = controller;

    // One reporter, used by both halves of the operation.
    const report = function (progress) {
      const window = getWindow();
      if (window && !window.isDestroyed()) {
        window.webContents.send('backend:pull-progress',
          Object.assign({ model: 'ollama' }, progress));
      }
    };

    try {
      await runtime.install(report, controller.signal);
      report({ phase: 'starting', detail: 'Starting Ollama', completed: 0, total: 0, fraction: null });
      await runtime.start(settingsStore.load().host, report);
      return { ok: true };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { ok: false, cancelled: true };
      }
      return { ok: false, detail: error.message };
    } finally {
      activePull = null;
    }
  });

  ipcMain.handle('runtime:start', async function () {
    try {
      return Object.assign({ ok: true }, await runtime.start(settingsStore.load().host));
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('runtime:remove', async function (_event, options) {
    const includeModels = Boolean(options && options.includeModels);
    const outcome = await runtime.remove({ includeModels });

    // Taking the runtime and the models away takes away the reason the machine
    // reading was collected. It exists to say whether a model will run here, so
    // once there is nothing to run, the reading and the permission to take it
    // both go. Setup asks again if somebody starts over.
    if (includeModels && outcome.ok) {
      settingsStore.save({ hardwareConsent: false });
      settingsStore.saveMachine(null);
    }

    return outcome;
  });

  // ---- Update checks ----------------------------------------------------
  ipcMain.handle('updates:disclosure', async function () {
    return updates.DISCLOSURE;
  });

  ipcMain.handle('updates:check', async function () {
    const settings = settingsStore.load();
    if (!settings.updateChecks) {
      return { ok: false, reason: 'Update checks are switched off.' };
    }
    return updates.checkRuntime(settings.runtimeVersion || null);
  });

  ipcMain.handle('machine:disclosure', async function () {
    return { reads: machine.DISCLOSURE };
  });

  // Reading happens here and only on an explicit call. The result is stored so
  // the catalog can be annotated without re-reading on every visit.
  ipcMain.handle('machine:consent', async function (_event, granted) {
    try {
      if (!granted) {
        // Revoking discards the stored reading as well as the permission.
        settingsStore.save({ hardwareConsent: false });
        settingsStore.saveMachine(null);
        return { ok: true, consent: false, machine: null };
      }
      const reading = machine.read();
      settingsStore.save({ hardwareConsent: true });
      settingsStore.saveMachine(reading);
      return { ok: true, consent: true, machine: reading, notes: machine.notesFor(reading) };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  // The catalog, annotated against this machine when it is known and left
  // unannotated when it is not. Refusing consent costs the fit guidance and
  // nothing else.
  ipcMain.handle('models:catalog', async function () {
    const settings = settingsStore.load();
    const known = settings.hardwareConsent ? settings.machine : null;

    // What is already on the machine, asked at the moment the catalog is read.
    // A card offering to download something already downloaded is the reason
    // someone cannot tell whether the last download worked, and the answer to
    // that question is one request away.
    let installed = [];
    try {
      const status = await createBackend(settings).status();
      installed = status.installed || [];
    } catch (error) {
      // Ollama not answering is an ordinary state on this screen and not a
      // fault. Nothing is installed as far as anyone can tell, which is what an
      // empty list says.
      installed = [];
    }

    return {
      models: catalog.annotate(known).map(function (model) {
        return Object.assign({}, model, {
          notice: catalog.noticeFor(model),
          installed: catalog.isInstalled(model.id, installed),
          inUse: model.id === settings.model || model.id === settings.embeddingModel
        });
      }),
      installed,
      selected: { model: settings.model, embeddingModel: settings.embeddingModel },
      machine: known,
      notes: known ? machine.notesFor(known) : [],
      suggestion: known ? catalog.suggestFor(known) : null,
      consent: Boolean(settings.hardwareConsent)
    };
  });

  ipcMain.handle('readability:measures', async function () {
    const readability = require('./pipeline/rubric/readability');
    return {
      measures: Object.keys(readability.MEASURES).map(function (id) {
        const m = readability.MEASURES[id];
        return {
          id,
          label: m.label,
          unit: m.unit,
          summary: m.summary,
          caution: m.caution,
          validAtItemLength: m.validAtItemLength,
          minimumSentences: m.minimumSentences
        };
      })
    };
  });

  // The platform targets, so the results screen lists them from the writers
  // that exist, not from its own copy.
  ipcMain.handle('export:platforms', async function () {
    return { platforms: exporters.PLATFORM_INFO };
  });

  ipcMain.handle('item:formats', async function () {
    return { formats: regenerate.availableFormats() };
  });

  // Change one item's format, rewriting it only if the change requires it.
  //
  // The finished run held in memory is updated in place, so an export taken
  // after an adjustment carries the adjusted instrument and not the
  // original, and the audit trail records what was changed and why.
  ipcMain.handle('item:regenerate', async function (_event, request) {
    if (!lastCompletedRun || !lastCompletedRun.instrument) {
      return { ok: false, detail: 'There is no finished instrument to adjust.' };
    }

    const instrument = lastCompletedRun.instrument;
    let found = null;
    let owningDimension = null;
    instrument.dimensions.forEach(function (dimension) {
      dimension.items.forEach(function (item, index) {
        if (item.id === request.itemId) {
          found = { item, index };
          owningDimension = dimension;
        }
      });
    });
    if (!found) {
      return { ok: false, detail: 'That item is no longer part of the instrument.' };
    }

    const settings = settingsStore.load();
    try {
      const outcome = await regenerate.applyFormat({
        item: found.item,
        fromFormat: found.item.format || instrument.scale.scaleType,
        toFormat: request.format,
        construct: instrument.construct,
        dimension: owningDimension,
        backend: buildBackend(),
        options: { maximumGrade: settings.maximumGrade, maximumWords: settings.maximumWords }
      });

      owningDimension.items[found.index] = outcome.item;

      // Recorded against the assembly step, which is where the instrument was
      // last touched. An adjustment made after the fact is still a decision
      // about this instrument and belongs in its trail.
      const steps = lastCompletedRun.trail.steps ||
        (lastCompletedRun.trail.toJSON ? lastCompletedRun.trail.toJSON().steps : []);
      const assembly = steps[steps.length - 1];
      if (assembly) {
        assembly.decisions.push({
          code: outcome.regenerated ? 'item_format_regenerated' : 'item_format_relabeled',
          description: request.itemId + ' was changed to ' + request.format + ' after assembly. ' +
            outcome.reason,
          evidence: request.format,
          provenance: 'user-supplied',
          at: new Date().toISOString()
        });
      }

      return {
        ok: true,
        item: outcome.item,
        regenerated: outcome.regenerated,
        reason: outcome.reason,
        flags: (outcome.flags || []).map(function (f) { return f.message; }),
        scaleLabels: outcome.scaleLabels
      };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  // Every item to one format, in a single pass.
  //
  // Changing a format one item at a time is right when a particular question
  // needs a different scale, and wrong when somebody decides the whole
  // instrument should be five-point agreement instead of seven. That decision
  // was thirty separate menu selections, each with its own model call and its own
  // wait, and no way to tell how far along it was.
  //
  // The same per-item path does the work, so an item that only needs relabeling
  // is still only relabeled and one that needs rewriting is still rewritten.
  // Progress is reported per item because a rewrite of a long instrument is
  // minutes of model time.
  ipcMain.handle('items:format-all', async function (_event, request) {
    if (!lastCompletedRun || !lastCompletedRun.instrument) {
      return { ok: false, detail: 'There is no finished instrument to adjust.' };
    }

    const instrument = lastCompletedRun.instrument;
    const settings = settingsStore.load();
    const backend = buildBackend();
    const targets = [];
    instrument.dimensions.forEach(function (dimension) {
      dimension.items.forEach(function (item, index) {
        targets.push({ dimension, item, index });
      });
    });

    const report = function (done, total, label) {
      const window = getWindow();
      if (window && !window.isDestroyed()) {
        window.webContents.send('items:format-progress', { done, total, label });
      }
    };

    let changed = 0;
    let rewritten = 0;
    const failures = [];

    for (let position = 0; position < targets.length; position += 1) {
      const target = targets[position];
      report(position, targets.length, target.item.id);
      const current = target.item.format || instrument.scale.scaleType;
      if (current === request.format) {
        continue;
      }
      try {
        const outcome = await regenerate.applyFormat({
          item: target.item,
          fromFormat: current,
          toFormat: request.format,
          construct: instrument.construct,
          dimension: target.dimension,
          backend,
          options: { maximumGrade: settings.maximumGrade, maximumWords: settings.maximumWords }
        });
        target.dimension.items[target.index] = outcome.item;
        changed += 1;
        if (outcome.regenerated) {
          rewritten += 1;
        }
      } catch (error) {
        // One item failing does not undo the ones already converted.
        failures.push(target.item.id);
      }
    }
    report(targets.length, targets.length, null);

    const steps = lastCompletedRun.trail.steps ||
      (lastCompletedRun.trail.toJSON ? lastCompletedRun.trail.toJSON().steps : []);
    const assembly = steps[steps.length - 1];
    if (assembly && changed > 0) {
      assembly.decisions.push({
        code: 'instrument_format_applied',
        description: 'Every item was set to ' + request.format + ' after assembly. ' +
          changed + ' changed, of which ' + rewritten + ' needed rewriting.' +
          (failures.length > 0 ? ' ' + failures.length + ' could not be converted.' : ''),
        evidence: request.format,
        provenance: 'user-supplied',
        at: new Date().toISOString()
      });
    }

    return { ok: true, changed, rewritten, failures, total: targets.length };
  });

  ipcMain.handle('runs:remove-all', async function () {
    try {
      const outcome = runs.removeAll();
      return { ok: true, removed: outcome.removed, remaining: outcome.remaining };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  // Back to how the application arrives, without touching the work.
  //
  // What this clears is configuration and the local draft: the model choice,
  // the address, the item standards, the appearance, and the walkthrough. What
  // it does not clear, unless asked separately, is the run history, because
  // those are the finished instruments and losing them to a settings reset
  // would be losing the only thing here that took half an hour to make.
  //
  // The downloaded Ollama runtime and the models are also left alone. They are
  // gigabytes and they are shared with anything else on the machine using
  // Ollama, so removing them is a decision of its own rather than a side effect
  // of putting the settings back.
  ipcMain.handle('app:reset', async function (_event, request) {
    const options = request || {};
    const cleared = [];
    try {
      settingsStore.reset();
      cleared.push('settings');
      draft.clear();
      cleared.push('draft');

      let removed = 0;
      if (options.includeRuns) {
        const outcome = runs.removeAll();
        removed = outcome.removed;
        cleared.push('runs');
      }

      // The runtime and the models are asked for separately, and neither is
      // touched otherwise. They are gigabytes and the models are shared with
      // anything else on the machine using Ollama, so removing them alongside a
      // settings reset would be a side effect nobody asked for.
      if (options.includeRuntime || options.includeModels) {
        await runtime.remove({
          includeModels: Boolean(options.includeModels),
          keepBinary: Boolean(options.includeModels) && !options.includeRuntime
        });
        if (options.includeRuntime) {
          cleared.push('runtime');
        }
        if (options.includeModels) {
          cleared.push('models');
        }
      }

      return { ok: true, cleared, runsRemoved: removed };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  // Which way the anchors are printed, for one item or for all of them.
  //
  // Separate from reverse keying, which is a property of the item wording and
  // is decided during generation. This only changes the order the same anchors
  // appear in, so it never alters a score.
  ipcMain.handle('items:scale-order', async function (_event, request) {
    if (!lastCompletedRun || !lastCompletedRun.instrument) {
      return { ok: false, detail: 'There is no finished instrument to adjust.' };
    }
    const instrument = lastCompletedRun.instrument;
    const order = request.order === scaleDirection.ASCENDING
      ? scaleDirection.ASCENDING
      : scaleDirection.DESCENDING;

    let changed = 0;
    if (request.itemId) {
      instrument.dimensions.forEach(function (dimension) {
        dimension.items.forEach(function (item) {
          if (item.id === request.itemId) {
            item.scaleOrder = order;
            changed += 1;
          }
        });
      });
    } else {
      // Setting the instrument order clears the per item overrides, because
      // "reverse every scale" that left some items pointing the other way would
      // not have done what it said.
      instrument.scale.order = order;
      instrument.dimensions.forEach(function (dimension) {
        dimension.items.forEach(function (item) {
          delete item.scaleOrder;
          changed += 1;
        });
      });
    }

    const steps = lastCompletedRun.trail.steps ||
      (lastCompletedRun.trail.toJSON ? lastCompletedRun.trail.toJSON().steps : []);
    const assembly = steps[steps.length - 1];
    if (assembly && changed > 0) {
      assembly.decisions.push({
        code: request.itemId ? 'item_scale_order' : 'instrument_scale_order',
        description: (request.itemId ? request.itemId + ' now prints' : 'Every item now prints') +
          ' its anchors ' + (order === scaleDirection.ASCENDING
            ? 'from the least of the attribute to the most.'
            : 'from the most of the attribute to the least.'),
        evidence: order,
        provenance: 'user-supplied',
        at: new Date().toISOString()
      });
    }

    return { ok: true, order, changed, instrument };
  });

  ipcMain.handle('spec:draft-get', async function () {
    try {
      return { ok: true, draft: draft.load() };
    } catch (error) {
      return { ok: false, draft: { construct: '', itemCount: 20, specification: {} } };
    }
  });

  ipcMain.handle('spec:draft-save', async function (_event, working) {
    try {
      draft.save(working || {});
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('spec:fields', async function () {
    return { fields: specification.FIELDS, required: specification.REQUIRED_FIELDS };
  });

  ipcMain.handle('runs:list', async function () {
    try {
      return { ok: true, runs: runs.list() };
    } catch (error) {
      return { ok: false, detail: error.message, runs: [] };
    }
  });

  // Loading a past run replaces what the export handlers act on, so exporting
  // from history writes the run being looked at, not the last one
  // produced in this session.
  ipcMain.handle('runs:load', async function (_event, runId) {
    try {
      const record = runs.load(runId);
      lastCompletedRun = {
        instrument: record.instrument,
        document: record.document,
        coverage: record.coverage,
        trail: { toJSON: function () { return record.trail; }, runId: record.runId }
      };
      return {
        ok: true,
        instrument: record.instrument,
        document: record.document,
        coverage: record.coverage,
        trail: record.trail,
        counts: countsFor(record.trail)
      };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('runs:delete', async function (_event, runId) {
    try {
      runs.remove(runId);
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('runs:estimate', async function (_event, itemCount) {
    try {
      // The machine reading and the chosen model both go in. Both figures are
      // already known by the time anyone reaches this screen: the machine is
      // read during setup, and the model memory is in the catalog.
      const settings = settingsStore.load();
      const known = settings.hardwareConsent ? settings.machine : null;
      const chosen = catalog.MODELS.find(function (model) {
        return model.id === settings.model;
      });
      return runs.estimate(Number(itemCount) || 0, {
        machine: known,
        modelMemoryGb: chosen ? chosen.memoryGb : null
      });
    } catch (error) {
      return { seconds: 0, basis: 'unknown', sampleSize: 0 };
    }
  });

  ipcMain.handle('export:pdf', async function () {
    if (!lastCompletedRun || !lastCompletedRun.instrument) {
      return { ok: false, detail: 'There is no finished run to export.' };
    }
    const window = getWindow();
    if (!window || window.isDestroyed()) {
      return { ok: false, detail: 'The window is no longer available.' };
    }

    let data;
    try {
      data = await window.webContents.printToPDF({
        printBackground: true,
        pageSize: 'Letter',
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
        // Headers and footers are left off. The document carries its own run
        // identifier and construct name, and a browser-generated header would
        // print the application title over the top of them.
        displayHeaderFooter: false
      });
    } catch (error) {
      return { ok: false, detail: error.message };
    }

    const choice = await dialog.showSaveDialog(window, {
      defaultPath: exporters.safeName(lastCompletedRun.instrument.construct) + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    if (choice.canceled || !choice.filePath) {
      return { ok: false, canceled: true };
    }

    try {
      await fs.writeFile(choice.filePath, data);
      return { ok: true, path: choice.filePath };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('export:run', async function (_event, format) {
    if (!lastCompletedRun || !lastCompletedRun.instrument) {
      return { ok: false, detail: 'There is no finished run to export.' };
    }
    let payload;
    try {
      // Binary formats are awaited and produce a Buffer; text formats are
      // synchronous and produce a string. Writing handles both below because
      // fs.writeFile accepts either, but the encoding argument must not be
      // applied to bytes.
      payload = exporters.BINARY.includes(format)
        ? await exporters.writeBinary(format, lastCompletedRun)
        : exporters.write(format, lastCompletedRun);
    } catch (error) {
      return { ok: false, detail: error.message };
    }

    // The save dialog is opened by the main process and the chosen path stays
    // here. The renderer names a format and learns whether the write succeeded,
    // and at no point does it see or supply a filesystem path.
    const window = getWindow();
    const choice = await dialog.showSaveDialog(window, {
      defaultPath: payload.fileName,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    if (choice.canceled || !choice.filePath) {
      return { ok: false, canceled: true };
    }

    try {
      await fs.writeFile(
        choice.filePath,
        payload.contents,
        Buffer.isBuffer(payload.contents) ? undefined : 'utf8'
      );
      return { ok: true, path: choice.filePath };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  });
}

module.exports = { registerHandlers };
