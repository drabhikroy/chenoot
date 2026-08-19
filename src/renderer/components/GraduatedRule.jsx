// The graduated rule.
//
// Rebuilt from tick marks into segments. The previous version put nine hairline
// graduations on a single line, which was accurate, quiet, and almost invisible
// at the size it renders. It also asked the eye to infer progress from which
// marks had changed color, which is a lot to ask of a two pixel line.
//
// Each step is now a segment with its own fill, so progress is a quantity of
// color, not a change in a mark. The minor graduations stay inside the
// segments, because they were what made this read as an instrument and not
// a loading bar, and losing them would lose the reason the element exists.
//
// It appears on two screens: the opening, at rest, where it states what is
// about to happen, and the results certificate, complete, where it closes the
// same statement. The pipeline screen no longer uses it, because the timeline
// there carries the sequence better and showing it twice helped nobody.

const MINOR_PER_SEGMENT = 4;

export function GraduatedRule({ steps, currentIndex, failedIndex }) {
  return (
    <div className="rule" aria-hidden="true" data-current={currentIndex}>
      <div className="rule-track">
        {steps.map(function (step, index) {
          let state = 'pending';
          if (failedIndex === index) {
            state = 'failed';
          } else if (index < currentIndex) {
            state = 'done';
          } else if (index === currentIndex) {
            state = 'now';
          }

          // Minor graduations inside each segment, positioned, not
          // repeated as characters so they stay put when the type scale moves.
          const minors = [];
          for (let minor = 1; minor <= MINOR_PER_SEGMENT; minor += 1) {
            minors.push(
              <span
                key={minor}
                className="rule-minor"
                style={{ left: ((minor / (MINOR_PER_SEGMENT + 1)) * 100) + '%' }}
              />
            );
          }

          return (
            <div
              className={'rule-segment ' + state}
              key={step.name}
              style={{ animationDelay: (index * 45) + 'ms' }}
            >
              <span className="rule-label">{step.short}</span>
              <span className="rule-bar">{minors}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
