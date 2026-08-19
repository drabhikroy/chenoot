import { useState } from 'react';
import { Modal } from './Modal.jsx';

// Confirmation for the two actions that throw work away.
//
// Both are rare, both are irreversible, and both are worded so that the person
// reads what will happen in place of what the button is called. A dialog whose
// only content is "Are you sure?" tells nobody anything: the question is not
// whether they are sure, it is whether they know what the thing does.
//
// The confirming button carries the consequence instead of the word Yes, so a
// person who reached this dialog by accident sees the outcome on the control
// they are about to press.

export function ConfirmDialog({
  title, body, points, confirmLabel, options, onConfirm, onClose
}) {
  // One entry per option, all starting off. Nothing extra is removed unless it
  // is asked for.
  const [chosen, setChosen] = useState({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  function run() {
    setBusy(true);
    Promise.resolve(onConfirm(chosen)).then(function (result) {
      setBusy(false);
      setOutcome(result || { ok: true });
    });
  }

  return (
    <Modal
      title={title}
      onClose={busy ? function () {} : onClose}
      footer={
        // Once the work is done there is nothing left to confirm or cancel, so
        // the pair is replaced by a single way out.
        outcome ? (
          <button className="primary" onClick={onClose}>Close</button>
        ) : (
          <>
            <button className="destructive" onClick={run} disabled={busy}>
              {busy ? 'Working' : confirmLabel}
            </button>
            <button onClick={onClose} disabled={busy}>Cancel</button>
          </>
        )
      }
    >
      <div className="notice-body">
        {outcome ? (
          <p className={outcome.ok ? 'help-para' : 'field-error'}>
            {outcome.detail || 'Done.'}
          </p>
        ) : (
          <>
            <p className="help-para">{body}</p>

            {/* What will and will not happen, as two lists and not a
                paragraph. Somebody deciding whether to press this is scanning
                for one specific thing they care about keeping. */}
            <h4 className="ref-heading">What this does</h4>
            <ul className="ref-list">
              {points.does.map(function (line) {
                return <li key={line}>{line}</li>;
              })}
            </ul>

            {points.keeps.length > 0 ? (
              <>
                <h4 className="ref-heading">What it leaves alone</h4>
                <ul className="ref-list">
                  {points.keeps.map(function (line) {
                    return <li key={line}>{line}</li>;
                  })}
                </ul>
              </>
            ) : null}

            {/* Extra things that can go at the same time, each named for what
                it removes and what that costs. They are separate switches
                because they are separate decisions: somebody clearing settings
                usually wants to keep their instruments, and somebody reclaiming
                disk usually wants the models gone and the instruments kept. */}
            {(options || []).length > 0 ? (
              <div className="confirm-options">
                {options.map(function (option) {
                  return (
                    <label className="switch" key={option.id}>
                      <input
                        type="checkbox"
                        checked={Boolean(chosen[option.id])}
                        onChange={function (event) {
                          const next = Object.assign({}, chosen);
                          next[option.id] = event.target.checked;
                          setChosen(next);
                        }}
                      />
                      <span className="switch-body">
                        <span className="switch-label">{option.label}</span>
                        {option.hint ? (
                          <span className="switch-hint">{option.hint}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
