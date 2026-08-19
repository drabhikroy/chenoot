import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Modal } from '../components/Modal.jsx';

// 'Settings' tab.
//
// These are saved across runs, so they only need to be entered once.
// That is why the main input screen has just four fields.

// The four color sets match those defined in palettes.js. Only their labels are
// repeated here. The color values stay in one place and reach this screen through
// the generated stylesheet.
//
// These three sections all change what the process produces. Appearance has its
// own section because it does not affect the result. Keeping it separate makes
// the settings easier to understand.
const SECTIONS = [
  { id: 'backend', label: 'Model', hint: 'Where the pipeline gets its model' },
  { id: 'items', label: 'Item standards', hint: 'What counts as an acceptable item' },
  { id: 'grounding', label: 'Grounding', hint: 'Recalled reference scales' },
  // Its own section, at the end. Reset was the last block inside Model, three
  // screens down past the address and the item standards, which is a strange
  // place for the one control that undoes everything above it.
  { id: 'reset', label: 'Start over', hint: 'Put every setting back' }
];

// Backend states are given plain-language labels here. The detail text explains
// what happened and what to do next, while this label gives people something
// quick to scan.
//
// Every state currently reported by the backend has a label. If a new state is
// added without one, the interface shows its original hyphenated name instead.
// That fallback is how the four failure states below were caught during testing.
const STATE_WORD = {
  ready: 'Ready',
  unreachable: 'Not responding',
  'bad-address': 'Address wrong',
  timeout: 'Not answering',
  faulted: 'Answering badly',
  'model-missing': 'Model missing',
  'no-key': 'No API key',
  checking: 'Checking',
  error: 'Error'
};

