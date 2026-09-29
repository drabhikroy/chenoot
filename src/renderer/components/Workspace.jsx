import { useEffect, useRef, useState } from 'react';

// The workspace.
//
// Writing a brief, watching a run, and reading the result share one layout of
// three columns, so the instrument never leaves the screen between them. The brief and the steps sit on the left,
// the instrument sits in the center as a sheet, and details about the work sit
// on the right. What fills each column changes with the phase of the run. The
// form, the progress panel, and the finished instrument are placed inside the
// columns as they are, so each keeps every control it has.

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
export function BriefSummary({ input, onEdit }) {
  if (!input) {
    return null;
  }
  const detail = [input.population, input.purpose].filter(Boolean).join('. ');
  return (
    <div className="brief-summary">
      <p className="brief-summary-title">{input.construct}</p>
      {detail ? <p className="brief-summary-detail">{detail}.</p> : null}
      {input.itemCount ? <p className="brief-summary-detail">{input.itemCount} items requested.</p> : null}
      {onEdit ? (
        <button className="brief-summary-edit" onClick={onEdit}>Edit the brief</button>
      ) : null}
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

// Column widths, kept between sessions. The defaults suit a laptop screen. The
// limits keep the center column wide enough to read an item on one line.
const WIDTH_KEY = 'chenoot.workspace.widths';
const DEFAULT_WIDTHS = { left: 340, right: 360 };
const LIMITS = { left: [260, 640], right: [280, 680] };

function storedWidths() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(WIDTH_KEY) || 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.right)) {
      return saved;
    }
  } catch (error) {
    // A missing or unreadable value just means the defaults are used.
  }
  return DEFAULT_WIDTHS;
}

function clamp(value, range) {
  return Math.min(range[1], Math.max(range[0], value));
}

// A handle on the edge of a side column. Dragging moves that one edge.
// Double clicking puts the column back to its default width. The arrow keys
// move it in steps, so the handle works without a pointer.
function ResizeHandle({ side, width, onChange }) {
  function start(event) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    function move(moveEvent) {
      const delta = moveEvent.clientX - startX;
      onChange(startWidth + (side === 'left' ? delta : -delta));
    }
    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.classList.remove('workspace-resizing');
    }
    document.body.classList.add('workspace-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }
  function key(event) {
    const step = event.shiftKey ? 60 : 20;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onChange(width + (side === 'left' ? -step : step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onChange(width + (side === 'left' ? step : -step));
    }
  }
  return (
    <div
      className={'workspace-handle workspace-handle-' + side}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize the brief column' : 'Resize the details column'}
      aria-valuenow={Math.round(width)}
      aria-valuemin={LIMITS[side][0]}
      aria-valuemax={LIMITS[side][1]}
      tabIndex={0}
      onPointerDown={start}
      onKeyDown={key}
      onDoubleClick={function () { onChange(DEFAULT_WIDTHS[side]); }}
      title="Drag to resize. Double click to reset."
    />
  );
}

// Text fields in the brief column open as a popup while they are being edited.
//
// The column is narrow so the sheet can have the room, and a narrow field
// shows only a few words of a long answer. While a field has focus it moves to
// the middle of the window at reading width, above a dimmed and blurred page,
// with its label over it so it is clear which answer is being written. It
// settles back into the column when focus leaves, by clicking outside it or
// pressing Escape. A spacer of its own height holds its place in the column,
// so nothing else in the form moves.
function fieldLabel(field) {
  const label = field.querySelector('label');
  if (!label) {
    return '';
  }
  // The label also holds the required tag and the hint button, and only its
  // own text belongs over the popup.
  const own = Array.from(label.childNodes).filter(function (node) { return node.nodeType === 3; });
  return own.map(function (node) { return node.textContent; }).join('').trim();
}

function useFloatingFields(ref) {
  useEffect(function () {
    const column = ref.current;
    if (!column) {
      return undefined;
    }
    // The dimmed layer and its words, created while a field is open and
    // removed as soon as it closes.
    let backdrop = null;

    function escape(event) {
      if (event.key === 'Escape' && document.activeElement && document.activeElement.classList.contains('field-floating')) {
        event.stopPropagation();
        document.activeElement.blur();
      }
    }
    function open(event) {
      const control = event.target;
      if (!control.matches('textarea, input:not([type]), input[type="text"]')) {
        return;
      }
      const field = control.closest('.field');
      if (!field) {
        return;
      }
      const box = control.getBoundingClientRect();
      field.style.setProperty('--float-space', box.height + 'px');
      field.classList.add('has-floating');
      control.classList.add('field-floating');

      backdrop = document.createElement('div');
      backdrop.className = 'field-backdrop';
      const title = document.createElement('p');
      title.className = 'field-backdrop-label';
      title.textContent = fieldLabel(field);
      const hint = document.createElement('p');
      hint.className = 'field-backdrop-hint';
      hint.textContent = 'Click outside or press Escape when you are done.';
      backdrop.appendChild(title);
      backdrop.appendChild(hint);
      document.body.appendChild(backdrop);
      document.addEventListener('keydown', escape, true);
    }
    function close(event) {
      const control = event.target;
      if (!control.classList || !control.classList.contains('field-floating')) {
        return;
      }
      control.classList.remove('field-floating');
      const field = control.closest('.field');
      if (field) {
        field.classList.remove('has-floating');
        field.style.removeProperty('--float-space');
      }
      if (backdrop) {
        backdrop.remove();
        backdrop = null;
      }
      document.removeEventListener('keydown', escape, true);
    }
    column.addEventListener('focusin', open);
    column.addEventListener('focusout', close);
    return function () {
      column.removeEventListener('focusin', open);
      column.removeEventListener('focusout', close);
      document.removeEventListener('keydown', escape, true);
      if (backdrop) {
        backdrop.remove();
      }
    };
  }, [ref]);
}

// The three columns. The right column is optional, since writing the brief
// needs only the brief and the sheet. Both side columns can be widened or
// narrowed from their inner edge.
export function Workspace({ left, center, right }) {
  const [widths, setWidths] = useState(storedWidths);
  const leftRef = useRef(null);
  useFloatingFields(leftRef);

  // Every width passes through the limits before it is kept, whether it came
  // from a drag, a key press, or a double click, so no path can squeeze the
  // center column below a readable width.
  function set(side, value) {
    setWidths(function (current) {
      const next = Object.assign({}, current, { [side]: clamp(value, LIMITS[side]) });
      try {
        window.localStorage.setItem(WIDTH_KEY, JSON.stringify(next));
      } catch (error) {
        // Widths are a convenience. If they cannot be saved, the next session
        // starts from the defaults and nothing else is affected.
      }
      return next;
    });
  }

  // The handles are columns of zero width between the panes, so they take no
  // room from the content and sit exactly on the dividing line.
  const columns = right
    ? widths.left + 'px 0 minmax(0, 1fr) 0 ' + widths.right + 'px'
    : widths.left + 'px 0 minmax(0, 1fr)';
  return (
    <div className={'workspace' + (right ? ' workspace-three' : '')} style={{ gridTemplateColumns: columns }}>
      <aside className="workspace-left" ref={leftRef}>{left}</aside>
      <ResizeHandle side="left" width={widths.left} onChange={function (value) { set('left', value); }} />
      <section className="workspace-center">{center}</section>
      {right ? (
        <ResizeHandle side="right" width={widths.right} onChange={function (value) { set('right', value); }} />
      ) : null}
      {right ? <aside className="workspace-right">{right}</aside> : null}
    </div>
  );
}
