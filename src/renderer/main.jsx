import { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { InputScreen } from './screens/InputScreen.jsx';
import { PipelineScreen } from './screens/PipelineScreen.jsx';
import { ResultsScreen } from './screens/ResultsScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { HistoryScreen } from './screens/HistoryScreen.jsx';
import { ClarifyScreen } from './screens/ClarifyScreen.jsx';
import { HelpScreen } from './screens/HelpScreen.jsx';
import { LandingScreen } from './screens/LandingScreen.jsx';
import { ScreenBoundary } from './components/ScreenBoundary.jsx';
import { FormatReference } from './components/FormatReference.jsx';
import { ItemTypeReference } from './components/ItemTypeReference.jsx';
import { AppearanceScreen } from './screens/AppearanceScreen.jsx';
import { SetupScreen } from './screens/SetupScreen.jsx';
import { Walkthrough } from './components/Walkthrough.jsx';
import { Shell } from './components/Shell.jsx';

// Step names and abbreviations used by the progress rule. They are kept here
// because this renderer is sandboxed and cannot import modules from the main
// process. The main registry remains the source of truth. This list provides
// only the labels, and the numbering is checked against incoming events.
const STEPS = [
  { name: 'Specification', short: 'Spec' },
  { name: 'Scoping', short: 'Scope' },
  { name: 'Grounding', short: 'Ground' },
  { name: 'Generation', short: 'Generate' },
  { name: 'Critique', short: 'Critique' },
  { name: 'Revision', short: 'Revise' },
  { name: 'Coverage', short: 'Cover' },
  { name: 'Response scale', short: 'Scale' },
  { name: 'Assembly', short: 'Assemble' }
];

// Creates a new state array each time the process starts so previous summaries
// cannot carry over into the next questionnaire.
function initialStates() {
  return STEPS.map(function () {
    return { state: 'pending', summary: null, durationMs: null };
  });
}

// One component manages the screen state and event subscriptions. Individual
// screens receive only the values and actions they need, keeping process state
// in one place.
function App() {
  // The app opens on the landing page so someone arriving for the first time can
  // see what it does. Clicking the wordmark returns here, so the page remains
  // available without taking up space in the navigation.
  const [screen, setScreen] = useState('landing');
  const [states, setStates] = useState(initialStates);
  const [settings, setSettings] = useState(null);
  const [backend, setBackend] = useState({ ready: false, detail: 'Checking Ollama.' });
  const [cancelling, setCancelling] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Records when the current step began so its timer can be tracked separately
  // from the total elapsed time.
  const [stepStartedAt, setStepStartedAt] = useState(null);
  // Stores the live commentary. The list has a limit because a rapidly growing
  // log becomes difficult to read and should not keep growing throughout a long
  // process.
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  // Keeps the submitted request for the entire session. The progress and results
  // screens both show it, so someone does not have to remember what they entered
  // earlier.
  const [runInput, setRunInput] = useState(null);
  // Keeps the current specification here and saves every change. Leaving the
  // screen, closing the app, or a failed process does not discard it.
  const [draft, setDraft] = useState({ construct: '', itemCount: 20, specification: {} });
  const [clarify, setClarify] = useState(null);
  const [walkthrough, setWalkthrough] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  // Tracks which model is being downloaded so both Setup and Settings can show
  // the same information without storing separate copies.
  const [pulling, setPulling] = useState(null);
  const [pullProgress, setPullProgress] = useState(null);
  // Keeps the result of the most recent download after it ends so any failure can
  // still be reported. Clearing it immediately would make a failed download
  // disappear without explanation.
  const [lastAttempt, setLastAttempt] = useState(null);
  // Tracks whether a questionnaire has been created before. This determines
  // whether the landing page shows the full introduction or the shorter heading.
  const [hasHistory, setHasHistory] = useState(false);

  // Theme and palette are applied to the document element because that is what
  // the generated stylesheet reads. Keeping this here gives the whole app one
  // place that controls its appearance.
  useEffect(function () {
    // Platform is identified before anything appears. On macOS, the window controls
    // overlap the upper-left part of the content area, so knowing this in advance
    // prevents the layout from shifting after the screen appears.
    document.documentElement.dataset.platform = window.chenoot.platform;
    window.chenoot.getSettings().then(function (loaded) {
      setSettings(loaded);
      document.documentElement.dataset.mode = loaded.theme;
      document.documentElement.dataset.palette = loaded.palette;
      // Shown once. Anyone who wants to see it again can open it from Help.
      if (!loaded.walkthroughSeen) {
        setWalkthrough(true);
      }
    });
    window.chenoot.backendStatus().then(setBackend);
    window.chenoot.listRuns().then(function (outcome) {
      setHasHistory(Boolean(outcome && outcome.runs && outcome.runs.length > 0));
    });
    window.chenoot.getDraft().then(function (outcome) {
      if (outcome && outcome.draft) { setDraft(outcome.draft); }
    });
  }, []);

  // Saved whenever something changes rather than when Start is pressed. This
  // protects the information even when the process never begins.
  const updateDraft = useCallback(function (next) {
    setDraft(next);
    window.chenoot.saveDraft(next);
  }, []);

  // Step events are applied as soon as they arrive. Completion is reported
  // immediately after a step finishes, so the screen only waits for the next render.
  useEffect(function () {
    const unsubscribers = [
      window.chenoot.on('step:start', function (event) {
        setStepStartedAt(Date.now());
        setStates(function (previous) {
          const next = previous.slice();
          next[event.index] = Object.assign({}, next[event.index], { state: 'running' });
          return next;
        });
      }),
      window.chenoot.on('step:complete', function (event) {
        setStepStartedAt(null);
        setStates(function (previous) {
          const next = previous.slice();
          // A step with flagged items is shown as flagged rather than complete. This makes
          // it clear afterward where something needed attention.
          const flagged = /flagged|dropped/.test(event.summary || '');
          next[event.index] = {
            state: flagged ? 'flagged' : 'complete',
            summary: event.summary,
            durationMs: event.durationMs
          };
          return next;
        });
      }),
      window.chenoot.on('step:progress', function (event) {
        setStates(function (previous) {
          const next = previous.slice();
          const index = event.number - 1;
          // Progress updates apply only to the step currently in progress. A late update
          // from an earlier step cannot replace the summary already recorded for it.
          if (next[index] && next[index].state === 'running') {
            next[index] = Object.assign({}, next[index], {
              detail: event.detail,
              completed: event.completed,
              total: event.total
            });
          }
          return next;
        });
      }),
      window.chenoot.on('clarification:needed', function (event) {
        setStates(function (previous) {
          const next = previous.slice();
          const index = event.number - 1;
          if (next[index]) {
            // This step finished but also stopped the process. Marking it as complete would
            // conflict with the message explaining that the process stopped.
            next[index] = Object.assign({}, next[index], { state: 'flagged' });
          }
          return next;
        });
      }),
      // Download state is kept at the root so progress remains visible wherever the
      // download started, even if that screen is closed.
      window.chenoot.on('backend:pull-progress', function (event) {
        setPullProgress(function (previous) {
          // The estimate uses the download rate measured so far rather than an
          // assumed speed.
          const now = Date.now();
          const started = previous && previous.startedAt ? previous.startedAt : now;
          const elapsed = (now - started) / 1000;
          let remaining = null;
          if (event.total > 0 && event.completed > 0 && elapsed > 3) {
            const rate = event.completed / elapsed;
            const left = Math.round((event.total - event.completed) / rate);
            remaining = left > 90
              ? Math.round(left / 60) + ' min'
              : Math.max(1, left) + ' sec';
          }
          return Object.assign({}, event, { startedAt: started, remaining });
        });
      }),
      window.chenoot.on('step:note', function (event) {
        setNotes(function (previous) {
          return previous.concat([event]).slice(-40);
        });
      }),
      window.chenoot.on('step:error', function (event) {
        setStates(function (previous) {
          const next = previous.slice();
          next[event.number - 1] = {
            state: 'error',
            summary: event.message,
            durationMs: event.durationMs
          };
          return next;
        });
        setError(event.message);
      })
    ];
    return function () {
      unsubscribers.forEach(function (off) { off(); });
    };
  }, []);

  // Elapsed time updates once per second while the process is active. Showing the
  // clock makes clear that a long step is still in progress rather than frozen.
  useEffect(function () {
    if (screen !== 'pipeline' || !startedAt) {
      return undefined;
    }
    const timer = setInterval(function () {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return function () { clearInterval(timer); };
  }, [screen, startedAt]);

  // The screen changes as soon as Start is pressed instead of waiting for the
  // process to finish. Because the work can take several minutes, leaving the
  // Start screen visible would make the button appear unresponsive.
  const start = useCallback(function (input) {
    setStates(initialStates());
    setError(null);
    setResult(null);
    setCancelling(false);
    setStartedAt(Date.now());
    setElapsedMs(0);
    setStepStartedAt(null);
    setNotes([]);
    setRunInput(input);
    setScreen('pipeline');

    window.chenoot.start(input).then(function (outcome) {
      if (outcome.status === 'complete') {
        setResult(outcome);
        setScreen('results');
      } else if (outcome.status === 'awaiting-clarification') {
        // The process paused because required information was missing and could not be
        // safely inferred. The requested information is shown so it can be added and
        // the process can continue.
        setClarify({ missing: outcome.missing || [], question: outcome.question });
        setScreen('clarify');
      } else if (outcome.status === 'error') {
        setError(outcome.message);
      } else if (outcome.status === 'canceled') {
        setScreen('input');
      }
      setCancelling(false);
    });
  }, []);

  // Cancel changes the button label immediately, while the main process finishes
  // the current step. Because the underlying model call cannot be interrupted,
  // the button needs to show that cancellation is already in progress.

  // Saving settings applies the theme and palette immediately rather than waiting
  // for the app to reload. This lets someone see the color changes while choosing
  // them.
  const saveSettings = useCallback(function (draft) {
    return window.chenoot.saveSettings(draft).then(function (outcome) {
      if (outcome.ok) {
        setSettings(outcome.settings);
        document.documentElement.dataset.mode = outcome.settings.theme;
        document.documentElement.dataset.palette = outcome.settings.palette;
        window.chenoot.backendStatus().then(setBackend);
      }
      return outcome;
    });
  }, []);

  // One model download path is shared by the model catalog in Setup so progress
  // and results are reported the same way everywhere.
  const pullModel = useCallback(function (model) {
    setPulling(model);
    setLastAttempt(model);
    setPullProgress({ phase: 'starting', detail: 'Contacting Ollama', fraction: null });
    window.chenoot.pullModel(model).then(function (outcome) {
      setPulling(null);
      // A successful download is stated directly rather than shown only by the progress
      // display disappearing. Otherwise, a completed download could look like one that
      // never started.
      //
      // After a model is downloaded, the main process saves it in Settings. The local
      // copy here is then out of date, so Settings is read again instead of being
      // edited here. Settings already knows whether the model belongs in the writing
      // or embedding field.
      setPullProgress(outcome && outcome.ok
        ? {
          phase: 'complete',
          detail: model + ' is installed',
          adopted: outcome.adopted || null,
          fraction: 1
        }
        : { phase: 'failed', detail: (outcome && outcome.detail) || 'Download failed', fraction: null });
      if (outcome && outcome.ok) {
        window.chenoot.getSettings().then(setSettings);
      }
      refreshBackend();
    });
  }, []);

  // Selecting a model that is already downloaded records the choice without
  // downloading it again. This is the same selection step used after a new model
  // finishes downloading.
  const useModel = useCallback(function (model, role) {
    const key = role === 'embedding' ? 'embeddingModel' : 'model';
    return window.chenoot.saveSettings({ [key]: model }).then(function (outcome) {
      if (outcome.ok) {
        setSettings(outcome.settings);
        refreshBackend();
      }
      return outcome;
    });
  }, []);

  // Keep the last known status visible while a new check is in progress.
  //
  // After the first load, replacing the status with a temporary checking message
  // caused the screen to flicker because Setup checks once per second while waiting.
  // Local checks finish quickly, so keeping the previous result visible gives a
  // steadier and more useful display.
  const refreshBackend = useCallback(function () {
    setBackend(function (current) {
      return current || { ready: false, state: 'checking', detail: 'Checking Ollama.' };
    });
    window.chenoot.backendStatus().then(setBackend);
  }, []);

  const cancel = useCallback(function () {
    setCancelling(true);
    window.chenoot.cancel();
  }, []);

  let body = null;

  if (screen === 'pipeline') {
    body = (
      <PipelineScreen
        steps={STEPS}
        states={states}
        stepStartedAt={stepStartedAt}
        notes={notes}
        onCancel={cancel}
        cancelling={cancelling}
        elapsedMs={elapsedMs}
        error={error}
      />
    );
  }

  // Results stays available even before anything has been created in the current
  // session. Keeping the destination in place prevents the navigation bar from
  // shifting and gives the empty screen room to explain what will appear there.
  else if (screen === 'results' && !result) {
    body = (
      <div className="screen screen-narrow">
        <p className="eyebrow">This run</p>
        <h1>Nothing built yet</h1>
        <p className="lede">
          What you create in this session appears here once it is finished and stays
          until you begin another questionnaire. Earlier work is saved under Past runs.
        </p>
        <div className="actions">
          <button className="primary" onClick={function () { setScreen('input'); }}>
            Build an instrument
          </button>
          <button onClick={function () { setScreen('history'); }}>Past runs</button>
        </div>
      </div>
    );
  }

  else if (screen === 'results' && result) {
    body = (
      <ResultsScreen
        result={result}
        steps={STEPS}
        onNewRun={function () {
          setStates(initialStates());
          setResult(null);
          setScreen('input');
        }}
        onHistory={function () { setScreen('history'); }}
        layout={settings ? (settings.resultsLayout || 'grouped') : 'grouped'}
        onLayout={settings ? function (next) {
          saveSettings(Object.assign({}, settings, { resultsLayout: next }));
        } : function () {}}
        onReview={function () { setScreen('input'); }}
        onRerun={runInput ? function () { start(runInput); } : null}
        // Adjustments to a finished instrument are made in the main process,
        // which holds the run. The screen hands back the rewritten instrument
        // and the copy kept here is replaced, otherwise the change is real on
        // disk and invisible on screen.
        onRerender={function (outcome) {
          if (outcome && outcome.instrument) {
            setResult(function (current) {
              return Object.assign({}, current, { instrument: outcome.instrument });
            });
          }
        }}
      />
    );
  }

  else if (screen === 'clarify' && clarify) {
    body = (
      <ClarifyScreen
        missing={clarify.missing}
        specification={draft.specification}
        onResume={function (merged) {
          const next = Object.assign({}, draft, { specification: merged });
          updateDraft(next);
          setClarify(null);
          start({
            construct: String(next.construct || '').trim(),
            population: merged.targetPopulation || '',
            purpose: merged.purpose || '',
            itemCount: Number(next.itemCount),
            relatedConstructs: [],
            specification: merged
          });
        }}
        onEdit={function (merged) {
          updateDraft(Object.assign({}, draft, { specification: merged }));
          setClarify(null);
          setScreen('input');
        }}
      />
    );
  }

  // Setup handles the Ollama download, while the model catalog handles model
  // downloads. Both use the same progress channel, so the root stores one shared
  // download state and each screen shows the part that belongs to its task.
  else if (screen === 'setup') {
    body = (
      <SetupScreen
        backend={backend}
        settings={settings}
        progress={pullProgress}
        busy={pulling === 'ollama'}
        pulling={pulling}
        lastAttempt={lastAttempt}
        onRefreshBackend={refreshBackend}
        onCancelPull={function () { window.chenoot.cancelPull(); }}
        onPullModel={pullModel}
        onUseModel={useModel}
        onPull={function () {
          setPulling('ollama');
          setPullProgress({ phase: 'starting', detail: 'Contacting the release feed', fraction: null });
          window.chenoot.runtimeInstall().then(function (outcome) {
            setPulling(null);
            setPullProgress(outcome && outcome.ok
              ? { phase: 'complete', detail: 'Ollama is installed and running', fraction: 1 }
              : { phase: 'failed', detail: (outcome && outcome.detail) || 'Setup failed', fraction: null });
            refreshBackend();
          });
        }}
      />
    );
  }

  else if (screen === 'formats') {
    body = (
      <div className="screen formats">
        <p className="eyebrow">Reference</p>
        <h1>Response formats</h1>
        <p className="lede">
          Every response format the app can use for a question. The image on each card shows what respondents will see.
          Open a card for an example, when the format works well, and when another choice may be better.
        </p>
        <FormatReference />
      </div>
    );
  }

  else if (screen === 'landing') {
    body = (
      <LandingScreen
        onEnter={function () { setScreen('input'); }}
        onFormats={function () { setScreen('formats'); }}
      />
    );
  }

  else if (screen === 'itemtypes') {
    body = (
      <div className="screen formats">
        <p className="eyebrow">Reference</p>
        <h1>Item types</h1>
        <p className="lede">
          How survey questions are described. A single question can have several features, including its response format,
          subtype, and role in the questionnaire. The examples at the bottom of the page show how they can all apply to
          the same question.
        </p>
        <ItemTypeReference />
      </div>
    );
  }

  else if (screen === 'help') {
    body = (
      <HelpScreen onWalkthrough={function () { setWalkthrough(true); }} />
    );
  }

  else if (screen === 'history') {
    body = (
      <HistoryScreen
          onOpen={function (runId) {
            window.chenoot.loadRun(runId).then(function (outcome) {
              if (!outcome.ok) {
                return;
              }
              // A saved questionnaire is loaded into the same data structure used for a newly
              // completed one, so the Results screen does not need to know where it came from.
              setResult(outcome);
              setRunInput(outcome.trail.input || null);
              setScreen('results');
            });
          }}
      />
    );
  }

  else {
    body = (
      <InputScreen
        steps={STEPS}
        returning={hasHistory}
        draft={draft}
        onDraftChange={updateDraft}
        onStart={start}
        backendReady={backend.ready}
        backendDetail={backend.detail}
        settings={settings}
        onOpenSettings={function () { setScreen('setup'); }}
      />
    );
  }

  // The main process continues working even if someone leaves the progress screen.
  // Navigation does not interrupt anything, and the current step remains available
  // as a way back.
  const running = states.some(function (state) { return state.state === 'running'; });

  return (
    <Shell
      screen={screen}
      running={running}
      settingsOpen={settingsOpen}
      appearanceOpen={appearanceOpen}
      onNavigate={function (destination) {
        // Settings opens over the current screen instead of replacing it. Closing
        // Settings returns someone to the same place they were before.
        if (destination === 'settings') {
          setSettingsOpen(true);
          return;
        }
        if (destination === 'appearance') {
          setAppearanceOpen(true);
          return;
        }
        setScreen(destination);
      }}
    >
      {/* One boundary around the screen, not around the shell. A screen that
          throws leaves the navigation working, so the way out is still there. */}
      <ScreenBoundary screen={screen} onLeave={function () { setScreen('landing'); }}>
        {body}
      </ScreenBoundary>
      {appearanceOpen && settings ? (
        <AppearanceScreen
          settings={settings}
          onClose={function () { setAppearanceOpen(false); }}
          onChange={function (change) {
            // The appearance change is applied to the document before it is saved, so the
            // window updates as soon as the option is clicked.
            const next = Object.assign({}, settings, change);
            document.documentElement.dataset.mode = next.theme;
            document.documentElement.dataset.palette = next.palette;
            saveSettings(next);
          }}
        />
      ) : null}
      {settingsOpen && settings ? (
        <SettingsScreen
          settings={settings}
          backend={backend}
          onRefreshBackend={refreshBackend}
          onReset={function () {
            // Everything the reset cleared on disk, cleared here too. The
            // specification lives in this component while the New screen is
            // mounted, so clearing only the file left the fields filled in.
            setDraft({ construct: '', itemCount: 20, specification: {} });
            setResult(null);
            setRunInput(null);
            // A download that was running or that failed belongs to the state
            // being cleared. Left in place, Setup goes on showing the progress
            // bar and the failure message from before the reset, against a
            // runtime that may no longer be installed.
            setPulling(null);
            setPullProgress(null);
            setLastAttempt(null);
            setStates(initialStates());
            window.chenoot.getSettings().then(setSettings);
            refreshBackend();
          }}
          onSave={saveSettings}
          onClose={function () { setSettingsOpen(false); }}
        />
      ) : null}
      {walkthrough ? (
        <Walkthrough
          onGoToModels={function () { setScreen('setup'); }}
          onFinish={function () {
          setWalkthrough(false);
          if (settings) {
            saveSettings(Object.assign({}, settings, { walkthroughSeen: true }));
          }
        }} />
      ) : null}
    </Shell>
  );
}

createRoot(document.getElementById('root')).render(<App />);
