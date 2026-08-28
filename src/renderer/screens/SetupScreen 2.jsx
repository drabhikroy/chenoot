import { useEffect, useState } from 'react';
import { DownloadNotice } from '../components/DownloadNotice.jsx';
import { ModelChooser } from '../components/ModelChooser.jsx';

// 'Setup' tab.
//
// Has two steps with a check between them.
//
// Someone new to local language models needs both Ollama and a model, but may
// not know that or which comes first. Showing two numbered steps with a clear
// result after each makes that order visible without requiring prior knowledge.
//
// The first steps can end in three ways. If Ollama is already installed and
// running, nothing more is needed. If it is missing on a supported platform,
// the app can install it. On platforms where the app cannot manage installation,
// Setup explains this and points to the manual instructions instead of offering
// a button that would fail. points at the manual
// route, and not offering a button that would fail.

// Each symbol is paired with a word. The label makes the meaning clear without
// relying on the symbol alone.
function Check({ done, children }) {
  return (
    <span className={'setup-check' + (done ? ' done' : '')}>
      <span className="setup-check-mark" aria-hidden="true">{done ? '\u2713' : ''}</span>
      {children}
    </span>
  );
}

// Refresh checks two separate things: whether Ollama is responding on this
// computer and whether the required models are installed. Either can be ready
// while the other is not.
export function SetupScreen({
  backend, settings, progress, busy, pulling, lastAttempt,
  onPull, onPullModel, onUseModel, onCancelPull, onRefreshBackend
}) {
  const [state, setState] = useState(null);
  const [notice, setNotice] = useState(null);
  const [removing, setRemoving] = useState(false);

  function refresh() {
    window.chenoot.runtimeStatus().then(setState);
    onRefreshBackend();
  }

  useEffect(refresh, []);

  // Setup checks again every second while something is still incomplete.
  //
  // Checking only when the screen opened meant an installation could finish
  // while the screen continued to say "not yet." That could make the app appear
  // stuck. A single later check still depended on guessing how long installation
  // would take.
  //
  // Both checks stay on this computer, so checking every second adds little
  // overhead and keeps the screen current. The timer stops once both steps
  //
  // are complete.
  const settled = Boolean(state && state.reachable) && Boolean(backend && backend.ready);
  useEffect(function () {
    if (settled && !busy && !pulling) {
      return undefined;
    }
    const timer = setInterval(refresh, 1000);
    return function () { clearInterval(timer); };
  }, [settled, busy, pulling]);

  if (!state) {
    return <div className="screen"><p className="field-hint">Checking.</p></div>;
  }

  const runtimeReady = state.reachable;
  const modelsReady = Boolean(backend && backend.ready);

  return (
    <div className="screen screen-narrow setup">
      <p className="eyebrow">Setup</p>
      <h1 className="title-display">Two things to get going</h1>
      <p className="lede">
        You will need to download two items to get started: a program that handles processing locally
        and a model for it to use. Both are stored within the app, and each only needs to be set up once.
      </p>

      {/* ---- Step one ---- */}
      <section className={'setup-step' + (runtimeReady ? ' complete' : ' current')}>
        <div className="setup-step-head">
          <span className="setup-number">1</span>
          <h2>The program that runs models</h2>
          <Check done={runtimeReady}>{runtimeReady ? 'Ready' : 'Not yet'}</Check>
        </div>

        {runtimeReady ? (
          <p className="help-para">
            Ollama is running{state.source === 'managed'
              ? ', started by this application from its own folder.'
              : ' on this machine already, so this application is using it instead of adding a second copy.'}
          </p>
        ) : state.supported ? (
          <>
            <p className="help-para">
                Ollama lets models run directly on your machine. A single copy of Ollama is downloaded into this
                application’s folder and started when needed. Nothing is installed system-wide. If you no longer
                want it, click Remove to delete it.
            </p>
            <div className="actions">
              <button
                className="primary"
                disabled={busy}
                onClick={function () { setNotice(state.notice); }}
              >
                {busy ? 'Downloading' : 'Set it up for me'}
              </button>
              <button onClick={function () { window.open('https://ollama.com/download', '_blank'); }}>
                I will install it myself
              </button>
            </div>
            {/* Installation reports four phases separately. Downloading can take
                minutes, verification is quick, and unpacking can take several
                seconds. Separate phases prevent a progress bar from sitting at
                100% while more work is still happening. */}
            {progress ? (
              <div className="pull">
                <p className="value">{progress.detail || progress.phase}</p>
                <span className="pull-track" aria-hidden="true">
                  <span
                    className={'pull-fill' +
                      (progress.fraction === null ? ' pull-indeterminate' : '') +
                      (progress.phase === 'complete' ? ' pull-done' : '')}
                    style={progress.fraction === null ? undefined : { width: (progress.fraction * 100) + '%' }}
                  />
                </span>
                {/* Starting Ollama is shown as its own phase. Previously, unpacking
                    appeared complete even though Ollama still had to start and
                    respond. Showing this final wait, including the elapsed time,
                    makes clear that work is still in progress. */}
                <p className={progress.phase === 'failed' ? 'field-error' : 'field-hint'}>
                  {progress.phase === 'failed' ? progress.detail
                    : progress.phase === 'complete' ? 'Installed and answering.'
                    : progress.phase === 'starting'
                      ? 'Starting Ollama. This takes a few seconds' +
                        (progress.elapsedSeconds > 3 ? ', ' + progress.elapsedSeconds + ' so far' : '') + '.'
                    : progress.phase === 'unpacked' ? 'Unpacked.'
                    : progress.total
                      ? Math.round(progress.completed / 1048576) + ' of ' +
                        Math.round(progress.total / 1048576) + ' MB' +
                        (progress.remaining ? ' \u00B7 about ' + progress.remaining + ' left' : '')
                      : 'Working'}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          // Explain why no button is available instead of showing a control
          // that cannot work.
          <p className="help-para">
                This application cannot manage Ollama on {state.platform}. However, you can install it
                yourself from ollama.com/download. Once it is running, it will be detected automatically.
          </p>
        )}
      </section>

      {/* Step two remains visible while step one is incomplete, but appears dimmed.
          Showing it in advance lets people see what comes next before they begin. */}
      {/* ---- Step two ---- */}
      <section className={'setup-step' + (modelsReady ? ' complete' : runtimeReady ? ' current' : ' waiting')}>
        <div className="setup-step-head">
          <span className="setup-number">2</span>
          <h2>A model for it to run</h2>
          <Check done={modelsReady}>{modelsReady ? 'Ready' : 'Not yet'}</Check>
        </div>

        {runtimeReady ? (
          <>
            {modelsReady ? (
              // Show the selected model by name. When several models are
              // installed, people need to know which one the app will use.
              <p className="help-para">
                Ready to build. Writing with{' '}
                <span className="value">{settings ? settings.model : 'the installed model'}</span>,
                duplicate checking with{' '}
                <span className="value">{settings ? settings.embeddingModel : 'an embedding model'}</span>.
              </p>
            ) : (
              <p className="help-para">
                  Each model is a separate download of a few gigabytes. Choose one below.
                  If your system details are available, you will also see how well each option
                  should run on your machine.
              </p>
            )}

            {/* The model chooser stays in Setup because choosing a model is the
                second step. Sending people to another screen would break the
                two-step sequence shown here. */}
            <ModelChooser
              pulling={pulling}
              progress={progress}
              lastAttempt={lastAttempt}
              onPull={onPullModel}
              onUseModel={onUseModel}
              onRemoved={onRefreshBackend}
              onCancelPull={onCancelPull}
            />
          </>
        ) : busy || (progress && progress.phase === 'starting') ? (
          // This message fills the brief gap after the first step finishes and
          // before the second becomes available. Without it, the panel could
          // appear inactive with no explanation.
          <p className="field-hint setup-waiting">
            <span className="setup-pip" aria-hidden="true" />
            Opens as soon as Ollama answers.
          </p>
        ) : (
          <p className="field-hint">Available once the first step is done.</p>
        )}
      </section>

      {state.managedInstalled ? (
        <section className="setup-manage">
          <h2>What is stored here</h2>
          <p className="help-para">
            Ollama stays in this application{'\u2019'}s folder, so it is ready the next time
            you use it. Models are stored separately and remain on your machine, where other
            compatible programs can use them too if permitted.
          </p>
          <div className="actions">
            {removing ? (
              <span className="confirm-pair">
                <button className="primary" onClick={function () {
                  window.chenoot.runtimeRemove({ includeModels: false }).then(function () {
                    setRemoving(false);
                    refresh();
                  });
                }}>Remove the runtime</button>
                <button onClick={function () {
                  window.chenoot.runtimeRemove({ includeModels: true }).then(function () {
                    setRemoving(false);
                    refresh();
                  });
                }}>Remove runtime and models</button>
                <button onClick={function () { setRemoving(false); }}>Keep</button>
              </span>
            ) : (
              <button onClick={function () { setRemoving(true); }}>Remove what was downloaded</button>
            )}
          </div>
        </section>
      ) : null}

      {notice ? (
        <DownloadNotice
          target={notice}
          onCancel={function () { setNotice(null); }}
          onAccept={function () {
            setNotice(null);
            onPull();
          }}
        />
      ) : null}
    </div>
  );
}
