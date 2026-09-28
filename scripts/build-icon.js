// The application icon, generated, not made by hand in a drawing tool.
//
// What the icon has to do, and what it must not do. It sits in a dock beside
// thirty other icons at forty pixels, so it has to be legible as a silhouette
// before it is legible as a picture. It must not be a clipboard, a checklist,
// or a speech bubble: those name the paper, which is the obvious move and the
// one every form product has already made. It shows the answer instead. Three
// rows of five radio buttons, one chosen in each, is the part of a
// questionnaire a respondent actually touches, and it is what every rating
// item looks like.
//
// The interface mark keeps the flat cells this icon started from. Rings merge
// into gray below about eighteen pixels, so at the twenty-two pixels a menu
// bar allows, filled cells are what survive. The two share the pattern of
// answers, so they still read as one object at two sizes.
//
// Generated from this file so the shape can be adjusted by editing
// coordinates, not by opening a drawing program and exporting again.
//
// PNG is written directly. The alternative was a dependency that renders SVG,
// and an icon is a few hundred filled shapes on a rounded field, which is
// less code to write than it is to justify pulling in a library for.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 1024;

// The field. A deep warm neutral, lighter along the top edge and darker at the
// foot, as a tile is when a light sits above it. It is not the interface
// background exactly, since an icon sits against wallpaper and not against the
// application and needs a little more weight than a screen surface does.
const FIELD_TOP = [40, 38, 35];
const FIELD_BOTTOM = [16, 15, 14];
// The unchosen radio buttons, shown as rings. Light enough that a ring one
// pixel wide still separates from the field at the size a dock renders.
const RING = [176, 170, 158];
// The chosen button, in the running blue. It is the only saturated element and
// it is what the eye lands on first, which is correct: the chosen point on a
// scale is the subject of the whole image.
const CHOSEN = [69, 200, 232];
// The dot inside the chosen button, in the warm off-white the interface uses
// for primary text.
const CORE = [237, 233, 225];

// A canvas of straight RGBA bytes, composited in floating point so that an
// edge lands between two pixels without stepping.
function canvas(size) {
  return { size, data: new Float32Array(size * size * 4) };
}

function blend(surface, x, y, color, alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= surface.size || y >= surface.size) {
    return;
  }
  const at = (y * surface.size + x) * 4;
  const data = surface.data;
  const kept = 1 - alpha;
  data[at] = data[at] * kept + color[0] * alpha;
  data[at + 1] = data[at + 1] * kept + color[1] * alpha;
  data[at + 2] = data[at + 2] * kept + color[2] * alpha;
  data[at + 3] = Math.min(1, data[at + 3] * kept + alpha);
}

// Coverage of one pixel by a rectangle, computed as overlapping area rather
// than as a membership test. This is the whole of the antialiasing: a shape
// covering a third of a pixel contributes a third of its color.
function fillRect(surface, left, top, right, bottom, color) {
  const from = Math.max(0, Math.floor(left));
  const to = Math.min(surface.size - 1, Math.ceil(right));
  const above = Math.max(0, Math.floor(top));
  const below = Math.min(surface.size - 1, Math.ceil(bottom));
  for (let y = above; y <= below; y += 1) {
    const height = Math.max(0, Math.min(bottom, y + 1) - Math.max(top, y));
    if (height <= 0) {
      continue;
    }
    for (let x = from; x <= to; x += 1) {
      const width = Math.max(0, Math.min(right, x + 1) - Math.max(left, x));
      if (width > 0) {
        blend(surface, x, y, color, width * height);
      }
    }
  }
}

