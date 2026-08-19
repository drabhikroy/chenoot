// Icon geometry for the item types, as data.
//
// Held apart from the component that renders it because two things read it: the
// interface, and the script that writes the standalone SVG files under brand.
// Keeping one description means an icon corrected on screen is corrected in the
// exported file without anybody remembering to do it twice.

const SIZE = 40;
// Sized up from the forty unit grid it is described on. At native size the
// icons read as marks beside the text; at this size they read as the subject of
// the card, which is what the response format cards next door do with their
// shapes. Strokes scale with the viewBox, so nothing needs thickening by hand.
const RENDERED = 56;

// Primitive helpers. Terse on purpose: thirty-eight icons written longhand
// would be a thousand lines of near-identical JSX, and the shapes are easier to
// compare when each is one line.
function box(x, y, w, h, cls) {
  return { kind: 'rect', x, y, w, h, cls: cls || 'ink' };
}
function line(x1, y1, x2, y2, cls) {
  return { kind: 'line', x1, y1, x2, y2, cls: cls || 'ink' };
}
function dot(cx, cy, r, cls) {
  return { kind: 'circle', cx, cy, r, cls: cls || 'ink' };
}
function ring(cx, cy, r, cls) {
  return { kind: 'ring', cx, cy, r, cls: cls || 'ink' };
}
// A check mark scaled to the seven unit box it sits inside.
function tick(x, y, cls) {
  return {
    kind: 'path',
    d: 'M' + (x + 0.6) + ' ' + (y + 3.4) + 'l1.7 1.8 3.2-4.2',
    cls: cls || 'mark'
  };
}

// Three rows is the working unit for most of these, so the y positions are
// shared in place of repeated per icon.
const ROW = [9, 19.5, 30];

