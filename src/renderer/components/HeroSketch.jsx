// A five point agreement item, sketched.
//
// The hero had a headline in the left half of a wide window and nothing in the
// right, which reads as a page that has not finished loading. What belongs
// there is the artifact the application makes, and the most recognizable form
// of it is a five point agreement scale.
//
// It is a sketch, not a rendered control on purpose. A pixel-perfect
// scale sitting beside the headline would look like a screenshot of the product
// and invite the reader to try clicking it. A drawing reads as an illustration
// of the idea, which is what the hero is for, and it leaves the working
// controls further down the page to be the real thing.
//
// The circles are made of two overlapping strokes each, slightly out of
// register, which is what a pencil going twice round a circle produces. Nothing
// here is random at runtime: the wobble is computed from the index, so the
// drawing is identical on every load and in every screenshot.

const ANCHORS = [
  'Strongly agree',
  'Agree',
  'Neither agree nor disagree',
  'Disagree',
  'Strongly disagree'
];

// The one the respondent picked. Second from the top, off centre, because a
// mark in the middle of a five point scale reads as a diagram of a scale and a
// mark anywhere else reads as somebody's answer.
const CHOSEN = 1;

const WIDTH = 340;
const ROW_HEIGHT = 74;
const CIRCLE_X = 46;
const RADIUS = 22;
// The distance between the two lines of a wrapped anchor, which is also what
// each line is offset from the circle's centre by.
const LINE_HEIGHT = 19;

// A closed path around a circle, with each of the four control points pushed
// off true by a small amount that depends on the seed. Two of these at slightly
// different seeds give the doubled line of a pencil stroke.
function wobblyCircle(cx, cy, radius, seed) {
  const k = radius * 0.5523;
  const nudge = function (step) {
    // A cheap repeatable jitter. The sine keeps it smooth, and the numbers are
    // chosen so no two circles in the column wobble the same way.
    return Math.sin(seed * 12.9898 + step * 4.1414) * (radius * 0.115);
  };

  const top = [cx + nudge(0), cy - radius + nudge(1)];
  const right = [cx + radius + nudge(2), cy + nudge(3)];
  const bottom = [cx + nudge(4), cy + radius + nudge(5)];
  const left = [cx - radius + nudge(6), cy + nudge(7)];

  return [
    'M', top[0], top[1],
    'C', top[0] + k, top[1], right[0], right[1] - k, right[0], right[1],
    'C', right[0], right[1] + k, bottom[0] + k, bottom[1], bottom[0], bottom[1],
    'C', bottom[0] - k, bottom[1], left[0], left[1] + k, left[0], left[1],
    'C', left[0], left[1] - k, top[0] - k, top[1], top[0], top[1],
    'Z'
  ].join(' ');
}

export function HeroSketch() {
  const height = ANCHORS.length * ROW_HEIGHT + 16;

  return (
    <svg
      className="hero-sketch"
      viewBox={'0 0 ' + WIDTH + ' ' + height}
      width="100%"
      height="100%"
      role="img"
      aria-label={
        'A sketch of a five point agreement scale, from strongly agree to strongly ' +
        'disagree, with the second option marked.'
      }
    >
      {ANCHORS.map(function (anchor, index) {
        const cy = 20 + index * ROW_HEIGHT + RADIUS;
        const chosen = index === CHOSEN;
        const words = anchor.split(' ');
        // Long anchors break over two lines at a sensible point in place of
        // running past the edge of the drawing.
        //
        // The break needs a second line with something in it. Strongly disagree
        // is seventeen characters and two words, so this rule fired and put
        // nothing on the second line: the anchor stayed where it was and was
        // offset upward by half a line height to make room for an empty string.
        // It sat above its circle while the other four sat level, which is hard
        // to see and easy to measure.
        const lines = (anchor.length > 18 && words.length > 2
          ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')]
          : [anchor]).filter(Boolean);

        return (
          <g key={anchor} className={'sketch-row' + (chosen ? ' chosen' : '')}>
            <path className="sketch-stroke" d={wobblyCircle(CIRCLE_X, cy, RADIUS, index + 1)} />
            <path
              className="sketch-stroke second"
              d={wobblyCircle(CIRCLE_X + 1.7, cy + 1.2, RADIUS - 1.6, index + 5.5)}
            />
            {chosen ? (
              <path className="sketch-fill" d={wobblyCircle(CIRCLE_X, cy, RADIUS * 0.52, 9.2)} />
            ) : null}

            {/* Centered on the circle by the renderer rather than by an offset
                chosen to look right. Text is positioned on its baseline by
                default, so a y equal to the circle's centre sets the label a
                little low, and the correction was guessed at: one line landed
                close and two lines did not, which is why the longest anchor sat
                below the circle it belongs to. Asking for the central baseline
                means the browser does the arithmetic with the metrics of the
                font actually in use. */}
            {lines.map(function (text, line) {
              const offset = lines.length === 1
                ? 0
                : (line === 0 ? -LINE_HEIGHT / 2 : LINE_HEIGHT / 2);
              return (
                <text
                  key={text}
                  className="sketch-label"
                  dominantBaseline="central"
                  x={CIRCLE_X + RADIUS + 24}
                  y={cy + offset}
                >
                  {text}
                </text>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
