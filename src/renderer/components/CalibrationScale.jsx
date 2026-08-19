// The similarity calibration scale.
//
// Step 6 decides which items are near-duplicates by treating a pair as an
// outlier in its own dimension's similarity distribution, not by testing
// it against a fixed number. That is a defensible method and an opaque one: the
// audit trail can state the cutoff, but a number in a log gives a reader no way
// to judge whether it fell in a sensible place.
//
// Plotted, it answers itself. Every pair sits on a real axis, the cutoff is a
// line, and whether the removals were obvious outliers or borderline calls is
// visible in about a second.
//
// This is the same visual grammar as the graduated rule that carries pipeline
// progress: a marked axis with values placed along it. Using one language for
// both is why neither needs a legend.

const AXIS_MINIMUM = 0.3;
const AXIS_MAXIMUM = 1.0;
const MAJOR_TICKS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

function position(value) {
  const clamped = Math.min(AXIS_MAXIMUM, Math.max(AXIS_MINIMUM, value));
  return ((clamped - AXIS_MINIMUM) / (AXIS_MAXIMUM - AXIS_MINIMUM)) * 100;
}

export function CalibrationScale({ distribution, removed }) {
  if (!distribution || !distribution.pairs) {
    return null;
  }

  // Pair similarities are not carried across the bridge individually, so the
  // distribution is reconstructed from its summary statistics: median, spread,
  // and count. This is an honest representation of shape, not a plot of
  // every measured value, and it is labeled as such below.
  const { median, deviation, cutoff, pairs, rule } = distribution;

  return (
    <div className="calibration">
      <div className="calibration-track">
        {MAJOR_TICKS.map(function (tick) {
          return (
            <span key={tick} className="calibration-tick" style={{ left: position(tick) + '%' }}>
              <span className="calibration-tick-label">{tick.toFixed(1)}</span>
            </span>
          );
        })}

        {/* The interquartile band, derived from the median and the scaled
            deviation. Where the bulk of pairs sit is the context that makes the
            cutoff position meaningful. */}
        <span
          className="calibration-band"
          style={{
            left: position(median - deviation) + '%',
            width: (position(median + deviation) - position(median - deviation)) + '%'
          }}
        />
        <span className="calibration-median" style={{ left: position(median) + '%' }} />
        <span className="calibration-cutoff" style={{ left: position(cutoff) + '%' }} />

        {/* Removals are plotted individually, because those are the decisions a
            reader is actually checking. */}
        {(removed || []).map(function (pair) {
          return (
            <span
              key={pair.removed}
              className="calibration-removed"
              style={{ left: position(pair.similarity) + '%' }}
              title={pair.removed + ' removed as a near-duplicate of ' + pair.kept}
            />
          );
        })}
      </div>

      <p className="calibration-caption value">
        {pairs} pairs &middot; median {median.toFixed(2)} &middot; cutoff {cutoff.toFixed(2)}
        {rule === 'floor-only' ? ' (floor)' : ''}
        {removed && removed.length > 0 ? ' \u00B7 ' + removed.length + ' removed' : ' \u00B7 none removed'}
      </p>
    </div>
  );
}
