// A reference example shown as a survey item, in the same look as the nine
// specimens on the introduction.
//
// The reference examples are written as short plain text, which keeps them
// easy to edit and lets the export writers reuse them. This reads that text
// and draws what a respondent would actually see: the question, then radio
// buttons, check boxes, an answer box, a number field, a ranking, or a grid.
// Text it cannot read as any of those is shown as written, so an unusual
// example is never lost, only left plain.

// The markers the examples use: parentheses for a radio button and square
// brackets for a check box, both as they would be typed in a plain text
// questionnaire.
const RADIO = /\(\s?\)|\(x\)/i;
const CHECK = /\[\s?\]/;

// Splits a line like "( ) Always ( ) Often" into its option labels.
function optionsFrom(line, marker) {
  return line.split(marker).map(function (part) { return part.trim(); }).filter(Boolean);
}

// A grid has a header row of column names and then rows that each carry the
// same number of radio buttons or blanks.
function gridFrom(lines) {
  const rows = lines.slice(1).map(function (line) {
    const cells = line.split(/\s{2,}/).map(function (cell) { return cell.trim(); }).filter(Boolean);
    return cells;
  });
  const header = lines[0].split(/\s{2,}/).map(function (cell) { return cell.trim(); }).filter(Boolean);
  if (rows.length === 0 || rows.some(function (row) { return row.length < 2; })) {
    return null;
  }
  const columns = rows[0].length - 1;
  return { header: header.slice(-columns), rows };
}

// Reads one example into the kind of item it shows and the parts that item
// needs. The checks run from the most specific shape to the least, so a grid
// is found before its rows are mistaken for a plain list of radio buttons.
export function parseExample(text) {
  const lines = String(text || '').split('\n').filter(function (line) { return line.trim(); });
  if (lines.length === 0) {
    return { kind: 'plain', text: '' };
  }
  // Some examples start straight with the answer area, such as a lone number
  // field or a table, and have no question line of their own.
  const first = lines[0].trim();
  const startsWithAnswer = RADIO.test(first.slice(0, 4)) || CHECK.test(first.slice(0, 4)) ||
    /^_{3}/.test(first) || /^\[_+\]$/.test(first) || /^\s{4,}/.test(lines[0]);
  const stem = startsWithAnswer ? '' : first;
  const rest = startsWithAnswer ? lines : lines.slice(1);

  if (rest.length === 0) {
    return { kind: 'stem', stem };
  }
  const joined = rest.join(' ');

  // A grid: a header line of column names followed by rows of answers.
  if (rest.length >= 3 && rest.slice(1).every(function (line) {
    return RADIO.test(line) || /_{3}/.test(line);
  }) && !RADIO.test(rest[0]) && !/_{3}/.test(rest[0])) {
    const grid = gridFrom(rest);
    if (grid) {
      return { kind: 'grid', stem, grid, radio: RADIO.test(rest[1]) };
    }
  }
  // Written answers, then lists of blanks, then rankings, then a single blank
  // with its unit, each of which draws a different kind of answer area.
  if (/\[\s*open text\s*\]|\[_+\]/i.test(joined)) {
    return { kind: 'open', stem };
  }
  if (rest.every(function (line) { return /^\d+\.\s*_+/.test(line.trim()); })) {
    return { kind: 'list', stem, count: rest.length };
  }
  if (rest.every(function (line) { return /^_{3}\s+\S/.test(line.trim()); }) && rest.length > 1) {
    return { kind: 'ranking', stem, rows: rest.map(function (line) { return line.replace(/^_+\s*/, '').trim(); }) };
  }
  if (rest.length === 1 && /^_{3}/.test(rest[0].trim())) {
    return { kind: 'numeric', stem, unit: rest[0].replace(/^_+\s*/, '').trim() };
  }
  if (CHECK.test(joined)) {
    return { kind: 'check', stem, options: optionsFrom(joined, CHECK) };
  }
  // Radio buttons may sit one to a line or several to a line. An option that
  // ends in a blank is an Other option with space to write.
  if (RADIO.test(joined)) {
    const options = rest.length > 1
      ? rest.map(function (line) { return line.replace(RADIO, '').trim(); })
      : optionsFrom(joined, RADIO);
    const other = options.findIndex(function (option) { return /_{3}/.test(option); });
    return {
      kind: 'radio',
      stem,
      options: options.map(function (option) { return option.replace(/_+/g, '').trim(); }),
      otherIndex: other
    };
  }
  // Options separated by slashes. A line that also asks a question is a second
  // item folded into the example, and is shown as written.
  if (rest.length === 1 && rest[0].indexOf('/') !== -1 && rest[0].indexOf('?') === -1) {
    return { kind: 'radio', stem, options: rest[0].split('/').map(function (part) { return part.trim(); }), otherIndex: -1 };
  }
  return { kind: 'plain', text: lines.join('\n') };
}

