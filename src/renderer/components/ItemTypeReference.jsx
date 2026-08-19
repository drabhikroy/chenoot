import { useState } from 'react';
import { GROUPS, TYPES, WORKED_EXAMPLES, CITATION } from '../reference/item-types.js';
import { ItemTypeGlyph } from './ItemTypeGlyph.jsx';
import { Modal } from './Modal.jsx';

// The item taxonomy as cards, grouped by the property each label belongs to.
//
// The framework this follows says plainly that the labels do not all sit at the
// same level and that an item carries several of them at once. A single grid of
// thirty-eight cards would say the opposite, so the groups here are the seven
// property sets in place of an alphabet of types, and the worked examples at the
// foot show one question wearing six labels simultaneously.
//
// Those examples are the argument. Anyone can read that an item is not just a
// multiple choice; almost nobody believes it until they see the same question
// classified on six axes at once.

// The detail behind a card. Two of the types are defaults with nothing useful to
// warn about, so the notes section disappears instead of showing empty headings
// over nothing.
function Detail({ type, onClose }) {
  const hasNotes = type.good.length > 0 || type.watch.length > 0;
  return (
    <Modal title={type.title} onClose={onClose}>
      <div className="notice-body format-detail">
        <div className="type-detail-shape">
          <ItemTypeGlyph name={type.glyph} />
        </div>

        <p className="help-para">{type.body}</p>

        {/* Preformatted, because the examples are laid out with spaces and
            radio buttons made out of brackets. Reflowing them as prose would
            destroy the thing they are showing. */}
        <pre className="type-example">{type.example}</pre>

        {hasNotes ? (
          <div className="format-detail-columns">
            {type.good.length > 0 ? (
              <div>
                <p className="format-detail-label">Good for</p>
                <ul className="ref-list">
                  {type.good.map(function (line) {
                    return <li key={line}>{line}</li>;
                  })}
                </ul>
              </div>
            ) : null}
            {type.watch.length > 0 ? (
              <div>
                <p className="format-detail-label">Watch for</p>
                <ul className="ref-list ref-list-caution">
                  {type.watch.map(function (line) {
                    return <li key={line}>{line}</li>;
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function ItemTypeReference() {
  const [open, setOpen] = useState(null);
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="format-reference">
      {GROUPS.map(function (group) {
        const members = TYPES.filter(function (type) { return type.group === group.id; });
        return (
          <section className="format-group" key={group.id}>
            <h2 className="format-group-title">{group.title}</h2>
            <p className="format-group-summary">{group.summary}</p>

            {/* The same card grid the response formats use, so the two
                reference screens read as one pair and not two designs. */}
            <div className="format-grid type-grid">
              {members.map(function (type) {
                return (
                  <button
                    className="format-card type-card"
                    key={type.id}
                    onClick={function () { setOpen(type); }}
                  >
                    <span className="type-card-glyph">
                      <ItemTypeGlyph name={type.glyph} />
                    </span>
                    <span className="format-card-name">{type.title}</span>
                    <span className="format-card-asks">{type.asks}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* The rule the whole taxonomy rests on, stated once and then shown. */}
      <section className="format-group">
        <h2 className="format-group-title">One item, several labels</h2>
        <p className="format-group-summary">
          These properties describe an item together. Reducing a question to a single label
          such as multiple choice or Likert throws away most of what was decided about it.
          Each example below is one question and every property it carries.
        </p>

        {WORKED_EXAMPLES.map(function (example) {
          return (
            <div className="worked" key={example.question}>
              <p className="worked-question">{example.question}</p>
              <pre className="type-example">{example.layout}</pre>
              <dl className="worked-properties">
                {example.properties.map(function (pair) {
                  return (
                    <div key={pair[0]}>
                      <dt>{pair[0]}</dt>
                      <dd className="value">{pair[1]}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </section>

      {/* One source for the whole taxonomy, so this is a line, not the
          list of fourteen the response format screen carries. */}
      <section className="format-group">
        <button className="link-button" onClick={function () { setShowSource(!showSource); }}>
          {showSource ? 'Hide the source' : 'Show the source'}
        </button>
        {showSource ? (
          <ul className="ref-sources">
            <li>
              {CITATION.parts.map(function (part, index) {
                return part.italic
                  ? <em key={index}>{part.text}</em>
                  : <span key={index}>{part.text}</span>;
              })}
            </li>
          </ul>
        ) : null}
      </section>

      {open ? <Detail type={open} onClose={function () { setOpen(null); }} /> : null}
    </div>
  );
}
