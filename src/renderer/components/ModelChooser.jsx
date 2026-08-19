import { useEffect, useState } from 'react';
import { DownloadNotice } from './DownloadNotice.jsx';
import { MemoryFit } from './MemoryFit.jsx';

// The model list, as a component, not a screen.
//
// It was a destination of its own, which made Setup a two step sequence whose
// second step was a link somewhere else. Step two is choosing a model, so the
// chooser belongs inside it, and the same component still backs the standalone
// screen for anyone who wants to change models later without going through
// setup again.

// Three bands, not a yes or no. The middle one is the honest case: a
// model at exactly its stated minimum runs and makes the machine unpleasant
// while it does, and calling that supported would be a half truth.
const BAND_LABEL = {
  comfortable: 'Runs comfortably',
  tight: 'Runs, but tight',
  insufficient: 'Not enough memory',
  unknown: 'Fit unknown'
};

// The permission request. It lists what will be read before offering the button
// that reads it, and says what refusing costs, because a request that explains
// only the benefit is not a request.
function Consent({ reads, onGrant, onSkip }) {
  return (
    <div className="consent">
      <p className="help-para">
        To say which of these your machine can run, the application can read a few
        specifications. It has not read anything yet.
      </p>
      <ul className="consent-list">
        {reads.map(function (item) { return <li key={item}>{item}</li>; })}
      </ul>
      <p className="help-para">
        That is the whole list. No identifiers, nothing about your files or your network. It
        stays on this machine and you can revoke it at any time, which discards the reading
        never only stopping further ones.
      </p>
      <div className="actions">
        <button className="primary" onClick={function () { onGrant(true); }}>
          Check my machine
        </button>
        <button onClick={onSkip}>Skip this</button>
      </div>
    </div>
  );
}

// Consent can be skipped and not only granted. Someone who does not want
// their machine read should not be asked twice on the same screen, and the
// catalog is fully usable without it.
export function ModelChooser({
  pulling, progress, lastAttempt, onPull, onUseModel, onRemoved, onCancelPull
}) {
  // Confirmation is per card, not a dialog, because a dialog for a reversible
  // action the person just asked for is a speed bump that teaches people to
  // click through dialogs.
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);
  const [state, setState] = useState(null);
  const [reads, setReads] = useState([]);
  const [pending, setPending] = useState(null);
  const [agreed, setAgreed] = useState({});
  const [skipped, setSkipped] = useState(false);

  // Re-read after a download settles, not on a timer, so a freshly
  // installed model stops being offered as something to install.
  function refresh() {
    window.chenoot.modelCatalog().then(setState);
  }

  useEffect(function () {
    window.chenoot.machineDisclosure().then(function (outcome) { setReads(outcome.reads || []); });
    refresh();
  }, []);

  // Re-read once a download settles, so a freshly installed model stops being
  // offered as something to install.
  useEffect(function () {
    if (pulling) {
      return undefined;
    }
    const settle = setTimeout(refresh, 800);
    return function () { clearTimeout(settle); };
  }, [pulling]);

  function consent(granted) {
    window.chenoot.machineConsent(granted).then(refresh);
  }

  // The notice is shown once per model and the answer remembered. A dialog that
  // reappears on every download stops being read on the second showing.
  function request(model) {
    if (agreed[model.id]) {
      onPull(model.id);
      return;
    }
    setPending(model);
  }

  // Nothing is rendered until the catalog arrives. Showing an empty list first
  // would read as no models being available, which is the opposite of true.
  if (!state) {
    return <p className="field-hint">Reading the catalog.</p>;
  }

  const generation = state.models.filter(function (m) { return m.role === 'generation'; });
  const embedding = state.models.filter(function (m) { return m.role === 'embedding'; });

