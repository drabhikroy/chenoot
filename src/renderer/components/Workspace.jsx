// The workspace.
//
// Building, watching a run, and reading the result used to be three separate
// screens, so the instrument disappeared from view at each hand off. They now
// share one layout of three columns. The brief and the steps sit on the left,
// the instrument sits in the center as a sheet, and details about the work sit
// on the right. What fills each column changes with the phase of the run, and
// the screens that did this work before are placed inside it unchanged, so
// every control they offered is still here.

// Plain names for the steps, shown in the rail. The registry names suit the
// audit trail, and these say what each step does for the person reading.
const PLAIN = [
  'Read the brief',
  'Plan dimensions',
  'Look up published scales',
  'Draft items',
  'Check each item',
  'Revise weak items',
  'Remove duplicates',
  'Choose the scale',
  'Assemble'
];

function clock(ms) {
  if (!Number.isFinite(ms)) {
    return '';
  }
  const seconds = Math.round(ms / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

// The steps as a list, each with its state and how long it took. A step the
// run passed over, such as the optional lookup of published scales, shows as
// skipped and not as done.
export function StepRail({ states, running }) {
  return (
    <ol className="step-rail" aria-label="Steps">
      {PLAIN.map(function (name, index) {
        const state = (states && states[index]) || { state: 'pending' };
        const skipped = state.state === 'complete' && /skipped|off|not requested/i.test(state.summary || '');
        const kind = skipped ? 'skipped' : state.state;
        return (
          <li key={name} className={'step-rail-item ' + kind}>
            <span className="step-rail-mark" aria-hidden="true" />
            <span className="step-rail-name">{name}</span>
            <span className="step-rail-time value">
              {skipped ? 'off' : (state.state === 'complete' || state.state === 'flagged')
                ? clock(state.durationMs) : (state.state === 'running' && running ? 'now' : '')}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// A short restatement of the brief once a run has started, since the form it
// came from is no longer on screen.
export function BriefSummary({ input }) {
  if (!input) {
    return null;
  }
  const detail = [input.population, input.purpose].filter(Boolean).join('. ');
  return (
    <div className="brief-summary">
      <p className="brief-summary-title">{input.construct}</p>
      {detail ? <p className="brief-summary-detail">{detail}.</p> : null}
      {input.itemCount ? <p className="brief-summary-detail">{input.itemCount} items requested.</p> : null}
    </div>
  );
}

// The empty sheet before a run, saying what will appear and in what order.
export function SheetPlaceholder() {
  return (
    <div className="sheet sheet-empty">
      <h2 className="sheet-empty-title">Your instrument will appear here</h2>
      <p className="sheet-empty-text">
        As each step finishes, the sheet fills in: the dimensions first, then the
        drafted items, then the checked and revised versions, and finally the
        response scale.
      </p>
      <div className="sheet-lines" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
    </div>
  );
}

// The sheet during a run. Each finished step adds its account of what it did,
// so the instrument grows on screen in the order it is made.
export function SheetInProgress({ input, states }) {
  const done = (states || []).map(function (state, index) {
    return { name: PLAIN[index], state };
  }).filter(function (entry) {
    return entry.state && entry.state.summary && entry.state.state !== 'pending';
  });
  return (
    <div className="sheet">
      <h1 className="sheet-title">{input ? input.construct : 'New instrument'}</h1>
      <p className="sheet-subtitle">Building now. Each step adds to this sheet when it finishes.</p>
      {done.map(function (entry) {
        return (
          <div key={entry.name} className={'sheet-step ' + entry.state.state}>
            <p className="sheet-step-name">{entry.name}</p>
            <p className="sheet-step-summary">{entry.state.summary}</p>
          </div>
        );
      })}
      <div className="sheet-lines" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}

// The three columns. The right column is optional, since writing the brief
// needs only the brief and the sheet.
export function Workspace({ left, center, right }) {
  return (
    <div className={'workspace' + (right ? ' workspace-three' : '')}>
      <aside className="workspace-left">{left}</aside>
      <section className="workspace-center">{center}</section>
      {right ? <aside className="workspace-right">{right}</aside> : null}
    </div>
  );
}
