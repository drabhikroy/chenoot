import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';

// Setting the whole instrument to one response format.
//
// The per-item control was the only way to change a format, which suits the
// case it was built for: one question that needs a different scale from the
// rest. It suits nobody who decides after reading the instrument that the
// agreement scale should have five points instead of seven, because that is
// every item, one menu at a time, each with its own model call and its own
// wait.
//
// The cost is stated before the work starts. Moving within a family relabels
// the anchors and returns immediately; moving across families rewrites the item
// text, which is a model call per item and minutes on a long instrument. Those
// are different enough that nobody should discover which one they picked by
// watching how long it takes.

// Formats grouped the way the menu groups them, so the two controls present the
// same list in the same order.
function byFamily(formats) {
  const groups = new Map();
  formats.forEach(function (format) {
    if (!groups.has(format.family)) {
      groups.set(format.family, []);
    }
    groups.get(format.family).push(format);
  });
  return Array.from(groups.entries());
}

export function ApplyFormatDialog({ formats, current, onClose, onApplied }) {
  const [chosen, setChosen] = useState(current || '');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [outcome, setOutcome] = useState(null);

  useEffect(function () {
    return window.chenoot.on('items:format-progress', function (update) {
      setProgress(update);
    });
  }, []);

  const target = formats.find(function (format) { return format.id === chosen; });
  const source = formats.find(function (format) { return format.id === current; });
  // Same family means the anchors change and the wording does not, which is the
  // difference between a control that answers immediately and one that runs the
  // model once per item.
  const rewrites = Boolean(target && source && target.family !== source.family);

  function apply() {
    setRunning(true);
    setOutcome(null);
    window.chenoot.formatAllItems({ format: chosen }).then(function (result) {
      setRunning(false);
      setProgress(null);
      setOutcome(result);
      if (result.ok && result.failures.length === 0) {
        onApplied(result);
      }
    });
  }

  return (
    <Modal
      title="Change every item"
      onClose={running ? function () {} : onClose}
      footer={
        <>
          <button
            className="primary"
            onClick={apply}
            disabled={running || !chosen || chosen === current}
          >
            {running ? 'Working' : 'Apply to every item'}
          </button>
          <button onClick={onClose} disabled={running}>
            {outcome ? 'Close' : 'Cancel'}
          </button>
          {/* Said before the button is pressed, since it is the difference
              between a control that returns at once and one that takes
              minutes. */}
          {!running && chosen && chosen !== current ? (
            <span className="field-hint">
              {rewrites
                ? 'Rewrites every item, one model call each.'
                : 'Relabels the anchors. No model calls, returns at once.'}
            </span>
          ) : null}
        </>
      }
    >
      <div className="notice-body">
        <p className="help-para">
          Every item takes the format chosen here, including any that were changed individually.
          Items already using it are left alone.
        </p>

        <div className="field">
          <label htmlFor="apply-format">Format</label>
          <select
            id="apply-format"
            value={chosen}
            onChange={function (event) { setChosen(event.target.value); }}
            disabled={running}
          >
            {byFamily(formats).map(function (group) {
              return (
                <optgroup key={group[0]} label={group[0]}>
                  {group[1].map(function (format) {
                    return (
                      <option key={format.id} value={format.id}>
                        {format.label}{format.id === current ? ' (current default)' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              );
            })}
          </select>
        </div>

        {running && progress ? (
          <div className="pull">
            <p className="value">
              {progress.done} of {progress.total}
              {progress.label ? ' \u00B7 ' + progress.label : ''}
            </p>
            <span className="pull-track" aria-hidden="true">
              <span
                className="pull-fill"
                style={{ width: (progress.total ? (progress.done / progress.total) * 100 : 0) + '%' }}
              />
            </span>
          </div>
        ) : null}

        {outcome && outcome.ok ? (
          <p className="field-hint">
            {outcome.changed} of {outcome.total} items changed
            {outcome.rewritten > 0 ? ', ' + outcome.rewritten + ' rewritten' : ''}.
            {outcome.failures.length > 0
              ? ' ' + outcome.failures.length + ' could not be converted and still use the ' +
                'format they had: ' + outcome.failures.join(', ') + '.'
              : ''}
          </p>
        ) : null}

        {outcome && !outcome.ok ? (
          <p className="field-error">{outcome.detail}</p>
        ) : null}
      </div>
    </Modal>
  );
}
