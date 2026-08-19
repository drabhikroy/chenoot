// The application mark. One item on a five point scale, with the answer
// filled. It reads two ways on purpose: as a row of response anchors, and as
// the graduations on a measuring instrument. Those are the two senses of the
// word this whole application is built around, and the shape is the same
// object in both. Deliberately not a clipboard, a checklist, or a speech
// bubble. Those say survey by naming the artifact, which is the obvious move
// and the one every form product has already made. The icon is three of these
// rows stacked, and a wordmark glyph sharing none of its vocabulary made the
// two look like marks for different applications. One row is what survives
// being twenty-two pixels wide. Rendered, not shipped as an image so it
// inherits the palette, works at any size without a second asset, and stays
// legible in monochrome.

// Three items on a five point scale, which is the application icon at the size
// a menu bar allows. The cells sit thinner and closer than the icon's, because
// a shape reduced to twenty-two pixels loses its gaps first. Below about
// eighteen pixels the rows merge and the mark reads as three bars, which is
// the floor this works to.
const COLUMNS = [1.4, 5.9, 10.4, 14.9, 19.4];
const ROWS = [4.6, 10.2, 15.8];
const CELL_WIDTH = 3.2;
const CELL_HEIGHT = 3.8;

// Which position each row is answered at. The icon's pattern, so the two are
// the same object at two sizes.
const ANSWERS = [3, 0, 2];

export function Mark({ size }) {
  const box = size || 22;
  return (
    <svg
      className="mark-glyph"
      width={box}
      height={box}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {ROWS.map(function (y, row) {
        return COLUMNS.map(function (x, column) {
          return (
            <rect
              key={String(row) + ':' + String(column)}
              x={x}
              y={y}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              rx={1}
              fill="currentColor"
              // The same ratio the icon uses, so the unanswered cells recede by
              // the same amount when the two appear near each other.
              opacity={column === ANSWERS[row] ? 1 : 0.3}
            />
          );
        });
      })}
    </svg>
  );
}
