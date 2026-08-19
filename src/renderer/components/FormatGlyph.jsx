// The shape of a response, as a picture.
//
// A card that names twelve formats and describes each in a paragraph asks the
// reader to hold twelve descriptions in mind and compare them. A picture on
// each card lets them compare at a glance, because the difference between
// a two-sided scale and a one-sided one is a difference in shape before it is a
// difference in wording.
//
// Built from the same cells the application mark and icon use, so the drawings
// read as part of this application in place of as clip art. Four shapes cover
// every family in the catalog:
//
//   bipolar   cells of equal weight with a marked centre, heavier at both ends
//   unipolar  cells climbing from nothing at the left to full height at the right
//   binary    two large cells and nothing between them
//   numeric   a long rule with ticks, only the ends named
//
// Color is never the only signal. Each shape differs in silhouette, so the
// drawings still separate in the achromatopsia palette and in print.

const WIDTH = 132;
const HEIGHT = 44;

// One geometry function per shape, each returning the elements to draw. Kept as
// data and not as four separate components because the surrounding card,
// sizing, and accessible label are identical in every case, and four components
// differing only in their middle would drift apart.
function bipolarCells() {
  const count = 5;
  const cellWidth = 20;
  const gap = 6;
  const total = count * cellWidth + (count - 1) * gap;
  const left = (WIDTH - total) / 2;
  return Array.from({ length: count }, function (_, index) {
    const middle = index === (count - 1) / 2;
    // The ends carry more weight because they are the anchors a respondent
    // reads first and the points the scale is defined by.
    const end = index === 0 || index === count - 1;
    return {
      x: left + index * (cellWidth + gap),
      y: 14,
      width: cellWidth,
      height: 16,
      role: middle ? 'centre' : end ? 'end' : 'plain'
    };
  });
}

function unipolarCells() {
  const count = 5;
  const cellWidth = 20;
  const gap = 6;
  const total = count * cellWidth + (count - 1) * gap;
  const left = (WIDTH - total) / 2;
  return Array.from({ length: count }, function (_, index) {
    // Height carries the quantity, which is the whole point of a one-sided
    // scale: the left end is not an opposite, it is nothing.
    const height = 6 + index * 6;
    return {
      x: left + index * (cellWidth + gap),
      y: 36 - height,
      width: cellWidth,
      height,
      role: index === count - 1 ? 'end' : 'plain'
    };
  });
}

function binaryCells() {
  const cellWidth = 44;
  const gap = 12;
  const left = (WIDTH - (cellWidth * 2 + gap)) / 2;
  return [
    { x: left, y: 12, width: cellWidth, height: 20, role: 'end' },
    { x: left + cellWidth + gap, y: 12, width: cellWidth, height: 20, role: 'plain' }
  ];
}

function numericTicks() {
  const count = 11;
  const span = 108;
  const left = (WIDTH - span) / 2;
  return Array.from({ length: count }, function (_, index) {
    const major = index === 0 || index === count - 1;
    return {
      x: left + (span / (count - 1)) * index,
      major
    };
  });
}

const SHAPES = {
  bipolar: bipolarCells,
  unipolar: unipolarCells,
  binary: binaryCells
};

// A sentence for anyone who cannot see the drawing. The graphic is decorative
// only in the sense that the text beside it repeats the format's name; the
// shape itself is information, so it is described, not hidden.
const DESCRIPTIONS = {
  bipolar: 'A five point scale with two opposite ends and a marked middle.',
  unipolar: 'A five point scale climbing from nothing at the left to the most at the right.',
  binary: 'Two options and nothing between them.',
  numeric: 'A numbered line of eleven points with only the ends named.'
};

export function FormatGlyph({ shape }) {
  return (
    <svg
      className={'format-glyph shape-' + shape}
      viewBox={'0 0 ' + WIDTH + ' ' + HEIGHT}
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label={DESCRIPTIONS[shape] || 'A response scale.'}
    >
      {shape === 'numeric' ? (
        <>
          <line className="glyph-rule" x1="12" y1="24" x2={WIDTH - 12} y2="24" />
          {numericTicks().map(function (tick, index) {
            return (
              <line
                key={index}
                className={'glyph-tick' + (tick.major ? ' major' : '')}
                x1={tick.x}
                y1={tick.major ? 14 : 19}
                x2={tick.x}
                y2={tick.major ? 34 : 29}
              />
            );
          })}
        </>
      ) : (
        (SHAPES[shape] || bipolarCells)().map(function (cell, index) {
          return (
            <rect
              key={index}
              className={'glyph-cell role-' + cell.role}
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              rx="3"
            />
          );
        })
      )}
    </svg>
  );
}