// Draws a parsed example. The first option of a radio list is shown chosen,
// as on the introduction, so the control reads as one that has been used.
export function SurveySpecimen({ example, label, parsed }) {
  const item = parsed || parseExample(example);
  if (item.kind === 'plain') {
    return <pre className="type-example">{item.text}</pre>;
  }
  return (
    <article className="specimen reference-specimen">
      {label ? <p className="specimen-label">{label}</p> : null}
      {item.stem ? <p className="specimen-stem">{item.stem}</p> : null}
      {item.kind === 'radio' ? (
        <ul className="specimen-choices">
          {item.options.map(function (option, index) {
            return (
              <li key={option + index}>
                <span className={'specimen-dot' + (index === 0 ? ' chosen' : '')} aria-hidden="true" />
                <span>{option}</span>
                {index === item.otherIndex ? <span className="specimen-rule" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {item.kind === 'scale' ? (
        <ol className="specimen-scale">
          {item.options.map(function (option, index) {
            return (
              <li key={option + index}>
                <span className={'specimen-dot' + (index === item.chosen ? ' chosen' : '')} aria-hidden="true" />
                <span className="specimen-anchor">{option}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {/* Two boxes are ticked, since ticking more than one is what makes a
          check list different from radio buttons. */}
      {item.kind === 'check' ? (
        <ul className="specimen-choices">
          {item.options.map(function (option, index) {
            return (
              <li key={option + index}>
                <span className={'specimen-box' + (index === 0 || index === 2 ? ' chosen' : '')} aria-hidden="true" />
                <span>{option}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {item.kind === 'open' ? (
        <p className="specimen-open" aria-hidden="true"><span /><span /><span /></p>
      ) : null}
      {item.kind === 'numeric' ? (
        <p className="specimen-numeric">
          <span className="specimen-field" aria-hidden="true" />
          <span className="specimen-unit value">{item.unit}</span>
        </p>
      ) : null}
      {item.kind === 'list' ? (
        <ol className="specimen-ranking">
          {Array.from({ length: item.count }, function (unused, index) {
            return (
              <li key={index}>
                <span className="specimen-rank value">{index + 1}</span>
                <span className="specimen-rule" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      ) : null}
      {item.kind === 'ranking' ? (
        <ol className="specimen-ranking">
          {item.rows.map(function (row, index) {
            return (
              <li key={row}>
                <span className="specimen-rank value">{index + 1}</span>
                <span>{row}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {/* A grid shows one row per statement. A different answer is chosen on
          each row, so it reads as a filled-in form and not a blank one. */}
      {item.kind === 'grid' ? (
        <table className="specimen-forced">
          <thead>
            <tr>
              <td />
              {item.grid.header.map(function (name) { return <th scope="col" key={name}>{name}</th>; })}
            </tr>
          </thead>
          <tbody>
            {item.grid.rows.map(function (row, rowIndex) {
              return (
                <tr key={row[0]}>
                  <th scope="row">{row[0]}</th>
                  {row.slice(1).map(function (cell, cellIndex) {
                    return (
                      <td key={cellIndex}>
                        {item.radio
                          ? <span className={'specimen-dot' + (cellIndex === rowIndex % (row.length - 1) ? ' chosen' : '')} aria-hidden="true" />
                          : <span className="specimen-field specimen-field-small" aria-hidden="true" />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}
