// Writes the icon set out as standalone SVG files under brand.
//
// Everything here is generated from the same geometry the application renders,
// so an icon corrected on screen is corrected in the exported file without
// anybody having to remember. Nothing in brand is edited by hand.
//
// What gets written:
//
//   chenoot-icon.svg        the application icon, rounded field and all
//   chenoot-icon-flat.svg   the same mark with no field, for light backgrounds
//   chenoot-mark.svg        one row of the grid, the wordmark glyph
//   items/*.svg             the thirty-three item type icons
//
// The item icons use currentColor so they inherit whatever they are placed in,
// which is what makes them usable in a readme, a slide, or a docs site without
// a second export in another color.

const fs = require('node:fs');
const path = require('node:path');
const { ICONS, SIZE } = require('../src/renderer/reference/type-icons.js');

const OUT = path.join(__dirname, '..', 'brand');

// The palette values the application uses, written into the field icons as
// literals because an SVG file on a readme has no stylesheet to read them from.
const FIELD = '#141312';
const INK = '#EDE9E1';
const ACCENT = '#45C8E8';
const MUTED = '#8B857C';

function open(width, height, extra) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '"' +
    ' width="' + width + '" height="' + height + '"' + (extra || '') + '>';
}

// The application icon: three items on a five point scale, the same grid the
// interface mark carries at one row.
function iconBody(withField) {
  const columns = 5;
  const rows = 3;
  const cellWidth = 10.4;
  const cellHeight = 12.6;
  const columnGap = 2.2;
  const rowGap = 6.4;
  const gridWidth = columns * cellWidth + (columns - 1) * columnGap;
  const gridHeight = rows * cellHeight + (rows - 1) * rowGap;
  const originX = (100 - gridWidth) / 2;
  const originY = (100 - gridHeight) / 2 - 0.9;
  const answers = [3, 0, 2];

  let out = '';
  if (withField) {
    out += '<rect x="5.5" y="5.5" width="89" height="89" rx="22.5" fill="' + FIELD + '"/>';
  }
  answers.forEach(function (answer, row) {
    const top = originY + row * (cellHeight + rowGap);
    for (let column = 0; column < columns; column += 1) {
      const left = originX + column * (cellWidth + columnGap);
      const chosen = column === answer;
      const fill = chosen ? ACCENT : (withField ? MUTED : INK);
      const opacity = chosen ? '1' : (withField ? '0.92' : '0.3');
      out += '<rect x="' + round(left) + '" y="' + round(top) + '" width="' + cellWidth +
        '" height="' + cellHeight + '" rx="3.2" fill="' + fill + '" opacity="' + opacity + '"/>';
    }
  });
  return out;
}

// One row of the same grid, in currentColor, for use beside a wordmark.
function markBody() {
  const cells = [1.5, 6, 10.5, 15, 19.5];
  return cells.map(function (x, index) {
    return '<rect x="' + x + '" y="8.4" width="3.5" height="7.2" rx="1.2"' +
      ' fill="currentColor" opacity="' + (index === 2 ? '1' : '0.3') + '"/>';
  }).join('');
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// The item icons, built from the same shape descriptors the component reads. Class names become presentation attributes, since a standalone file
// carries no stylesheet.
function shapeToSvg(shape) {
  const stroke = shape.cls === 'mark' ? 'currentColor' : 'currentColor';
  const opacity = shape.cls === 'mark' ? '1'
    : shape.cls === 'outline' ? '0.65'
    : shape.cls === 'reverse' ? '0.15'
    : '0.85';

  if (shape.kind === 'rect') {
    const filled = shape.cls === 'mark' || shape.cls === 'ink';
    return '<rect x="' + shape.x + '" y="' + shape.y + '" width="' + shape.w +
      '" height="' + shape.h + '" rx="1.6"' +
      (filled
        ? ' fill="currentColor" opacity="' + (shape.cls === 'mark' ? '0.85' : '0.55') + '"'
        : ' fill="none" stroke="currentColor" stroke-width="1.4" opacity="' + opacity + '"') +
      '/>';
  }
  if (shape.kind === 'line') {
    return '<line x1="' + shape.x1 + '" y1="' + shape.y1 + '" x2="' + shape.x2 +
      '" y2="' + shape.y2 + '" stroke="' + stroke + '" stroke-width="' +
      (shape.cls === 'mark' ? 1.8 : 1.6) + '" stroke-linecap="round" opacity="' + opacity + '"/>';
  }
  if (shape.kind === 'circle') {
    return '<circle cx="' + shape.cx + '" cy="' + shape.cy + '" r="' + shape.r +
      '" fill="currentColor" opacity="' + opacity + '"/>';
  }
  if (shape.kind === 'ring') {
    return '<circle cx="' + shape.cx + '" cy="' + shape.cy + '" r="' + shape.r +
      '" fill="none" stroke="currentColor" stroke-width="' +
      (shape.cls === 'mark' ? 1.8 : 1.4) + '" opacity="' + opacity + '"/>';
  }
  return '<path d="' + shape.d + '" fill="none" stroke="currentColor" stroke-width="1.8"' +
    ' stroke-linecap="round" stroke-linejoin="round" opacity="' + opacity + '"/>';
}

function build() {
  fs.mkdirSync(path.join(OUT, 'items'), { recursive: true });

  fs.writeFileSync(
    path.join(OUT, 'chenoot-icon.svg'),
    open(100, 100) + iconBody(true) + '</svg>\n'
  );
  fs.writeFileSync(
    path.join(OUT, 'chenoot-icon-flat.svg'),
    open(100, 100, ' fill="none"') + iconBody(false) + '</svg>\n'
  );
  fs.writeFileSync(
    path.join(OUT, 'chenoot-mark.svg'),
    open(24, 24, ' fill="none"') + markBody() + '</svg>\n'
  );

  const names = Object.keys(ICONS).sort();
  names.forEach(function (name) {
    const body = ICONS[name].map(shapeToSvg).join('');
    fs.writeFileSync(
      path.join(OUT, 'items', name + '.svg'),
      open(SIZE, SIZE, ' fill="none"') + body + '</svg>\n'
    );
  });

  return { icons: names.length };
}

if (require.main === module) {
  const outcome = build();
  process.stdout.write('wrote 3 brand files and ' + outcome.icons + ' item icons\n');
}

module.exports = { build };
