import { useState } from 'react';

// What the process needs before it can continue. Step 1 pauses when missing
// information could change what the questionnaire measures. The fields appear
// with everything already entered, so this is a correction rather than a
// restart. Continuing begins the process again from the first step, which
// reflects what actually happens instead of suggesting earlier steps are kept.

export function ClarifyScreen({ missing, specification, onResume, onEdit }) {
  const [answers, setAnswers] = useState({});

  function update(field, value) {
    setAnswers(Object.assign({}, answers, { [field]: value }));
  }

  const merged = Object.assign({}, specification, answers);
  const complete = missing.every(function (item) {
    return String(merged[item.field] || '').trim().length > 0;
  });

  return (
    <div className="screen screen-narrow">
      <p className="eyebrow">Paused</p>
      <h1>Before questions can be written</h1>

      <p className="lede">
        The process paused instead of guessing. Each missing detail can change
        what the questionnaire measures, so adding it may lead to a different
        questionnaire than leaving it blank.
      </p>

      {missing.map(function (item) {
        return (
          <div className="field" key={item.field}>
            <label htmlFor={'clarify-' + item.field}>{item.label}</label>
            <textarea
              id={'clarify-' + item.field}
              value={merged[item.field] || ''}
              onChange={function (e) { update(item.field, e.target.value); }}
            />
            <span className="field-hint">{item.asks}</span>
            {/* The reason appears beside each field because it explains why that specific
                piece of information matters. */}
            <span className="field-why">{item.why}</span>
          </div>
        );
      })}

      <div className="actions">
        <button className="primary" onClick={function () { onResume(merged); }} disabled={!complete}>
          Continue
        </button>
        {/* This gives someone a way to change information that is not requested on
            this screen without losing what has already been entered. */}
        <button onClick={function () { onEdit(merged); }}>Back to the full specification</button>
      </div>
      <p className="field-hint">
        Continuing begins the process again from the first step, with everything already
        entered kept in place. Nothing is lost.
      </p>
    </div>
  );
}
