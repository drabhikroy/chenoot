// What a model needs, shown against what this machine has.
//
// The three fit bands are a judgment, and a judgment with no arithmetic visible
// under it asks to be taken on trust. This is the arithmetic: the bar is the
// memory the machine reports, the filled part is what the model wants while it
// runs, and the notch is the point past which the operating system has nothing
// left for anything else. Someone comparing a seven billion parameter model
// against a fourteen can see the difference between them instead of reading
// two words that both begin with the same letter.
//
// Nothing is shown when the machine has not been read. An empty bar beside a
// model would suggest a measurement was taken and came back at zero, which is
// the opposite of what not knowing means.

// The margin that separates a model which runs from one which runs and leaves
// the machine usable. Matches the figure the catalog classifies against, and it
// is repeated here and not passed in because this is a drawing of that
// rule, not a second copy of it.
const HEADROOM_GB = 2;

export function MemoryFit({ needs, available, band }) {
  if (!available || !needs) {
    return null;
  }

  // The scale runs to whichever is larger, so a model that does not fit still
  // draws something, not a bar clipped at its own end. A little extra
  // room past the larger of the two keeps the notch off the edge.
  const ceiling = Math.max(available, needs) * 1.08;
  const share = function (value) {
    return Math.min(100, (value / ceiling) * 100);
  };

  const comfortable = available - HEADROOM_GB;

  return (
    <div className={'memfit band-' + band}>
      <div className="memfit-track" aria-hidden="true">
        {/* What the model takes. */}
        <span className="memfit-need" style={{ width: share(needs) + '%' }} />
        {/* Where this machine stops. Laid over the fill, not beside it,
            because the question is whether one passes the other. */}
        <span className="memfit-limit" style={{ left: share(available) + '%' }} />
        {/* And where it stops being comfortable, which is the line that decides
            the middle band. */}
        {comfortable > 0 ? (
          <span className="memfit-headroom" style={{ left: share(comfortable) + '%' }} />
        ) : null}
      </div>
      {/* The same numbers in words, for anyone reading this with a screen
          reader and for anyone who wants the figures and not the shape. */}
      <p className="memfit-legend">
        <span className="value">{needs} GB</span> needed of{' '}
        <span className="value">{available} GB</span> on this machine
      </p>
    </div>
  );
}
