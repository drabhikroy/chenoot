import { useEffect, useRef, useState } from 'react';
// One copy of the family marks, shared with the format reference so a family
// looks the same in the menu and on its card.
import { FAMILY_MARK } from '../reference/formats-reference.js';

// The per-item format control.
//
// Collapsed to a single line until someone asks for it, because most items in
// most instruments are fine as generated and a picker on every row would turn
// a finished questionnaire into a form.
//
// The two kinds of change are labeled differently on purpose. Moving within a
// family relabels and returns instantly; moving across families rewrites the
// item and takes a model call. Telling someone which they are about to do,
// before they do it, is the difference between a control that feels responsive
// and one that seems to hang at random.

// Grouped by response dimension and not listed flat. Twenty-five options is
// too many to scan as one column, and this is the same grouping the selection
// step reasons about, so someone who read the audit trail already knows it.
function groupFormats(formats) {
  const byFamily = new Map();
  formats.forEach(function (format) {
    if (!byFamily.has(format.family)) {
      byFamily.set(format.family, []);
    }
    byFamily.get(format.family).push(format);
  });
  return byFamily;
}


const FAMILY_LABEL = {
  agreement: 'Agreement',
  satisfaction: 'Satisfaction',
  evaluation: 'Evaluation',
  comparison: 'Comparison',
  extent: 'Amount',
  intensity: 'Intensity',
  importance: 'Importance',
  difficulty: 'Difficulty',
  confidence: 'Confidence',
  likelihood: 'Likelihood',
  frequency: 'Frequency',
  endorsement: 'Yes or no',
  numeric: 'Numeric',
  open: 'Open ended',
  date: 'Date',
  nominal: 'Choose from options'
};

// The menu closes on choosing. Leaving it open would let someone stack changes
// on an item that is still being rewritten, and the second request would be
// working from the item the first one replaced.
export function ItemFormat({ item, currentFormat, formats, onChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const container = useRef(null);

  // A menu with twenty-five options and no way out except choosing one is a
  // trap. Clicking anywhere outside it closes it, and so does Escape, which are
  // the two gestures anyone tries first.
  useEffect(function () {
    if (!open) {
      return undefined;
    }

    function onPointer(event) {
      if (container.current && !container.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    // Captured on the way down, not on the way up, so a click that also
    // lands on another control closes this before that control acts.
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return function () {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = item.format || currentFormat;
  const activeSpec = formats.find(function (f) { return f.id === active; });
  const grouped = groupFormats(formats);

  function choose(id) {
    if (id === active) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setOutcome(null);
    onChange(item.id, id).then(function (result) {
      setBusy(false);
      setOpen(false);
      setOutcome(result);
    });
  }

  return (
    <div className="item-format" ref={container}>
      <button
        className="item-format-toggle"
        onClick={function () { setOpen(!open); }}
        aria-expanded={open}
      >
        {busy ? 'Rewriting' : (activeSpec ? activeSpec.label : active)}
      </button>

      {open ? (
        <div className="item-format-menu" role="group" aria-label="Response format">
          {Array.from(grouped.keys()).map(function (family) {
            return (
              <div className="item-format-family" key={family}>
                <span className="item-format-family-name">
                  <span className="item-format-mark" aria-hidden="true">
                    {FAMILY_MARK[family] || '\u00B7'}
                  </span>
                  {FAMILY_LABEL[family] || family}
                </span>
                {grouped.get(family).map(function (format) {
                  // A change inside the current family only swaps anchors, so it
                  // is marked as instant. Everything else rewrites the item.
                  const instant = activeSpec &&
                    format.family === activeSpec.family &&
                    format.polarity === activeSpec.polarity &&
                    format.kind === 'scale';
                  return (
                    <button
                      key={format.id}
                      className={'item-format-option' + (format.id === active ? ' current' : '')}
                      onClick={function () { choose(format.id); }}
                    >
                      <span className="item-format-option-label">
                      <span className="item-format-mark" aria-hidden="true">
                        {FAMILY_MARK[format.family] || '\u00B7'}
                      </span>
                      {format.label}
                    </span>
                      <span className="item-format-cost value">
                        {format.id === active ? 'current' : instant ? 'instant' : 'rewrites'}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* What happened, kept beside the item, not announced globally.
          Someone adjusting six items in a row needs to see the result of each
          one where they made it. */}
      {outcome && outcome.ok === false ? (
        <p className="field-error item-format-note">{outcome.detail}</p>
      ) : null}
      {outcome && outcome.ok && outcome.regenerated ? (
        <p className="field-hint item-format-note">Rewritten for the new response format.</p>
      ) : null}
      {outcome && outcome.ok && outcome.flags && outcome.flags.length > 0 ? (
        <p className="field-error item-format-note">
          The rewrite raised: {outcome.flags.join('. ')}
        </p>
      ) : null}
    </div>
  );
}
