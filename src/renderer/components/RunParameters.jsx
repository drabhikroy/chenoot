// What was asked for, shown on every screen after the request was made. The
// pipeline runs for twenty minutes or more unattended, and someone coming back
// to it should not have to remember what they typed to make sense of what is
// on screen. Purpose is truncated, not wrapped. It is free text of any length,
// and a paragraph here would push the step list below the fold on the one
// screen that exists to show progress.

const PURPOSE_LIMIT = 96;

function truncate(text) {
  if (!text || text.length <= PURPOSE_LIMIT) {
    return text;
  }
  return text.slice(0, PURPOSE_LIMIT).replace(/\s+\S*$/, '') + '\u2026';
}

export function RunParameters({ input, actualCount }) {
  if (!input) {
    return null;
  }

  const rows = [
    ['Population', input.population],
    ['Purpose', truncate(input.purpose)]
  ].filter(function (row) { return row[1]; });

  return (
    <dl className="run-parameters">
      <div>
        <dt>Requested</dt>
        {/* When the finished count differs from what was asked for, both are
            shown, not only the result. Step 1 raises the total when a
            dimension would fall below three items, and someone who asked for
            eight and received twelve deserves to see that on the screen rather
            than only in the audit trail. */}
        <dd>
          {input.itemCount} items
          {actualCount && actualCount !== input.itemCount
            ? ' \u00B7 built ' + actualCount
            : ''}
        </dd>
      </div>
      {rows.map(function (row) {
        return (
          <div key={row[0]}>
            <dt>{row[0]}</dt>
            <dd>{row[1]}</dd>
          </div>
        );
      })}
    </dl>
  );
}
