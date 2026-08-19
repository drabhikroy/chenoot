import { useEffect, useState } from 'react';
import { GraduatedRule } from '../components/GraduatedRule.jsx';

// 'New' tab. Four fields are shown up front. Everything else is available
// under one expandable section. That created two problems. A field can improve
// the result without needing to block someone from continuing, and requiring
// research questions assumed every questionnaire was part of a research study.
// Showing the full set of fields at once also made the form much harder to get
// through. The form now uses one column with labels above each field. This
// gives the eye one clear path down the page. Placing fields side by side may
// save space, but it makes the form harder to scan and complete.

const MINIMUM_ITEMS = 4;
const MAXIMUM_ITEMS = 120;

// Optional fields are grouped by what they affect. Within each group, the more
// common fields appear first and the more specialized ones come later.
const ADVANCED_GROUPS = [
  {
    title: 'Study framing',
    fields: ['researchQuestions', 'intendedUse', 'analysisPlan', 'subgroups']
  },
  {
    title: 'Who answers',
    fields: ['respondentPopulation', 'unitOfObservation', 'unitOfReference']
  },
  {
    title: 'Administration',
    fields: ['mode', 'recallPeriod', 'lengthTarget', 'accessibility']
  },
  {
    title: 'Constraints',
    fields: ['sensitiveTopics', 'existingMeasures', 'comparability']
  }
];

// Uses the same check for empty fields as the main process, so anything shown
// as complete here will also pass the check when the run begins. The check is
// repeated here because it runs with every keystroke and does not need a
// separate request each time.
function isBlank(value) {
  const text = String(value === undefined ? '' : value).trim();
  return text.length === 0 || /^[-\u2013\u2014.]+$/.test(text);
}

// One renderer handles every specification field. The field definition decides
// which control to show, so adding a new field does not require another branch
// here.
//
// Help appears when a field is active instead of staying visible all the time.
// Permanent help text makes the form much longer and is easy to ignore after
// the first use. Showing it on focus puts the guidance beside the field when it
// is most useful, while the control next to the label lets someone reopen it
// whenever needed.
function SpecField({ name, field, value, onChange, onBlur, touched }) {
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const required = field.level === 'required';
  // A required field is marked as a problem only after someone leaves it empty or
  // tries to start the run. Showing errors as soon as the form opens makes a new
  // screen look like something has already gone wrong.
  const missing = required && isBlank(value) && touched;
  const showHint = focused || pinned || missing;

  function focus() { setFocused(true); }
  function blur(event) {
    setFocused(false);
    if (onBlur) { onBlur(event); }
  }

  return (
    <div className={'field' + (missing ? ' incomplete' : '')}>
      <label htmlFor={name}>
        {field.label}
        {required ? <span className="required-mark">needed</span> : null}
        <button
          type="button"
          className={'hint-toggle' + (pinned ? ' pinned' : '')}
          onClick={function () { setPinned(!pinned); }}
          aria-label={'What is ' + field.label + ' for'}
          aria-expanded={showHint}
        >
          ?
        </button>
      </label>
      {field.choices ? (
        <select id={name} value={value || ''} onFocus={focus} onBlur={blur}
          onChange={function (e) { onChange(name, e.target.value); }}>
          <option value="">Not chosen</option>
          {field.choices.map(function (choice) {
            return <option key={choice} value={choice}>{choice}</option>;
          })}
        </select>
      ) : field.multiline ? (
        <textarea id={name} value={value || ''} onFocus={focus} onBlur={blur}
          onChange={function (e) { onChange(name, e.target.value); }} />
      ) : (
        <input id={name} value={value || ''} onFocus={focus} onBlur={blur}
          onChange={function (e) { onChange(name, e.target.value); }} />
      )}
      {showHint ? <span className="field-hint">{field.asks}</span> : null}
      {/* Explains why a missing field matters only while it is empty. Showing the
          consequence of every field all the time would make the form harder to read. */}
      {missing ? <span className="field-why">{field.why}</span> : null}
    </div>
  );
}