// The model field lists what is actually installed on the computer. There was
// also no indication of which names were valid. The field now lists every
// model reported by Ollama, with an option to enter a name manually if needed.
// This applies only to local models. Remote providers may offer models the app
// cannot list, so their model field remains a text box.
function ModelField({ id, label, value, installed, hint, placeholder, onChange }) {
  // Typing is optional. The list handles the usual case, while manual entry remains
  // available when needed. If the saved value is not in the list, the field opens
  // in manual-entry mode so it is not silently replaced with another option.
  const known = (installed || []).indexOf(value) !== -1;
  const [typing, setTyping] = useState(!known && Boolean(value));

  const options = (installed || []).slice();
  // If a saved model is no longer installed, it still appears in the list and is
  // marked as unavailable. Hiding it could make the control appear to use a
  // different model from the one actually saved.
  if (value && options.indexOf(value) === -1) {
    options.unshift(value);
  }

  if (typing || options.length === 0) {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          value={value || ''}
          placeholder={placeholder}
          onChange={function (e) { onChange(e.target.value); }}
        />
        <span className="field-hint">{hint}</span>
        {options.length > 0 ? (
          <button className="link-button" onClick={function () { setTyping(false); }}>
            Choose from what is installed
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value || ''} onChange={function (e) { onChange(e.target.value); }}>
        {options.map(function (name) {
          return (
            <option key={name} value={name}>
              {name + ((installed || []).indexOf(name) === -1 ? ' (not installed)' : '')}
            </option>
          );
        })}
      </select>
      <span className="field-hint">{hint}</span>
      <button className="link-button" onClick={function () { setTyping(true); }}>
        Type a name instead
      </button>
    </div>
  );
}

// Edits are held in a draft and committed on Save, not applied on every
// keystroke. A half-typed model name written straight to disk would leave the
// backend unreachable between two characters.
export function SettingsScreen({
  settings, backend, onSave, onRefreshBackend, onReset, onClose
}) {
  // Tracks which section is open. This choice is not saved between visits. Someone
  // returning right away may want the same section, but that is less likely later.
  // The first section opens by default because it contains settings that can keep
  // the app from working if they are incorrect.
  const [section, setSection] = useState('backend');
  const [draft, setDraft] = useState(settings);
  const [saveState, setSaveState] = useState(null);
  const [measures, setMeasures] = useState([]);
  const [resetting, setResetting] = useState(false);

  useEffect(function () {
    window.chenoot.readabilityMeasures().then(function (outcome) {
      setMeasures(outcome.measures || []);
    });
  }, []);

  // A copy of the settings as they appeared when this screen opened, so Cancel can
  // restore them. It stays unchanged even if settings are saved and edited again
  // without leaving the screen.
  const [pristine] = useState(settings);

  // One updater handles every field by name instead of giving each input its own
  // handler. Repeating nearly identical handlers makes small errors easier to miss.
  function update(key, value) {
    setDraft(Object.assign({}, draft, { [key]: value }));
  }

  function save() {
    setSaveState('working');
    onSave(draft).then(function (outcome) {
      setSaveState(outcome.ok ? 'saved' : outcome.detail);
    });
  }

  const status = backend || { state: 'error', detail: 'Status unknown.', ready: false };
  // The models reported by Ollama, grouped by what each one does.
  const installed = status.installed || [];
  const embeddingInstalled = installed.filter(function (name) { return /embed/i.test(name); });
  const writingInstalled = installed.filter(function (name) { return !/embed/i.test(name); });
  // The interface shows only the options the backend reports as available, rather
  // than checking the provider name in several different places.
  const can = status.capabilities || { pull: false, embed: false };

  // Models are downloaded in Setup, where the catalog also shows what each one
  // requires to run. A duplicate download control was removed from this screen
  // because it called a state setter that is not available here and would have
  // failed when clicked. The problem went unnoticed because nothing used it.

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      footer={
        <>
          <button className="primary" onClick={save} disabled={saveState === 'working'}>
            {saveState === 'working' ? 'Saving' : 'Save changes'}
          </button>
          <button
            onClick={function () { setDraft(pristine); setSaveState(null); }}
            disabled={saveState === 'working'}
          >
            Discard changes
          </button>
          <button onClick={onClose}>Close</button>
          {saveState === 'saved' ? <span className="field-hint state-complete">Saved.</span> : null}
          {saveState && saveState !== 'saved' && saveState !== 'working'
            ? <span className="field-error">{saveState}</span>
            : null}
        </>
      }
    >
      {/* A side rail works better than tabs across the top. The four labels
          and their short descriptions are easier to scan when stacked, and
          the panel keeps its full width for the settings. */}
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          {SECTIONS.map(function (item) {
            return (
              <button
                key={item.id}
                className={'settings-tab' + (section === item.id ? ' current' : '')}
                onClick={function () { setSection(item.id); }}
                aria-current={section === item.id ? 'true' : undefined}
              >
                <span className="settings-tab-label">{item.label}</span>
                <span className="settings-tab-hint">{item.hint}</span>
              </button>
            );
          })}
        </nav>
        <div className="settings-panel">

        {/* Backend status appears first because it is the only setting here that
            can keep the app from working. Each failure state has a different fix:
            install Ollama, start it, or download a model. */}
      {section === 'backend' ? (
      <section className="group">
      <h2>Backend</h2>
      <div className="group-body">
        {/* The edge, symbol, and label all communicate the same state. Using
            three cues means the status remains clear even without color and can
            be recognized from a distance. */}
      <div className={'backend-status ' + (status.ready ? 'ready' : 'faulted')}>
        <span className={'backend-mark state-' + (status.ready ? 'complete' : 'error')} aria-hidden="true">
          {status.ready ? '\u2713' : '\u2715'}
        </span>
        <span className="backend-name">
          {draft.backend === 'ollama' ? 'Ollama' : 'Remote API'}
        </span>
        <span className={'backend-state value state-' + (status.ready ? 'complete' : 'error')}>
          {STATE_WORD[status.state] || status.state}
        </span>
        <p className="backend-detail">{status.detail}</p>
        {/* Keep the button inside the status box because it acts on the
            information shown there. Placing it below would make it look like
            a control for the entire section. */}
        <button className="backend-recheck" onClick={onRefreshBackend}>Check again</button>
      </div>
      {(status.missing || []).length > 0 ? (
        <p className="field-hint">
          {(status.missing || []).join(' and ')} {(status.missing || []).length === 1
            ? 'is not installed'
            : 'are not installed'}. Setup lists what each one costs to run and downloads
          them.
        </p>
      ) : null}

      {/* Switching to a remote API means some data leaves the computer, so this
          is shown as a warning rather than a hint. Privacy is likely one reason
          people choose this app, and this setting changes that behavior. */}
      <div className="field medium">
        <label htmlFor="backend">Mode</label>
        <select
          id="backend"
          value={draft.backend}
          onChange={function (e) { update('backend', e.target.value); }}
        >
          <option value="ollama">Local model via Ollama</option>
          <option value="api">Remote API</option>
        </select>
        {draft.backend === 'api' ? (
          <span className="field-error">
            In this mode, what you are measuring, the questions, and any context
            you provide are sent to the selected provider. Only the results remain
            on your computer.
          </span>
        ) : (
          <span className="field-hint">Nothing leaves this machine.</span>
        )}
      </div>

      {/* Fields for the other backend are hidden instead of disabled. This keeps
          the screen focused on the settings that can actually be used. */}
      {draft.backend === 'ollama' ? (
        <div className="field">
          <label htmlFor="host">Ollama address</label>
          <input id="host" value={draft.host} onChange={function (e) { update('host', e.target.value); }} />
        </div>
      ) : (
        <>
          <div className="field medium">
            <label htmlFor="provider">Provider</label>
            <select
              id="provider"
              value={draft.apiProvider}
              onChange={function (e) { update('apiProvider', e.target.value); }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI or compatible</option>
            </select>
            {draft.apiProvider === 'anthropic' ? (
              <span className="field-hint">
                Anthropic does not offer an embeddings service, so the redundancy
                check in step 6 is skipped in this mode. The coverage check still runs.
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="apikey">API key</label>
            <input
              id="apikey"
              type="password"
              placeholder={settings.hasApiKey ? 'A key is saved' : 'Not set'}
              onChange={function (e) { update('apiKey', e.target.value); }}
            />
            {/* The saved key is never shown on this screen. Instead, the field
                only indicates whether one is already saved. Leaving it blank
                keeps the current key unchanged. */}
            <span className="field-hint">
              Stored in your system keychain and sent only to the selected
              provider. Leave this field blank to keep the saved key.
            </span>
          </div>

          <div className="field">
            <label htmlFor="baseurl">Endpoint override</label>
            <input
              id="baseurl"
              value={draft.apiBaseUrl || ''}
              placeholder="Leave empty for the provider default"
              onChange={function (e) { update('apiBaseUrl', e.target.value); }}
            />
            <span className="field-hint">
              For gateways and self-hosted services that use the OpenAI chat completions format.
            </span>
          </div>
        </>
      )}

      {/* Downloading a model in Setup saves the selection here, so this field
          usually shows a choice already made. Use it to switch models when
          more than one is installed. */}
      {draft.backend === 'ollama' ? (
        <ModelField
          id="model"
          label="Writing model"
          value={draft.model}
          installed={writingInstalled}
          hint={installed.length > 0
            ? 'Every model Ollama holds on this machine. Downloading one in Setup selects it here.'
            : 'Nothing is installed yet. Setup downloads a model and selects it.'}
          onChange={function (next) { update('model', next); }}
        />
      ) : (
        <div className="field">
          <label htmlFor="model">Model</label>
          <input id="model" value={draft.model} onChange={function (e) { update('model', e.target.value); }} />
          <span className="field-hint">
            Choose a model name recognized by the provider, such as claude-sonnet-4-5 or gpt-4o-mini.
          </span>
        </div>
      )}

      {can.embed ? (
        <ModelField
          id="embed"
          label="Embedding model"
          value={draft.embeddingModel}
          installed={embeddingInstalled}
          hint="Used only for the duplicate check. If none is selected, that check is skipped."
          onChange={function (next) { update('embeddingModel', next); }}
        />
      ) : null}

      {/* The independent critic gets a fuller explanation because it is the most
          useful optional setting and its purpose may not be clear from the name alone. */}
      <div className="field">
        <label htmlFor="critic">Critique model</label>
        <input
          id="critic"
          value={draft.critiqueModel}
          placeholder="Leave empty to reuse the model above"
          onChange={function (e) { update('critiqueModel', e.target.value); }}
        />
        {installed.length > 1 ? (
          <span className="field-hint">
            Installed here: {installed.join(', ')}.
          </span>
        ) : null}
        <span className="field-hint">
          When the same model reviews its own work, it may miss problems because it
          follows the same reasoning used to create the content. Choosing a second
          model adds one extra model run and provides a more independent review.
        </span>
      </div>

      </div>
      </section>
      ) : null}

      {section === 'reset' ? (
      <section className="group">
      <h2>Start over</h2>
      <div className="group-body">
        <p className="help-para">
          This returns every setting to its original default. Your model selection, connection
          address, item standards, and appearance settings are all reset. Any information saved
          on the New screen is also cleared.
        </p>
        <p className="help-para">
          Nothing you have created is removed. Every finished questionnaire stays under Past runs
          unless you choose to delete those too. Ollama and any downloaded models also remain on your
          computer and can be removed from Setup if you want to free up space.
        </p>
        <div className="actions">
          <button onClick={function () { setResetting(true); }}>Reset the application</button>
        </div>
      </div>
      </section>
      ) : null}

      {resetting ? (
        <ConfirmDialog
          title="Reset the application"
          body={
            'Every setting goes back to the value it had on a first launch. Nothing else is ' +
            'touched unless you ask for it below. None of this can be undone.'
          }
          points={{
            does: [
              'Model choice, address, and API key.',
              'Item standards and grounding options.',
              'Appearance, palette, and the walkthrough.',
              'The specification currently saved on the New screen.'
            ],
            keeps: [
              'Every finished instrument under Past runs, unless asked below.',
              'Ollama and the downloaded models, unless asked below.',
              'Anything you have already exported to a file, wherever you saved it.'
            ]
          }}
          options={[
            {
              id: 'includeRuns',
              label: 'Delete every past run',
              hint: 'Every instrument and audit trail stored on this machine. Files you have already exported are not affected.'
            },
            {
              id: 'includeModels',
              label: 'Delete the downloaded models',
              hint: 'Several gigabytes. They are shared with anything else on this machine using Ollama, so this removes them for those programs too.'
            },
            {
              id: 'includeRuntime',
              label: 'Remove Ollama itself',
              hint: 'The copy in this application\u2019s folder. Setup can fetch it again.'
            }
          ]}
          confirmLabel="Reset"
          onConfirm={function (choice) {
            return window.chenoot.resetApp(choice).then(function (result) {
              if (!result.ok) {
                return { ok: false, detail: result.detail };
              }
              // The saved specification is gone from disk, so the screen holding
              // a copy of it is told to drop that copy. Without this the New
              // screen goes on showing what was typed before the reset.
              if (onReset) {
                onReset();
              }
              const extras = [];
              if (choice.includeRuns) {
                extras.push(result.runsRemoved + ' runs deleted');
              }
              if (choice.includeModels) {
                extras.push('models removed');
              }
              if (choice.includeRuntime) {
                extras.push('Ollama removed');
              }
              return {
                ok: true,
                detail: 'Settings are back to their defaults' +
                  (extras.length > 0 ? ', ' + extras.join(', ') : '') + '.'
              };
            });
          }}
          onClose={function () { setResetting(false); }}
        />
      ) : null}

      {/* These two settings directly affect the checks used in Step 4, so
          changing them can change which items are flagged. */}
      {section === 'items' ? (
      <section className="group">
      <h2>Item standards</h2>
      <div className="group-body">
        {/* Choose the reading formula before setting the cutoff. A score of eight
            can mean different things under different formulas, so the number below
            only makes sense once the formula is selected. */}
      <div className="field">
        <label htmlFor="measure">Readability measure</label>
        <select
          id="measure"
          value={draft.readabilityMeasure || 'flesch-kincaid'}
          onChange={function (e) { update('readabilityMeasure', e.target.value); }}
        >
          {measures.filter(function (m) { return m.validAtItemLength; }).map(function (m) {
            return <option key={m.id} value={m.id}>{m.label}</option>;
          })}
        </select>
        {(function () {
          const chosen = measures.find(function (m) {
            return m.id === (draft.readabilityMeasure || 'flesch-kincaid');
          });
          if (!chosen) { return null; }
          return (
            <>
              <span className="field-hint">{chosen.summary}</span>
              {/* Every measure has a documented weakness and hiding it would be
                  the wrong kind of simplicity. */}
              <span className="field-hint measure-caution">{chosen.caution}</span>
            </>
          );
        }())}
        <span className="field-hint">
          Only measures that work well with a single sentence are listed here. Gunning Fog, SMOG, and
          Linsear Write need more text than one item provides, so they are calculated for the completed
          questionnaire instead.
        </span>
      </div>

      <div className="field narrow">
        <label htmlFor="grade">Maximum reading grade</label>
        <input
          id="grade"
          type="number"
          min="4"
          max="16"
          value={draft.maximumGrade}
          onChange={function (e) { update('maximumGrade', Number(e.target.value)); }}
        />
        <span className="field-hint">
          A grade of eight or below works well for a general audience. Clinical or workplace
          questionnaires may use a higher score. Interpret it using the reading measure selected above.
        </span>
      </div>

      <div className="field narrow">
        <label htmlFor="words">Maximum item length</label>
        <input
          id="words"
          type="number"
          min="8"
          max="40"
          value={draft.maximumWords}
          onChange={function (e) { update('maximumWords', Number(e.target.value)); }}
        />
        <span className="field-hint">Words per item.</span>
      </div>

      </div>
      </section>
      ) : null}

      {/* Both settings affect what gets downloaded and what remains after the
          app closes, so they belong in the backend section. Keeping them here
          also prevents them from appearing under unrelated headings. */}
      {section === 'backend' ? (
      <section className="group">
      <h2>Downloads</h2>
      <div className="group-body">
      {/* This is the only internet request the app makes outside of model use.
          It is off by default, and its purpose is explained next to the switch
          so people can decide whether to turn it on. */}
      <div className="field medium">
        <label htmlFor="updates">Check for newer versions</label>
        <select
          id="updates"
          value={draft.updateChecks ? 'on' : 'off'}
          onChange={function (e) { update('updateChecks', e.target.value === 'on'); }}
        >
          <option value="off">Off</option>
          <option value="on">On</option>
        </select>
        <span className="field-hint">
          When turned on, Setup can check a public release page to see whether a newer version of
          Ollama is available. The check does not send information about you, your computer, or
          anything you have created. It only receives a version number and does not download or
          change anything.
        </span>
      </div>

      <div className="field medium">
        <label htmlFor="keep">Keep downloads when quitting</label>
        <select
          id="keep"
          value={draft.keepRuntimeOnQuit ? 'keep' : 'remove'}
          onChange={function (e) { update('keepRuntimeOnQuit', e.target.value === 'keep'); }}
        >
          <option value="keep">Keep them</option>
          <option value="remove">Remove them on quit</option>
        </select>
        <span className="field-hint">
          Keeping them means the next run can start right away. Removing them frees several gigabytes
          of space, but they will need to be downloaded again before the next run. Either way, Ollama
          stops running when the app closes.
        </span>
      </div>
      </div>
      </section>
      ) : null}

      {/* Grounding changes how the process works, so it belongs with the item
          standards above rather than the appearance settings below. */}
      {section === 'grounding' ? (
      <section className="group">
      <h2>Literature grounding</h2>
      <div className="group-body">
      <div className="field medium">
        <label htmlFor="recall">Recalled reference scales</label>
        <select
          id="recall"
          value={draft.allowModelRecall ? 'on' : 'off'}
          onChange={function (e) { update('allowModelRecall', e.target.value === 'on'); }}
        >
          <option value="off">Off</option>
          <option value="on">On</option>
        </select>
        <span className="field-hint">
          Local models can provide names, authors, and years for published scales even when those
          details are incorrect or made up. For that reason, anything produced here is marked as
          unverified wherever it appears, and this setting is off by default.
        </span>
      </div>

      </div>
      </section>
      ) : null}

        </div>
      </div>
    </Modal>
  );
}
