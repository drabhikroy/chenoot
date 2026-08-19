import { useState } from 'react';
import {
  SOURCES, FAMILY_NOTES, CROSS_CUTTING, GROUPS, FAMILY_MARK
} from '../reference/formats-reference.js';
import { FormatGlyph } from './FormatGlyph.jsx';
import { Modal } from './Modal.jsx';

// Reference for choosing a response format, as cards and not as prose.
// Somebody at this screen is comparing formats, and comparison across twelve
// paragraphs means holding twelve paragraphs in mind. Cards put them side by
// side, the drawing on each carries the distinction that matters most, and the
// reading matter waits behind the card until it is asked for. Grouped by the
// shape of the response, not by subject, because that is the distinction the
// drawings show and the one that decides whether a format suits a question at
// all.

// Short keys against a claim, full references gathered at the end. A citation
// set out in full mid-paragraph is a paragraph nobody finishes.
function Citations({ keys }) {
  return (
    <p className="ref-cites">
      {keys.map(function (key, index) {
        return (
          <span key={key}>
            {index > 0 ? ' \u00B7 ' : ''}
            {SOURCES[key].key}
          </span>
        );
      })}
    </p>
  );
}

// The detail behind a card. This was four uppercase headings, a bordered
// example box, two bulleted lists, and a rule, which is more structure than
// the content underneath it. A reader opening one of these wants to know what
// the format asks, what it is good at, and what to be careful of. Three
// questions do not need four headings and a horizontal rule to separate them.
// So: the shape at the top with the name beside it, one paragraph saying what
// it is and what it is built from, the example set apart because it is a
// specimen in place of prose, and the two lists under quiet labels in ordinary
// sentence case.
function FormatDetail({ note, onClose }) {
  return (
    <Modal title={note.title} onClose={onClose}>
      <div className="notice-body format-detail">
        <div className="format-detail-shape">
          <FormatGlyph shape={note.shape} />
        </div>

        <p className="help-para">
          {note.purpose} {note.madeOf}
        </p>

        <p className="ref-example value">{note.example}</p>

        <div className="format-detail-columns">
          <div>
            <p className="format-detail-label">Good for</p>
            <ul className="ref-list">
              {note.strengths.map(function (line) {
                return <li key={line}>{line}</li>;
              })}
            </ul>
          </div>
          <div>
            <p className="format-detail-label">Watch for</p>
            <ul className="ref-list ref-list-caution">
              {note.cautions.map(function (line) {
                return <li key={line}>{line}</li>;
              })}
            </ul>
          </div>
        </div>

        <Citations keys={note.sources} />
      </div>
    </Modal>
  );
}

export function FormatReference({ initialFamily }) {
  const [open, setOpen] = useState(
    FAMILY_NOTES.find(function (note) { return note.family === initialFamily; }) || null
  );
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="format-reference">
      {GROUPS.map(function (group) {
        const members = FAMILY_NOTES.filter(function (note) { return note.group === group.id; });
        if (members.length === 0) {
          return null;
        }
        return (
          <section className="format-group" key={group.id}>
            <h2 className="format-group-title">{group.title}</h2>
            <p className="format-group-summary">{group.summary}</p>

            <div className="format-grid">
              {members.map(function (note) {
                return (
                  <button
                    className={'format-card' + (note.family === initialFamily ? ' current' : '')}
                    key={note.family}
                    onClick={function () { setOpen(note); }}
                  >
                    <span className="format-card-shape">
                      <FormatGlyph shape={note.shape} />
                    </span>
                    <span className="format-card-heading">
                      {/* Every card in a group draws the same shape, because
                          within a group the shape is the same. The mark is what
                          separates one family from another, and it is the mark
                          this family already carries in the item menu. */}
                      <span className="format-card-mark" aria-hidden="true">
                        {FAMILY_MARK[note.family] || '\u00B7'}
                      </span>
                      <span className="format-card-name">{note.title}</span>
                    </span>
                    {/* The question the format puts, which is the shortest
                        useful thing that can be said about it and the thing
                        somebody is actually matching against their own. */}
                    <span className="format-card-asks">{note.asks}</span>
                    {note.family === initialFamily ? (
                      <span className="format-card-flag">Used here</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="format-group">
        <h2 className="format-group-title">Decisions that cut across all of them</h2>
        <p className="format-group-summary">
          Where the survey methodology literature disagrees, both positions are given. These are
          not settled questions and an application that presented them as settled would be
          misleading you.
        </p>
        {CROSS_CUTTING.map(function (topic) {
          return (
            <div className="ref-cross" key={topic.title}>
              <h4 className="ref-heading">{topic.title}</h4>
              <p className="help-para">{topic.body}</p>
              <Citations keys={topic.sources} />
            </div>
          );
        })}
      </section>

      {/* The reference list is closed by default. It is the thing a reader needs
          once, at the point of writing something up, and the thing everybody
          else scrolls past. */}
      <section className="format-group">
        <button className="link-button" onClick={function () { setShowSources(!showSources); }}>
          {showSources ? 'Hide the sources' : 'Show the ' + Object.keys(SOURCES).length + ' sources'}
        </button>
        {/* Alphabetical by first author, which is where a reader looks for a
            name and also what APA asks of a reference list. These sat in the
            order they happened to be written, which put the 1932 paper first
            and everything else wherever it landed. */}
        {showSources ? (
          <ul className="ref-sources">
            {Object.keys(SOURCES).sort(function (a, b) {
              return SOURCES[a].key.localeCompare(SOURCES[b].key);
            }).map(function (key) {
              return (
                <li key={key}>
                  {SOURCES[key].parts.map(function (part, index) {
                    return part.italic
                      ? <em key={index}>{part.text}</em>
                      : <span key={index}>{part.text}</span>;
                  })}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {open ? (
        <FormatDetail note={open} onClose={function () { setOpen(null); }} />
      ) : null}
    </div>
  );
}