export function InputScreen({
  draft, onDraftChange, onStart, steps, returning, backendReady, backendDetail, onOpenSettings
}) {
  const [definitions, setDefinitions] = useState(null);
  const [estimate, setEstimate] = useState(null);
  // Tracks which fields someone has left and whether they have tried to start.
  // Either one is enough to mark an incomplete field. Nothing else is.
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  // Tracks which of the two custom fields is showing its help text. The other
  // specification fields manage this themselves because they are inside that component.
  const [hinted, setHinted] = useState(null);

  function markTouched(name) {
    return function () { setTouched(function (prev) { return Object.assign({}, prev, { [name]: true }); }); };
  }

  useEffect(function () {
    window.chenoot.specificationFields().then(setDefinitions);
  }, []);

  useEffect(function () {
    const count = Number(draft.itemCount);
    if (!Number.isInteger(count) || count < MINIMUM_ITEMS) {
      setEstimate(null);
      return undefined;
    }
    let current = true;
    const timer = setTimeout(function () {
      window.chenoot.estimateRun(count).then(function (result) {
        if (current) { setEstimate(result); }
      });
    }, 250);
    return function () { current = false; clearTimeout(timer); };
  }, [draft.itemCount]);

  // Every change is sent to the parent and saved there. Nothing exists only on
  // this screen, so leaving it, a failed process, or closing the app does not
  // lose anything.
  function updateSpec(name, value) {
    onDraftChange(Object.assign({}, draft, {
      specification: Object.assign({}, draft.specification, { [name]: value })
    }));
  }
  function updateTop(name, value) {
    onDraftChange(Object.assign({}, draft, { [name]: value }));
  }

  if (!definitions) {
    return <div className="screen"><p className="field-hint">Loading.</p></div>;
  }

  const spec = draft.specification || {};
  const outstanding = definitions.required.filter(function (name) { return isBlank(spec[name]); });
  const constructValid = String(draft.construct || '').trim().length >= 3;
  const constructMissing = !constructValid && (attempted || touched.construct);
  const countValid = Number.isInteger(Number(draft.itemCount)) &&
    Number(draft.itemCount) >= MINIMUM_ITEMS && Number(draft.itemCount) <= MAXIMUM_ITEMS;

  // Uses the same calculation as the scoping step, so the screen cannot promise
  // more dimensions than the process will create. The calculation happens with
  // every keystroke, so it stays here rather than making repeated requests.
  // Three items per dimension is an established survey-design convention, not a
  // setting that can differ between parts of the app.
  const supportedDimensions = Math.max(1, Math.floor(Number(draft.itemCount) / 3));
  const ready = outstanding.length === 0 && constructValid && countValid && backendReady;

  // Shows how much optional information has been provided. The count remains
  // visible when the section is closed, so people can see that more options are
  // available without having them shown all the time.
  const advancedFilled = ADVANCED_GROUPS.reduce(function (total, group) {
    return total + group.fields.filter(function (name) { return !isBlank(spec[name]); }).length;
  }, 0);
  const advancedTotal = ADVANCED_GROUPS.reduce(function (total, group) {
    return total + group.fields.length;
  }, 0);

  return (
    <div className="screen screen-narrow">
      {/* The rule starts empty and becomes the progress display once the process
        begins. Showing the same element here gives people a preview of the nine
        steps and makes the next screen feel familiar. */}
      {/* The full opening serves as an introduction. Once someone has already created
          something, repeating it on every visit would take up space with information
          they have already seen. */}
      {returning ? (
        <header className="opening opening-compact">
          <p className="eyebrow">New instrument</p>
          <h1>Build an instrument</h1>
        </header>
      ) : (
        <header className="opening">
          <p className="eyebrow">New instrument</p>
          <h1 className="title-display">Build an instrument</h1>
          <p className="opening-thesis">
              Nine steps take you from a construct to a completed questionnaire, with a
              record of every decision along the way. Once started, the app completes the
              process on its own.
          </p>
          {steps ? (
            <GraduatedRule steps={steps} currentIndex={-1} failedIndex={-1} />
          ) : null}
        </header>
      )}

      {/* Construct is required but is not part of the specification fields, so its
          missing-field warning is handled separately using the same delayed approach. */}
      <div className={'field' + (constructMissing ? ' incomplete' : '')}>
        <label htmlFor="construct">
          Construct
          <span className="required-mark">needed</span>
        </label>
        <input id="construct" value={draft.construct || ''} autoFocus
          onFocus={function () { setHinted('construct'); }}
          onBlur={function () { setHinted(null); markTouched('construct')(); }}
          onChange={function (e) { updateTop('construct', e.target.value); }} />
        {hinted === 'construct' || constructMissing ? (
          <span className="field-hint">
            What you want to measure, named the way it would appear in a report.
          </span>
        ) : null}
        {constructMissing ? (
          <span className="field-why">
            Every dimension, item, and record uses this wording, so enter a name you would
            use in a report rather than a temporary working label.
          </span>
        ) : null}
      </div>

      <SpecField name="targetPopulation" field={definitions.fields.targetPopulation}
        value={spec.targetPopulation} onChange={updateSpec}
        onBlur={markTouched('targetPopulation')}
        touched={attempted || touched.targetPopulation} />
      <SpecField name="purpose" field={definitions.fields.purpose}
        value={spec.purpose} onChange={updateSpec}
        onBlur={markTouched('purpose')}
        touched={attempted || touched.purpose} />

      <div className="field narrow">
        <label htmlFor="itemCount">Target item count</label>
        <input id="itemCount" type="number" min={MINIMUM_ITEMS} max={MAXIMUM_ITEMS}
          value={draft.itemCount}
          onFocus={function () { setHinted('itemCount'); }}
          onBlur={function () { setHinted(null); }}
          onChange={function (e) { updateTop('itemCount', e.target.value); }} />
        {hinted === 'itemCount' ? (
          <span className="field-hint">Roughly three times this many are drafted first.</span>
        ) : null}
        {/* Explain what the requested length means before the process begins. Each
            dimension needs at least three items before reliability can be estimated,
            so the number entered here affects how many dimensions the questionnaire
            can support. Stating that here helps prevent someone from requesting five
            items and then wondering why only one dimension was produced. */}
        {countValid ? (
          <span className="field-hint">
            {supportedDimensions === 1
              ? 'Enough for one dimension. Around 9 items would let it separate three.'
              : 'Enough to separate up to ' + supportedDimensions + ' dimensions.'}
          </span>
        ) : null}
      </div>

      {/* Everything here is optional. Providing more detail can improve the
          questionnaire, but leaving these fields blank is still a valid choice and
          is recorded as missing information. */}
      <details className="advanced spec-advanced">
        <summary>
          <span className="disclosure" aria-hidden="true" />
          <span className="spec-section-title">Specification detail</span>
          <span className="spec-section-count">
            {advancedFilled > 0 ? advancedFilled + ' of ' + advancedTotal + ' supplied' : 'optional'}
          </span>
        </summary>
        <p className="field-hint spec-section-lead">
          None of this is required. Each field you complete gives the app more specific direction,
          while anything left blank is recorded as information it did not have.
        </p>
        {/* Each group opens separately, so expanding Specification detail shows four
            headings instead of fourteen fields at once. This makes the optional
            information easier to scan and choose from. */}
        {ADVANCED_GROUPS.map(function (group) {
          const supplied = group.fields.filter(function (name) {
            return !isBlank(spec[name]);
          }).length;
          return (
            <details className="advanced-group" key={group.title}>
              <summary>
                <span className="disclosure" aria-hidden="true" />
                <span className="advanced-group-title">{group.title}</span>
                <span className="advanced-group-count">
                  {supplied > 0 ? supplied + ' of ' + group.fields.length : group.fields.length + ' fields'}
                </span>
              </summary>
              {group.fields.map(function (name) {
                const field = definitions.fields[name];
                if (!field) { return null; }
                return (
                  <SpecField key={name} name={name} field={field}
                    value={spec[name]} onChange={updateSpec}
                    onBlur={markTouched(name)} touched={attempted || touched[name]} />
                );
              })}
            </details>
          );
        })}
      </details>

      {estimate && estimate.seconds > 0 ? (
        <p className="field-hint estimate">
          Expect roughly {Math.max(1, Math.round(estimate.seconds / 60))} minutes.
          {estimate.basis === 'measured'
            ? ' Measured from your last ' + estimate.sampleSize +
              (estimate.sampleSize === 1 ? ' run' : ' runs') + ' on this machine.'
            : ' A rough default, since there is no history to measure yet.'}
        </p>
      ) : null}

      {/* The message explaining why Start is unavailable appears beside the button
          it refers to. Nothing here prevents someone from filling out the form, so
          there is no reason to interrupt the form with this message earlier. Anything
          already entered is saved if they leave to install a model. */}
      {backendReady ? null : (
        <div className="banner error" role="status">
          The pipeline cannot run yet.
          <span className="value">{backendDetail}</span>
          {/* Send new users to Setup rather than Settings. Setup provides the guided path
              for installing and choosing a model, while Settings assumes those details
              are already known. */}
          {onOpenSettings ? (
            <span className="banner-action">
              <button className="primary" onClick={onOpenSettings}>Set this up</button>
            </span>
          ) : null}
        </div>
      )}

      <div className="actions">
        <button onClick={function () {
          if (!ready) {
            // If Start cannot continue, clicking it shows what is still missing instead of
            // doing nothing. A disabled button without an explanation would leave someone
            // searching for the reason.
            setAttempted(true);
            return;
          }
          onStart({
            construct: String(draft.construct || '').trim(),
            population: spec.targetPopulation || '',
            purpose: spec.purpose || '',
            itemCount: Number(draft.itemCount),
            relatedConstructs: [],
            specification: spec
          });
        }} aria-disabled={!ready} className={'primary' + (ready ? '' : ' unsatisfied')}>
          Start
        </button>
      </div>
      {attempted && outstanding.length > 0 ? (
        <p className="field-error" role="alert">
          Still needed: {outstanding.map(function (name) {
            return definitions.fields[name].label;
          }).join(', ')}.
        </p>
      ) : null}
      <p className="field-hint">
        Entries are saved as you type and remain in place if the process fails.
      </p>
    </div>
  );
}