// A rectangle with rounded ends, which is what every graduation on the rule is.
// Sampled, not solved, because the distance test is exact and a few
// hundred thousand samples cost nothing once.
//
// Weight is an argument, not a second color. The minor graduations are
// the same ink as the majors at reduced presence, and mixing a lighter color by
// hand would come apart the moment the field behind them changed.
function fillCapsule(surface, x, top, bottom, width, color, weight) {
  const radius = width / 2;
  const left = x - radius;
  const right = x + radius;
  const from = Math.max(0, Math.floor(left) - 1);
  const to = Math.min(surface.size - 1, Math.ceil(right) + 1);
  const above = Math.max(0, Math.floor(top - radius) - 1);
  const below = Math.min(surface.size - 1, Math.ceil(bottom + radius) + 1);

  for (let y = above; y <= below; y += 1) {
    for (let px = from; px <= to; px += 1) {
      // Four samples across each axis. Sixteen per pixel is more than the eye
      // can distinguish at any size this icon is rendered.
      let covered = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const cx = px + (sx + 0.5) / 4;
          const cy = y + (sy + 0.5) / 4;
          const clampedY = Math.max(top, Math.min(bottom, cy));
          const dx = cx - x;
          const dy = cy - clampedY;
          if (dx * dx + dy * dy <= radius * radius) {
            covered += 1;
          }
        }
      }
      if (covered > 0) {
        blend(surface, px, y, color, (covered / 16) * (weight === undefined ? 1 : weight));
      }
    }
  }
}

// The same shape lying down, which is what the baseline is. Written separately
// and not by swapping arguments, because a capsule given equal top and
// bottom is a circle, and that is exactly what the baseline became when it went
// through the vertical function.
function fillCapsuleH(surface, left, right, y, thickness, color, weight) {
  const radius = thickness / 2;
  const from = Math.max(0, Math.floor(left - radius) - 1);
  const to = Math.min(surface.size - 1, Math.ceil(right + radius) + 1);
  const above = Math.max(0, Math.floor(y - radius) - 1);
  const below = Math.min(surface.size - 1, Math.ceil(y + radius) + 1);

  for (let py = above; py <= below; py += 1) {
    for (let px = from; px <= to; px += 1) {
      let covered = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const cx = px + (sx + 0.5) / 4;
          const cy = py + (sy + 0.5) / 4;
          const clampedX = Math.max(left, Math.min(right, cx));
          const dx = cx - clampedX;
          const dy = cy - y;
          if (dx * dx + dy * dy <= radius * radius) {
            covered += 1;
          }
        }
      }
      if (covered > 0) {
        blend(surface, px, py, color, (covered / 16) * (weight === undefined ? 1 : weight));
      }
    }
  }
}

// A rectangle with rounded corners, for shapes wider than they are tall where a
// fully rounded end would turn them into a stadium. Sampled like everything
// else here, since the corner test is the same distance test.
function fillRounded(surface, left, top, right, bottom, radius, color, weight) {
  const from = Math.max(0, Math.floor(left) - 1);
  const to = Math.min(surface.size - 1, Math.ceil(right) + 1);
  const above = Math.max(0, Math.floor(top) - 1);
  const below = Math.min(surface.size - 1, Math.ceil(bottom) + 1);

  for (let y = above; y <= below; y += 1) {
    for (let x = from; x <= to; x += 1) {
      let covered = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const cx = x + (sx + 0.5) / 4;
          const cy = y + (sy + 0.5) / 4;
          if (cx < left || cx > right || cy < top || cy > bottom) {
            continue;
          }
          const nearX = Math.min(Math.max(cx, left + radius), right - radius);
          const nearY = Math.min(Math.max(cy, top + radius), bottom - radius);
          const dx = cx - nearX;
          const dy = cy - nearY;
          if (dx * dx + dy * dy <= radius * radius) {
            covered += 1;
          }
        }
      }
      if (covered > 0) {
        blend(surface, x, y, color, (covered / 16) * (weight === undefined ? 1 : weight));
      }
    }
  }
}

