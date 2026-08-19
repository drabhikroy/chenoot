import { StepTimeline } from '../components/StepTimeline.jsx';
import { RunParameters } from '../components/RunParameters.jsx';
import { useEffect, useState } from 'react';

// Elapsed time is shown in minutes and seconds. Seconds alone become harder to
// read after about 90 seconds, which can happen during the first step.
function clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

// Time left is written the way someone waiting would naturally read it.

// This is an estimate, not a clock. Showing seconds would suggest more accuracy
// than the estimate can support. Above 15 minutes, the time is rounded to the
// nearest five minutes. Below that, it is rounded to the minute. At 20 minutes,
// someone may be deciding whether there is time to step away. At two minutes,
// they are more likely deciding whether to stay.
function remaining(seconds) {
  if (seconds <= 45) {
    return 'under a minute';
  }
  const minutes = seconds / 60;
  if (minutes < 15) {
    return 'about ' + Math.round(minutes) + ' minutes';
  }
  return 'about ' + Math.round(minutes / 5) * 5 + ' minutes';
}

// The basis for the estimate is stated directly rather than left to assumption.
//
// A time estimate can look like a precise measurement if its source is not
// explained. Here, it is based on the median time from completed runs on this
// computer. On a first run, there is no local history yet. Showing how many runs
// the estimate is based on makes clear whether it reflects past use or only a
// starting estimate.
function basisOf(estimate) {
  if (!estimate || estimate.basis !== 'measured') {
    return 'a rough figure, since nothing has finished on this machine yet';
  }
  if (estimate.sampleSize === 1) {
    return 'from the one run that has finished here';
  }
  return 'from the ' + estimate.sampleSize + ' runs that have finished here';
}

// The process view. Nothing here is interactive except Cancel because the run
// continues on its own once started.
//
// Each readout shows a short summary for that step rather than the full model
// output. This keeps the result easy to scan and act on. "2 of 12 items flagged,
// both by measurement" gives someone the useful result without making them sort
// through a block of JSON.
//
// Step labels are passed in so this screen can be previewed on its own with
// sample states. That makes it possible to inspect flagged and failed cases
// without causing a real model run to fail.
export function PipelineScreen({
  input, steps, states, onCancel, cancelling, elapsedMs, error, stepStartedAt, notes
}) {
  // The time estimate is calculated once when the run begins, then adjusted based
  // on how much of the process remains. Recalculating it every second would add
  // unnecessary requests even though the estimate itself does not change.
  const [estimate, setEstimate] = useState(null);
  useEffect(function () {
    const count = input && input.itemCount ? Number(input.itemCount) : 0;
    if (!count) {
      return undefined;
    }
    let current = true;
    window.chenoot.estimateRun(count).then(function (result) {
      if (current) { setEstimate(result); }
    });
    return function () { current = false; };
  }, [input]);
  // The current step keeps its own timer. Updating it once per second is enough
  // for steps that take tens of seconds and avoids refreshing the full list many
  // times each second.
  const [stepElapsed, setStepElapsed] = useState(0);
  useEffect(function () {
    if (!stepStartedAt) {
      setStepElapsed(0);
      return undefined;
    }
    setStepElapsed(Date.now() - stepStartedAt);
    const timer = setInterval(function () {
      setStepElapsed(Date.now() - stepStartedAt);
    }, 1000);
    return function () { clearInterval(timer); };
  }, [stepStartedAt]);

  // The current step is identified from the step states rather than stored
  // separately. Keeping the same information in two places could cause the values
  // to disagree, especially if the process is canceled.
  const currentIndex = states.findIndex(function (state) {
    return state.state === 'running';
  });
  const failedIndex = states.findIndex(function (state) {
    return state.state === 'error';
  });
  const completed = states.filter(function (state) {
    return state.state === 'complete' || state.state === 'flagged';
  }).length;

  // The estimate covers the full process, so the remaining time depends on how many
  // steps are left and how much time the current one has already used. All steps
  // are treated as equal even though some take longer than others. The estimate is
  // only meant to help someone decide whether to wait, so more detail would suggest
  // more accuracy than it can support.
  let estimateLeft = null;
  if (estimate && estimate.seconds > 0 && completed < steps.length) {
    const share = (steps.length - completed) / steps.length;
    estimateLeft = Math.max(0, Math.round(estimate.seconds * share - stepElapsed / 1000));
  }

  return (
    <div className="screen">
      <p className="eyebrow">Step {Math.min(completed + 1, steps.length)} of {steps.length}</p>
      <h1>{input && input.construct ? input.construct : 'Building'}</h1>

      {/* Two timers answer different questions. The total shows how long the
          process has been going, while the step timer helps someone tell whether
          the current step may have stalled. */}
      <div className="clocks">
        <div className="clock">
          <span className="clock-label">Total</span>
          <span className="clock-value">{clock(elapsedMs)}</span>
        </div>
        <div className="clock">
          <span className="clock-label">This step</span>
          <span className={'clock-value' + (stepStartedAt ? ' clock-live' : '')}>
            {stepStartedAt ? clock(stepElapsed) : '\u2014'}
          </span>
        </div>
        <div className="clock">
          <span className="clock-label">Completed</span>
          <span className="clock-value">{completed} of {steps.length}</span>
        </div>
      </div>

      {/* Estimated time remaining appears below the timers because it is not a
          measurement. Keeping it separate makes clear that it is an estimate
          rather than another clock. */}
      {estimateLeft !== null && !error ? (
        <p className="run-remaining">
          <span className="run-remaining-value">{remaining(estimateLeft)} left</span>
          <span className="field-hint">
            {basisOf(estimate)}. Some steps take longer than others, so the progress bar may move at different speeds.
          </span>
        </p>
      ) : null}

      <RunParameters input={input} />

      {/* Progress is also stated in words because shape and position alone do not
          communicate the same information to a screen reader. */}
      <div aria-live="polite" className="sr-status">
        {states[currentIndex]
          ? 'Running step ' + (currentIndex + 1) + ', ' + steps[currentIndex].name
          : ''}
      </div>

      {error ? (
        <div className="banner error" role="alert">
          {error}
          <span className="value">
            The record of completed work is kept and can still be exported.
          </span>
        </div>
      ) : null}

      {/* Completed steps remain visible with their summaries. Someone returning
          after several minutes can review what has already happened instead of
          seeing only the current step. */}
      <StepTimeline steps={steps} states={states} stepElapsed={stepElapsed} />

      {/* More detail about the current work is available when needed but stays
          collapsed by default. The summaries provide enough information for
          ordinary use without filling the screen with unnecessary detail. */}
      {notes && notes.length > 0 ? (
        <details className="advanced activity">
          <summary>
            <span className="disclosure" aria-hidden="true" />
            <span className="spec-section-title">Activity</span>
            <span className="spec-section-count">{notes.length} recent</span>
          </summary>
          <ol className="activity-log">
            {notes.slice().reverse().map(function (item, index) {
              return (
                <li key={item.at + '-' + index}>
                  <span className="activity-step value">
                    {String(item.number).padStart(2, '0')}
                  </span>
                  <span className="activity-text">{item.text}</span>
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}

      <div className="actions">
        <button onClick={onCancel} disabled={cancelling || Boolean(error)}>
          {cancelling ? 'Finishing current step' : 'Cancel'}
        </button>
      </div>
      {cancelling ? (
        <p className="field-hint">
          A local model cannot stop once it has started a task, so the current step will
          finish before the process stops. No later steps will begin.
        </p>
      ) : null}
    </div>
  );
}
