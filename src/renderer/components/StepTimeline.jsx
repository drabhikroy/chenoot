// The step timeline. A pipeline is a sequence with a position in it, and the
// natural picture of that is a line with nodes on it. The spine runs
// continuously down the left, filled above the current node and hollow below,
// so where the run has reached is legible at a glance from across a desk and
// not needing the status column read. Each node states what it is by shape as
// well as by color: a filled disc for done, a ring with a moving center for
// running, a hollow outline for waiting, a cross for failed. The other thing
// it fixes is weight. Nine equal rows gave a step that had nothing to report
// the same space as the one doing the work. Here a waiting step is a node and
// a name, and the running one opens up to carry its progress and its
// commentary.

const MARKS = {
  pending: 'waiting',
  running: 'running',
  complete: 'complete',
  flagged: 'flagged',
  error: 'failed'
};

function clock(ms) {
  if (ms === null || ms === undefined) {
    return '';
  }
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

function Node({ state }) {
  // Geometry, not a glyph. A character inherits the text metrics and sits at a
  // different height in every face; a small piece of geometry sits where it is
  // put and stays the same size when the type scale changes.
  return (
    <span className={'node node-' + state} aria-hidden="true">
      {state === 'error' ? <span className="node-cross" /> : null}
      {state === 'running' ? <span className="node-pulse" /> : null}
      {state === 'complete' || state === 'flagged' ? <span className="node-fill" /> : null}
    </span>
  );
}

export function StepTimeline({ steps, states, stepElapsed }) {
  return (
    <ol className="timeline">
      {steps.map(function (step, index) {
        const entry = states[index];
        const state = entry.state;
        const running = state === 'running';
        // The spine above a node is filled when everything before it is done,
        // which is what makes the line itself a progress reading.
        const reached = index === 0 || states[index - 1].state !== 'pending';

        return (
          <li
            className={'timeline-step state-' + state + (reached ? ' reached' : '')}
            key={step.name}
          >
            <Node state={state} />

            <div className="timeline-body">
              <div className="timeline-head">
                <span className="timeline-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="timeline-name">{step.name}</span>
                <span className={'timeline-status value state-' + state}>
                  {MARKS[state]}
                  {running && entry.completed && entry.total
                    ? ' \u00B7 ' + entry.completed + ' of ' + entry.total
                    : ''}
                  {running && stepElapsed ? ' \u00B7 ' + clock(stepElapsed) : ''}
                  {!running && entry.durationMs !== null && entry.durationMs !== undefined
                    ? ' \u00B7 ' + clock(entry.durationMs)
                    : ''}
                </span>
              </div>

              {/* A running step shows what it is doing; a finished one shows
                  what it did. Both occupy the same line so the list does not
                  jump when a step lands. */}
              {running && entry.detail ? (
                <p className="timeline-detail">{entry.detail}</p>
              ) : entry.summary ? (
                <p className="timeline-summary">{entry.summary}</p>
              ) : null}

              {running && entry.completed && entry.total ? (
                <span className="timeline-progress" aria-hidden="true">
                  <span style={{ width: ((entry.completed / entry.total) * 100) + '%' }} />
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
