import { ICONS, SIZE, RENDERED } from '../reference/type-icons.js';

// One icon per item type, rendered from the shared geometry.
//
// Every icon shows the response task in place of illustrating the subject. A
// check-all is a column with some boxes ticked and some not; a forced choice is
// the same column with a mark against every row, because that is exactly the
// difference between the two formats and the difference is the thing people get
// wrong. An icon showing a clipboard for one and a list for the other would be
// decoration.

// Rectangles, lines, circles, rings, and paths are the whole vocabulary. A
// shape kind the geometry does not use would be a shape nothing draws, so the
// renderer stays short enough to check by reading.
export function ItemTypeGlyph({ name }) {
  // An unknown name falls back to the plainest icon in the set instead of
  // rendering nothing, so a type added to the taxonomy without an icon shows a
  // placeholder instead of a hole.
  const shapes = ICONS[name] || ICONS.standalone;
  return (
    <svg
      className="type-glyph"
      viewBox={'0 0 ' + SIZE + ' ' + SIZE}
      width={RENDERED}
      height={RENDERED}
      aria-hidden="true"
    >
      {shapes.map(function (shape, index) {
        if (shape.kind === 'rect') {
          return (
            <rect
              key={index}
              className={'tg-' + shape.cls}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx="1.6"
            />
          );
        }
        if (shape.kind === 'line') {
          return (
            <line
              key={index}
              className={'tg-' + shape.cls}
              x1={shape.x1}
              y1={shape.y1}
              x2={shape.x2}
              y2={shape.y2}
            />
          );
        }
        if (shape.kind === 'circle') {
          return (
            <circle key={index} className={'tg-' + shape.cls} cx={shape.cx} cy={shape.cy} r={shape.r} />
          );
        }
        if (shape.kind === 'ring') {
          return (
            <circle
              key={index}
              className={'tg-ring tg-' + shape.cls}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
            />
          );
        }
        return <path key={index} className={'tg-stroke tg-' + shape.cls} d={shape.d} />;
      })}
    </svg>
  );
}