// Strengths and weaknesses are behind a disclosure. They are the reason to
// choose one model over another and they are also four lines each, which turned
// a list of ten into a page nobody finished.
  function Card(model) {
    const suggested = state.suggestion &&
      ((state.suggestion.generation && state.suggestion.generation.id === model.id) ||
       (state.suggestion.embedding && state.suggestion.embedding.id === model.id));
    const active = pulling === model.id || lastAttempt === model.id;
    // Three states and not one button that always says the same thing.
    const installed = Boolean(model.installed);
    const inUse = Boolean(model.inUse);

    return (
      <article
        className={'model-card band-' + model.fit.band +
          (inUse ? ' in-use' : '') + (installed ? ' installed' : '')}
        key={model.id}
      >
        <header className="model-head">
          <div>
            <h3>{model.label}</h3>
            <p className="model-id value">{model.id}</p>
          </div>
          <div className="model-badges">
            {/* In use means installed and selected, which are two facts and were
                being reported as one. A model named in settings but absent from
                the machine wore the same badge as one actually running, so the
                default that ships with the application announced itself as in
                use on a machine where nothing had been downloaded at all. */}
            {inUse && installed ? <span className="model-badge in-use">In use</span>
              : inUse ? <span className="model-badge wanted">Selected, missing</span>
              : installed ? <span className="model-badge installed">Installed</span>
              : suggested ? <span className="model-badge suggested">Suggested</span>
              : null}
            <span className={'model-badge fit-' + model.fit.band}>{BAND_LABEL[model.fit.band]}</span>
          </div>
        </header>

        <dl className="model-spec">
          <div><dt>Size</dt><dd className="value">{model.diskGb} GB</dd></div>
          <div><dt>Memory</dt><dd className="value">{model.memoryGb} GB</dd></div>
          <div><dt>Parameters</dt><dd className="value">{model.parameters}</dd></div>
        </dl>

        {/* The fit band, made visible. Two words describing a memory
            requirement are hard to compare across ten cards; two bars are not. */}
        <MemoryFit
          needs={model.memoryGb}
          available={state.machine ? state.machine.memoryGb : null}
          band={model.fit.band}
        />

        <details className="model-detail">
          <summary>
            <span className="disclosure" aria-hidden="true" />
            What it is good and bad at
          </summary>
          <p><span className="model-label">Does well</span> {model.strengths}</p>
          <p><span className="model-label">Struggles</span> {model.weaknesses}</p>
          <p className="model-note">{model.fit.note}</p>
        </details>

        {/* What the button offers follows from what is already true. Downloaded
            and chosen needs no action at all, downloaded and not chosen is one
            click with nothing to fetch, and neither is a download. */}
        <div className="actions">
          {/* What is on the machine decides what the card offers. This asked
              whether the model was selected first, so the one named in the
              default settings showed as running and offered nothing to click:
              no download, on the screen whose only purpose is downloading. The
              first model anyone would reach for was the one they could not
              get. */}
          {!installed ? (
            <button
              className={model.fit.band === 'insufficient' ? '' : 'primary'}
              onClick={function () { request(model); }}
              disabled={Boolean(pulling)}
            >
              {pulling === model.id ? 'Downloading' : 'Download'}
            </button>
          ) : (
            <>
              {inUse ? (
                <p className="model-current">
                  <span className="model-current-mark" aria-hidden="true">{'\u2713'}</span>
                  This is the model the pipeline runs.
                </p>
              ) : null}
              {inUse ? null : (
                <button
                  className="primary"
                  onClick={function () {
                    // The catalog is re-read once the choice is saved, so the
                    // badge moves to this card immediately. Without it the
                    // change was real and invisible until something else
                    // happened to refresh.
                    const saved = onUseModel(model.id, model.role);
                    if (saved && saved.then) { saved.then(refresh); }
                  }}
                >
                  Use this one
                </button>
              )}
              {/* Downloading was a button and undoing it was a terminal
                  command. Someone comparing two models on their own machine
                  should be able to reclaim the nine gigabytes of the one they
                  rejected without leaving the application. */}
              {removing === model.id ? (
                <span className="confirm-pair">
                  <button
                    onClick={function () {
                      setRemoveError(null);
                      window.chenoot.removeModel(model.id).then(function (outcome) {
                        setRemoving(null);
                        if (!outcome.ok) {
                          setRemoveError({ id: model.id, detail: outcome.detail });
                        }
                        refresh();
                        if (onRemoved) { onRemoved(); }
                      });
                    }}
                  >
                    Remove {model.diskGb} GB
                  </button>
                  <button onClick={function () { setRemoving(null); }}>Keep it</button>
                </span>
              ) : (
                <button onClick={function () { setRemoving(model.id); }}>Remove</button>
              )}
              {/* Said before the second click, not after the model is gone.
                  Removing the one in use is allowed, and what it costs is that
                  the pipeline needs another one before it can run. */}
              {removing === model.id && inUse ? (
                <p className="field-hint">
                  The pipeline uses this one. Removing it leaves nothing selected
                  unless another is installed.
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Shown while downloading and after it ends, since a failure clears the
            downloading flag at the same moment it sets the message.

            A finished download is its own block, not the working one
            with different words in it. The two lines of the progress readout
            both printed the same sentence on completion, so success arrived
            twice and the bar underneath still looked like something in
            motion. */}
        {removeError && removeError.id === model.id ? (
          <p className="field-error">{removeError.detail}</p>
        ) : null}

        {active && progress && progress.phase === 'complete' ? (
          <p className="pull-settled state-complete">
            <span className="pull-settled-mark" aria-hidden="true">{'\u2713'}</span>
            {progress.adopted
              ? 'Downloaded, and now the ' +
                (progress.adopted.key === 'embeddingModel' ? 'embedding' : 'writing') +
                ' model.'
              : 'Downloaded and ready.'}
          </p>
        ) : active && progress ? (
          <div className="pull">
            <p className="value">{progress.detail || progress.phase}</p>
            <span className="pull-track" aria-hidden="true">
              <span
                className={'pull-fill' +
                  (progress.fraction === null ? ' pull-indeterminate' : '')}
                style={progress.fraction === null ? undefined : { width: (progress.fraction * 100) + '%' }}
              />
            </span>
            <p className={progress.phase === 'failed' ? 'field-error' : 'field-hint'}>
              {progress.phase === 'failed'
                ? progress.detail
                : progress.total
                  ? Math.round(progress.completed / 1048576) + ' of ' +
                    Math.round(progress.total / 1048576) + ' MB' +
                    (progress.remaining ? ' \u00B7 about ' + progress.remaining + ' left' : '')
                  : 'Working'}
            </p>
            {pulling === model.id ? (
              <div className="actions">
                <button onClick={onCancelPull}>Stop</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="model-chooser">
      {state.consent ? (
        <p className="field-hint machine-line">
          This machine reports {state.machine.memoryGb} GB of memory, {state.machine.cores} cores,
          {' '}{state.machine.architecture}.
          <button className="link-button" onClick={function () { consent(false); }}>
            Forget this
          </button>
        </p>
      ) : skipped ? null : (
        <Consent reads={reads} onGrant={consent} onSkip={function () { setSkipped(true); }} />
      )}

      {/* Two roles, labeled, because someone new to this has no reason to
          know that two different kinds of model are needed or which is which. */}
      <p className="export-row-label">Writing model</p>
      <div className="model-grid">{generation.map(Card)}</div>

      <p className="export-row-label">Embedding model</p>
      <p className="field-hint">
        Powers the duplicate check. Without one that check is skipped and everything else runs.
      </p>
      <div className="model-grid">{embedding.map(Card)}</div>

      {pending ? (
        <DownloadNotice
          target={pending.notice}
          onCancel={function () { setPending(null); }}
          onAccept={function () {
            setAgreed(Object.assign({}, agreed, { [pending.id]: true }));
            onPull(pending.id);
            setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