// The rounded field the whole mark sits on. Twenty-two percent of the width is
// the radius macOS uses for its own icons, and matching it is what keeps this
// from looking like a sticker placed on top of the dock and not a member of
// it. A vertical lift across the field, strongest at the top. This is four
// percent from top to bottom, which is below the threshold anyone would name
// as a gradient and enough that the square stops looking cut out.
function shadeAt(y, size) {
  const t = y / size;
  return [
    FIELD_TOP[0] + (FIELD_BOTTOM[0] - FIELD_TOP[0]) * t,
    FIELD_TOP[1] + (FIELD_BOTTOM[1] - FIELD_TOP[1]) * t,
    FIELD_TOP[2] + (FIELD_BOTTOM[2] - FIELD_TOP[2]) * t
  ];
}
function fillField(surface) {
  const size = surface.size;
  const inset = size * 0.055;
  const radius = size * 0.225;
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let covered = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const cx = x + (sx + 0.5) / 4;
          const cy = y + (sy + 0.5) / 4;
          if (cx < left || cx > right || cy < top || cy > bottom) {
            continue;
          }
          // Inside the rectangle, then outside only if it falls beyond the
          // corner arc it is nearest to.
          const nearX = Math.min(Math.max(cx, left + radius), right - radius);
          const nearY = Math.min(Math.max(cy, top + radius), bottom - radius);
          const dx = cx - nearX;
          const dy = cy - nearY;
          if (dx * dx + dy * dy <= radius * radius) {
            covered += 1;
          }
        }
      }
      if (covered > 0) {
        blend(surface, x, y, shadeAt(y, size), covered / 16);
      }
    }
  }
}

// The mark: four items, each answered on a five point scale.
//
// Three concepts were tried here and two were wrong in instructive ways.
//
// A single graduated rule, transferred from the interface mark, gave a small
// shape stranded in a large field and read as a map pin before it read as a
// scale. An icon is not a small copy of a wordmark; it has to hold a square.
//
// Four rails with a round marker on each held the square, and read immediately
// as an equalizer. A rail with a knob on it is the settings glyph in every
// application anyone has used, and an icon that says settings is worse than one
// that says nothing.
//
// The difference between a slider and a scale is that a scale has a fixed
// number of positions. Drawing the positions, not the track is what
// separates the two: five discrete cells with one filled is a response grid and
// cannot be read as anything continuous. It is also the actual artifact this
// application produces instead of a metaphor for it.
//
// The filled cells do not ascend or descend. A monotonic pattern reads as a
// chart trending upward, which would be a claim about results, not a
// picture of an instrument.
// A filled circle, made as a rounded square whose corner radius is its half
// width.
function disc(surface, cx, cy, radius, color, weight) {
  fillRounded(surface, cx - radius, cy - radius, cx + radius, cy + radius, radius, color, weight);
}

function drawMark(surface) {
  const unit = surface.size / 100;

  // Three items, not four. Twenty buttons held together at full size and
  // silted up at the forty pixels a dock actually renders, where the grid
  // stopped being a grid and became texture. Fifteen larger ones survive the
  // reduction, and three items says what four said.
  const COLUMNS = 5;
  const ROWS = 3;
  const pitch = 12.6 * unit;
  const rowPitch = 19 * unit;

  const gridWidth = (COLUMNS - 1) * pitch;
  const gridHeight = (ROWS - 1) * rowPitch;
  const originX = (surface.size - gridWidth) / 2;
  const originY = (surface.size - gridHeight) / 2 - 0.9 * unit;

  // Ring size and weight. The ring is as thick as a fifth of the button's
  // width, which is heavier than a radio button on screen. A ring made
  // to look right at a thousand pixels turns into a faint smudge at forty, so
  // the weight here is set by how it looks small.
  const outer = 5.2 * unit;
  const ringWidth = 1.7 * unit;

  // Which position each item was answered at. No two neighbors agree, and the
  // set trends in neither direction.
  const answers = [3, 0, 2];

  answers.forEach(function (answer, row) {
    const cy = originY + row * rowPitch;
    for (let column = 0; column < COLUMNS; column += 1) {
      const cx = originX + column * pitch;
      if (column === answer) {
        // A soft halo first, then the button, a light dot, and a blue center,
        // which makes the selected state a ring within a ring and separates it
        // from the plain rings around it at any size.
        disc(surface, cx, cy, outer * 1.5, CHOSEN, 0.16);
        disc(surface, cx, cy, outer * 1.06, CHOSEN, 1);
        disc(surface, cx, cy, outer * 0.62, CORE, 1);
        disc(surface, cx, cy, outer * 0.4, CHOSEN, 1);
      } else {
        disc(surface, cx, cy, outer, RING, 1);
        disc(surface, cx, cy, outer - ringWidth, shadeAt(cy, surface.size), 1);
      }
    }
  });
}

