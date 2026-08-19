import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

// 'Past runs' tab. A completed questionnaire can take up to about forty
// minutes of local model time, so the list is ordered by what someone is most
// likely to remember: what they were measuring, when they created it, how long
// it took, and what was produced. Failed attempts appear alongside completed
// ones.

// Dates are shown as times for work from today and as calendar dates for anything
// older. This matches how people usually look for something from earlier today
// versus something from several days ago.
function formatWhen(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return '';
  }
  const now = new Date();
  const sameDay = when.toDateString() === now.toDateString();
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) {
    return 'Today ' + time;
  }
  return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
}

function formatDuration(ms) {
  if (!ms) {
    return '';
  }
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) {
    return Math.round(ms / 1000) + 's';
  }
  return minutes + ' min';
}

// Rows stay empty until the first load finishes, so the app can tell the difference
// between "nothing has loaded yet" and "there is nothing here." Briefly showing
// "no past work" during every load could look like saved work had disappeared.
export function HistoryScreen({ onOpen }) {
  const [rows, setRows] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);

  function refresh() {
    window.chenoot.listRuns().then(function (outcome) {
      setRows(outcome.runs || []);
    });
  }

  useEffect(refresh, []);

  // Removing one run and reloading the list. The list is re-read from disk
  // rather than filtered in place, so what appears matches what is stored.
  function remove(runId) {
    window.chenoot.deleteRun(runId).then(function () {
      setConfirming(null);
      refresh();
    });
  }

  return (
    <div className="screen">
      <p className="eyebrow">Archive</p>
      <h1>Past runs</h1>

      {/* Clear Past runs appears beside the heading rather than at the bottom of
          the list, where it would be easier to click carelessly after scrolling. */}
      {rows && rows.length > 0 ? (
        <div className="actions">
          <button onClick={function () { setClearingAll(true); }}>
            Delete all {rows.length} runs
          </button>
        </div>
      ) : null}

      {clearingAll ? (
        <ConfirmDialog
          title="Delete every past run"
          body={
            'All ' + (rows ? rows.length : 0) + ' stored runs are removed from this machine. ' +
            'This cannot be undone, and anything already exported to a file is unaffected.'
          }
          points={{
            does: [
              'Deletes every instrument, including the items and the response scales.',
              'Deletes every audit trail, which is the record of how each was built.',
              'Removes the timing history the run estimate is measured from.'
            ],
            keeps: [
              'Files you have already exported, wherever you saved them.',
              'Your settings, models, and the Ollama runtime.'
            ]
          }}
          confirmLabel="Delete everything"
          onConfirm={function () {
            return window.chenoot.removeAllRuns().then(function (result) {
              refresh();
              if (!result.ok) {
                return { ok: false, detail: result.detail };
              }
              return {
                ok: true,
                detail: result.removed + ' runs deleted' +
                  (result.remaining > 0
                    ? '. ' + result.remaining + ' could not be removed and are still listed.'
                    : '.')
              };
            });
          }}
          onClose={function () { setClearingAll(false); }}
        />
      ) : null}

      {rows === null ? <p className="field-hint">Reading the archive.</p> : null}

      {/* The empty state explains what will appear here once something has been
          created, rather than only saying that the list is empty. */}
      {rows && rows.length === 0 ? (
        <p className="field-hint">
          Nothing to see here. Every instrument built within the app on is kept automatically, including
          tries that fail partway.
        </p>
      ) : null}

      {/* One row per stored run, newest first, as the main process returns
          them. Each row opens the run, shows what it produced, and can delete
          it. */}
      {(rows || []).map(function (row) {
        return (
          <div className="history-row" key={row.runId}>
            <div className="history-main">
              <button className="history-open" onClick={function () { onOpen(row.runId); }}>
                {row.construct}
              </button>
              <span className="value history-meta">
                {formatWhen(row.savedAt)}
                {row.population ? ' \u00B7 ' + row.population : ''}
              </span>
            </div>

            {/* Failed attempts are marked clearly. The partial record is still
                useful and may be the only explanation of what went wrong. */}
            <span className={'value history-stat state-' + (row.status === 'complete' ? 'complete' : 'error')}>
              {row.status === 'complete'
                ? row.itemCount + ' items \u00B7 ' + row.dimensionCount + ' dimensions'
                : 'Incomplete'}
              {row.durationMs ? ' \u00B7 ' + formatDuration(row.durationMs) : ''}
            </span>

            {/* Deletion requires confirmation because this work can take a long
                time to reproduce and cannot be restored once removed. */}
            {confirming === row.runId ? (
              <span className="history-confirm">
                <button onClick={function () { remove(row.runId); }}>Delete</button>
                <button onClick={function () { setConfirming(null); }}>Keep</button>
              </span>
            ) : (
              <button
                className="history-remove"
                onClick={function () { setConfirming(row.runId); }}
                aria-label={'Delete the run for ' + row.construct}
              >
                Remove
              </button>
            )}
          </div>
        );
      })}


    </div>
  );
}