const ICONS = {
  // Open text: ruled lines of unequal length, which is what writing looks like.
  text: [line(6, 12, 34, 12), line(6, 20, 34, 20), line(6, 28, 24, 28, 'mark')],

  // A number typed into a field: the field, and a caret standing in for entry.
  'numeric-field': [box(6, 13, 28, 14, 'outline'), line(11, 17, 11, 23, 'mark'), line(15, 23, 24, 23)],

  // Several short answers, numbered.
  list: [
    dot(8, 11, 1.6), line(13, 11, 33, 11),
    dot(8, 20, 1.6), line(13, 20, 33, 20),
    dot(8, 29, 1.6), line(13, 29, 27, 29, 'mark')
  ],

  // Unordered categories: three boxes of equal weight, none marked.
  nominal: [box(6, 15, 8, 10, 'outline'), box(16, 15, 8, 10, 'outline'), box(26, 15, 8, 10, 'outline')],

  // Ordered categories: the same boxes climbing.
  ordinal: [box(6, 22, 8, 6, 'outline'), box(16, 18, 8, 10, 'outline'), box(26, 13, 8, 15, 'mark')],

  // A list plus a written extra.
  partial: [ring(9, 11, 3), line(15, 11, 33, 11), ring(9, 21, 3), line(15, 21, 33, 21),
    line(6, 31, 12, 31), line(15, 31, 33, 31, 'mark')],

  // Two alternatives, one taken.
  binary: [ring(13, 20, 6), dot(13, 20, 3, 'mark'), ring(28, 20, 6)],

  // Pick one of several.
  radio: [ring(9, ROW[0], 3, 'mark'), dot(9, ROW[0], 1.5, 'mark'), line(15, ROW[0], 33, ROW[0]),
    ring(9, ROW[1], 3), line(15, ROW[1], 33, ROW[1]),
    ring(9, ROW[2], 3), line(15, ROW[2], 33, ROW[2])],

  // Any number, and the unticked rows stay visibly unanswered.
  checkbox: [box(6, ROW[0] - 3.5, 7, 7, 'outline'), tick(7.5, ROW[0] - 2.4), line(17, ROW[0], 33, ROW[0]),
    box(6, ROW[1] - 3.5, 7, 7, 'outline'), line(17, ROW[1], 33, ROW[1]),
    box(6, ROW[2] - 3.5, 7, 7, 'outline'), tick(7.5, ROW[2] - 2.4), line(17, ROW[2], 33, ROW[2])],

  // Forced choice: a judgment against every row, yes or no, none left blank.
  forced: [
    ring(9, ROW[0], 2.6, 'mark'), ring(17, ROW[0], 2.6), line(23, ROW[0], 34, ROW[0]),
    ring(9, ROW[1], 2.6), ring(17, ROW[1], 2.6, 'mark'), line(23, ROW[1], 34, ROW[1]),
    ring(9, ROW[2], 2.6, 'mark'), ring(17, ROW[2], 2.6), line(23, ROW[2], 34, ROW[2])
  ],

  // Ranking: numbered positions against rows of differing order.
  rank: [box(6, ROW[0] - 4, 7, 8, 'mark'), line(17, ROW[0], 33, ROW[0]),
    box(6, ROW[1] - 4, 7, 8, 'outline'), line(17, ROW[1], 33, ROW[1]),
    box(6, ROW[2] - 4, 7, 8, 'outline'), line(17, ROW[2], 33, ROW[2])],

  // Two at a time, one chosen.
  paired: [box(5, 14, 13, 12, 'mark'), box(22, 14, 13, 12, 'outline')],

  // Words standing for degrees: stepped blocks with no scale under them, which
  // is the whole point. Natural-metric next door has a ruled axis; this has
  // nothing to measure against, and the two icons differ in exactly the way the
  // two formats do.
  vague: [box(6, 24, 6, 7, 'outline'), box(14, 20, 6, 11, 'outline'),
    box(22, 16, 6, 15, 'mark'), box(30, 22, 6, 9, 'outline')],

  // Real ranges: a ruled axis with divisions.
  ranges: [line(6, 26, 34, 26), line(9, 21, 9, 26), line(17, 21, 17, 26),
    line(25, 21, 25, 26), line(33, 21, 33, 26), box(17, 14, 8, 5, 'mark')],

  // None upward.
  unipolar: [box(6, 26, 5, 5, 'outline'), box(13, 22, 5, 9, 'outline'),
    box(20, 17, 5, 14, 'outline'), box(27, 11, 5, 20, 'mark')],

  // Opposite ends with a middle.
  bipolar: [box(5, 16, 6, 9, 'outline'), box(13, 16, 6, 9, 'outline'),
    box(21, 16, 6, 9, 'mark'), box(29, 16, 6, 9, 'outline'), line(5, 30, 35, 30)],

  // Direction first, then intensity.
  branch: [box(4, 16, 9, 8, 'mark'), line(13, 20, 20, 12), line(13, 20, 20, 28),
    box(21, 8, 13, 8, 'outline'), box(21, 24, 13, 8, 'outline')],

  standard: [box(6, 10, 28, 6, 'outline'), ring(9, 25, 3, 'mark'), line(15, 25, 33, 25)],

  // A gate: pass or stop.
  screen: [line(20, 6, 20, 34), dot(12, 20, 3, 'mark'),
    line(26, 16, 33, 16), line(26, 20, 33, 20), line(26, 24, 33, 24)],

  // One answer routes two ways.
  filter: [dot(9, 20, 3, 'mark'), line(12, 20, 20, 20), line(20, 20, 28, 11),
    line(20, 20, 28, 29), line(28, 11, 34, 11), line(28, 29, 34, 29)],

  // Indented, because it hangs off the item above it.
  followup: [line(6, 11, 32, 11), line(11, 17, 11, 27), line(11, 27, 17, 27),
    line(17, 27, 33, 27, 'mark')],

  standalone: [box(9, 12, 22, 16, 'outline'), line(13, 20, 27, 20, 'mark')],

  // Rows sharing one set of columns. Three rows of two columns hanging under a
  // header rule.
  grid: [line(13, 7, 13, 34), line(6, 13, 34, 13),
    ring(20, 19, 2), ring(29, 19, 2, 'mark'),
    ring(20, 25.5, 2, 'mark'), ring(29, 25.5, 2),
    ring(20, 32, 2), ring(29, 32, 2, 'mark'),
    line(6, 19, 10, 19), line(6, 25.5, 10, 25.5), line(6, 32, 10, 32)],

  // Different quantities per row.
  matrix: [line(6, 13, 34, 13), line(15, 7, 15, 34), line(25, 7, 25, 34),
    line(7, 20, 13, 20), line(18, 20, 23, 20, 'mark'), line(28, 20, 33, 20, 'mark'),
    line(7, 28, 13, 28), line(18, 28, 23, 28), line(28, 28, 33, 28)],

  // The chevron sits inside the field with room around it. It was set against
  // the right edge and the stroke overhung the border.
  dropdown: [box(6, 14, 28, 12, 'outline'), line(9, 20, 21, 20),
    line(25, 18, 28, 21.5, 'mark'), line(28, 21.5, 31, 18, 'mark')],

  slider: [line(6, 20, 34, 20), dot(24, 20, 4.5, 'mark'), line(6, 16, 6, 24), line(34, 16, 34, 24)],

  drag: [box(6, 8, 28, 8, 'outline'), box(6, 26, 28, 8, 'outline'),
    box(10, 17, 20, 8, 'mark'), line(14, 21, 26, 21, 'reverse')],

  arrows: [box(5, 14, 20, 12, 'outline'), line(30, 18, 30, 11), line(27, 14, 30, 11),
    line(33, 14, 30, 11), line(30, 23, 30, 30, 'mark'), line(27, 27, 30, 30, 'mark'),
    line(33, 27, 30, 30, 'mark')],

  fields: [box(5, 15, 9, 11, 'outline'), box(16, 15, 9, 11, 'outline'),
    box(27, 15, 9, 11, 'outline'), dot(15, 24, 0.9), dot(26, 24, 0.9)],

  total: [line(8, 9, 27, 9), line(8, 15, 27, 15), line(8, 21, 27, 21),
    line(6, 26, 34, 26), line(8, 32, 24, 32, 'mark')],

  // A fact: fixed, and the same whoever is asked.
  fact: [box(8, 8, 24, 24, 'outline'), line(13, 16, 27, 16), line(13, 22, 22, 22, 'mark')],

  // A judgment: a position held somewhere in a range, off centre because an
  // opinion is a place on a scale and not a middle.
  //
  // This was a ring with two dashes and a mouth line, which was a face. A face
  // is the one thing this set must not contain: it turns a property of an item
  // into a feeling emoji, and it is the reflex every generated icon set falls
  // into for anything to do with opinion.
  attitude: [line(7, 26, 33, 26), line(7, 22, 7, 30), line(33, 22, 33, 30),
    dot(25, 26, 4, 'mark'), line(25, 11, 25, 20), dot(25, 9, 1.8)],

  // Something that happened, on a timeline.
  behavior: [line(5, 26, 35, 26), dot(12, 26, 2.6, 'mark'), dot(21, 26, 2.6, 'mark'),
    dot(30, 26, 2.6), line(12, 14, 12, 22), line(21, 18, 21, 22)]
};


module.exports = { SIZE, RENDERED, ICONS };