// A thin lighter line along the top edge of the tile, the way a lit tile
// catches light. Applied after the field so it sits over it and under nothing.
function drawRim(surface) {
  const size = surface.size;
  const inset = size * 0.055;
  const radius = size * 0.225;
  fillRounded(
    surface,
    inset + radius * 0.6, inset + size * 0.012,
    size - inset - radius * 0.6, inset + size * 0.02,
    size * 0.004, [255, 255, 255], 0.1
  );
}

function encodePng(surface) {
  const size = surface.size;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let at = 0;
  for (let y = 0; y < size; y += 1) {
    raw[at] = 0;
    at += 1;
    for (let x = 0; x < size; x += 1) {
      const from = (y * size + x) * 4;
      raw[at] = Math.round(Math.max(0, Math.min(255, surface.data[from])));
      raw[at + 1] = Math.round(Math.max(0, Math.min(255, surface.data[from + 1])));
      raw[at + 2] = Math.round(Math.max(0, Math.min(255, surface.data[from + 2])));
      raw[at + 3] = Math.round(Math.max(0, Math.min(255, surface.data[from + 3] * 255)));
      at += 4;
    }
  }

  const chunk = function (type, payload) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// The standard table-driven checksum, built once at load.
const CRC_TABLE = (function () {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}());

function crc32(buffer) {
  let c = -1;
  for (let n = 0; n < buffer.length; n += 1) {
    c = CRC_TABLE[(c ^ buffer[n]) & 0xFF] ^ (c >>> 8);
  }
  return c ^ -1;
}

// Downscaling by box average. Electron builder takes one large source and
// produces the platform sizes itself, but a small copy is written as well so
// the shape can be checked at the size it will actually be seen.
function reduce(surface, target) {
  const out = canvas(target);
  const factor = surface.size / target;
  for (let y = 0; y < target; y += 1) {
    for (let x = 0; x < target; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = Math.floor(y * factor); sy < Math.floor((y + 1) * factor); sy += 1) {
        for (let sx = Math.floor(x * factor); sx < Math.floor((x + 1) * factor); sx += 1) {
          const from = (sy * surface.size + sx) * 4;
          r += surface.data[from];
          g += surface.data[from + 1];
          b += surface.data[from + 2];
          a += surface.data[from + 3];
          count += 1;
        }
      }
      const to = (y * target + x) * 4;
      out.data[to] = r / count;
      out.data[to + 1] = g / count;
      out.data[to + 2] = b / count;
      out.data[to + 3] = a / count;
    }
  }
  return out;
}

function build() {
  const surface = canvas(SIZE);
  fillField(surface);
  drawRim(surface);
  drawMark(surface);

  const directory = path.join(__dirname, '..', 'build');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'icon.png'), encodePng(surface));
  fs.writeFileSync(path.join(directory, 'icon-128.png'), encodePng(reduce(surface, 128)));
  // The size a dock actually renders, checked because a mark that holds at a
  // thousand pixels can turn to mush at forty and there is no way to know
  // without looking.
  fs.writeFileSync(path.join(directory, 'icon-48.png'), encodePng(reduce(surface, 48)));
  return { size: SIZE };
}

if (require.main === module) {
  const outcome = build();
  process.stdout.write('icon written at ' + outcome.size + ' square\n');
}

module.exports = { build };
