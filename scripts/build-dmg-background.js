// The background of the macOS disk image window, generated, not made by hand.
//
// The disk image opens as a Finder window with this picture behind three icons.
// Chenoot sits in the left well, the Applications shortcut in the right well,
// and the Installation Help file in the lower right corner. The positions of
// those icons are set in package.json and electron-builder.config.cjs, and the
// wells and arrows below are placed to meet them, so a change to one side needs
// the same change to the other.
//
// Rendered by Electron from the markup in this file, in the typeface the
// application uses, so the words can be changed by editing a string and running
// the script again. A picture made by hand in a drawing program keeps its old
// wording after the facts change, and this one once told people to remove
// macOS download protection by hand long after the application was notarized
// and no longer needed it.
//
// Two files are written. The first is at the size the window opens at, and the
// second is at twice that size for Retina displays. electron-builder finds the
// second by its name and combines the two, so Finder shows the sharp one where
// the display can use it.
//
// Run with a display, since Electron draws the page before it is captured:
//
//   npm run build:dmg-background
//
// and commit both files it writes. It is not part of the build, because the
// Linux and Windows release runners have no display and never need the picture.

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build');

// The window size, set in package.json under dmg.window. The height there is
// the whole window, title bar included, and the title bar takes twenty-eight
// points, which leaves this much for the picture.
const WIDTH = 820;
const HEIGHT = 587;

// Where Finder puts each icon, by the center of the icon, matching dmg.contents
// in package.json and the extra entry in electron-builder.config.cjs.
const APP_ICON = { x: 220, y: 217 };
const APPLICATIONS_ICON = { x: 590, y: 217 };
const HELP_ICON = { x: 590, y: 422 };

// Colors, taken from the interface palette's light theme so the installer and
// the application read as one product.
const PAPER = '#f3f3f5';
const INK = '#111a33';
const MUTED = '#3a4459';
const ACCENT = '#0a4bcf';
const WELL = '#8fb0ec';
const WAVE_LIGHT = '#dfe9fb';
const WAVE_MID = '#c9dcf8';
const WAVE_DEEP = '#b4cff5';
const RULE = '#8aaae5';

// The words in the lower panel. Written for a notarized application: the only
// thing a person normally sees on first launch is the question macOS asks
// about every application downloaded from the internet, and the help file
// covers the rest.
//
// The lines are kept as short as the ones they replace. The arrow toward the
// help icon starts where the last line ends, and the icon and its label sit
// to the right, so a longer line would run into both.
const HEADLINE = 'First time opening Chenoot?';
const BODY = [
  'macOS asks once before opening it.',
  'Choose Open. For anything else,'
];
const LINK = 'double-click Installation Help.';

// The typefaces are embedded as data so the page does not depend on where it
// is loaded from. Lexend is the application's own face. Caveat, a handwritten
// face under the SIL Open Font License, sets the one hand-lettered note beside
// the drag arrow. It lives beside this script with its license, and it is only
// used here, never shipped inside the application.
function fontFace() {
  const lexend = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'fonts', 'lexend.woff2'));
  const caveat = fs.readFileSync(path.join(__dirname, 'fonts', 'caveat-latin-600-normal.woff2'));
  return '@font-face { font-family: "Lexend"; src: url(data:font/woff2;base64,' +
    lexend.toString('base64') + ') format("woff2"); font-weight: 100 900; }' +
    '@font-face { font-family: "Caveat"; src: url(data:font/woff2;base64,' +
    caveat.toString('base64') + ') format("woff2"); font-weight: 600; }';
}

// A rounded square with a dashed edge, centered on an icon position.
function well(center) {
  const size = 204;
  const x = center.x - size / 2;
  const y = center.y - size / 2 + 13;
  return '<rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size +
    '" rx="22" fill="none" stroke="' + WELL + '" stroke-width="1.5" stroke-dasharray="6 6"/>';
}

function page() {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    fontFace() +
    'html, body { margin: 0; padding: 0; background: ' + PAPER + '; }' +
    'svg { display: block; }' +
    'text { font-family: "Lexend", sans-serif; }' +
    '</style></head><body>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT +
    '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '">' +

    // Scattered squares in the upper corners, the same motif as the landing page.
    '<g fill="' + WAVE_MID + '">' +
    '<rect x="22" y="20" width="50" height="50" rx="10" opacity="0.9"/>' +
    '<rect x="91" y="56" width="31" height="31" rx="7" opacity="0.8"/>' +
    '<rect x="58" y="93" width="22" height="22" rx="5" fill="' + WELL + '"/>' +
    '<rect x="698" y="43" width="35" height="35" rx="8" opacity="0.9"/>' +
    '<rect x="747" y="72" width="31" height="31" rx="7" opacity="0.7"/>' +
    '<rect x="724" y="103" width="22" height="22" rx="5" fill="' + WELL + '"/>' +
    '</g>' +

    // The name and what the application is for.
    '<text x="' + WIDTH / 2 + '" y="78" text-anchor="middle" font-size="64" font-weight="250" ' +
    'letter-spacing="14" fill="' + INK + '">CHENOOT</text>' +
    '<text x="' + WIDTH / 2 + '" y="111" text-anchor="middle" font-size="17" font-weight="350" ' +
    'fill="' + MUTED + '">Auditable survey instrument construction</text>' +

    // Waves across the lower half, lightest at the back.
    '<path d="M0 262 C 120 236, 210 300, 350 300 S 600 262, 820 276 L 820 587 L 0 587 Z" fill="' + WAVE_LIGHT + '"/>' +
    '<path d="M0 312 C 160 292, 260 352, 420 336 S 690 300, 820 318 L 820 587 L 0 587 Z" fill="' + WAVE_MID + '" opacity="0.85"/>' +
    '<path d="M0 372 C 180 350, 330 402, 520 382 S 740 356, 820 366 L 820 587 L 0 587 Z" fill="' + WAVE_DEEP + '" opacity="0.55"/>' +

    // The two wells and the drag instruction between them.
    well(APP_ICON) + well(APPLICATIONS_ICON) +
    // The drag arrow, its hand-lettered note, and the stroke under the note.
    // Coordinates are measured from the original picture so the arrow keeps
    // its weight and position.
    '<line x1="355" y1="208" x2="451" y2="208" stroke="' + ACCENT +
    '" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M438 192 L454 208 L438 224" fill="none" stroke="' + ACCENT +
    '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<text x="408" y="256" text-anchor="middle" style="font-family: Caveat; font-size: 25px; ' +
    'font-weight: 600" fill="' + ACCENT + '" transform="rotate(-7 408 256)">Drag to install</text>' +
    '<path d="M359 284 Q 392 272 440 270" fill="none" stroke="' + ACCENT +
    '" stroke-width="3.5" stroke-linecap="round"/>' +

    // The help panel. A marker, a divider, the words, and an arrow toward the
    // help file's icon.
    '<circle cx="84" cy="' + (HELP_ICON.y - 12) + '" r="34" fill="' + ACCENT + '"/>' +
    '<text x="84" y="' + (HELP_ICON.y + 2) + '" text-anchor="middle" font-size="38" font-weight="600" ' +
    'fill="#ffffff">?</text>' +
    '<line x1="147" y1="' + (HELP_ICON.y - 40) + '" x2="147" y2="' + (HELP_ICON.y + 50) +
    '" stroke="' + ACCENT + '" stroke-width="1.5" opacity="0.6"/>' +
    '<text x="168" y="' + (HELP_ICON.y - 20) + '" font-size="19" font-weight="600" fill="' + INK + '">' +
    HEADLINE + '</text>' +
    BODY.map(function (line, i) {
      return '<text x="168" y="' + (HELP_ICON.y + 6 + i * 22) + '" font-size="14.5" font-weight="350" ' +
        'fill="' + MUTED + '">' + line + '</text>';
    }).join('') +
    '<text id="link" x="168" y="' + (HELP_ICON.y + 6 + BODY.length * 22) + '" font-size="14.5" font-weight="600" ' +
    'fill="' + ACCENT + '">' + LINK + '</text>' +
    // The arrow from the end of the last line toward the help icon, measured
    // from the original picture like the drag arrow above.
    '<path d="M397 468 C 424 481, 466 473, 499 449" fill="none" stroke="' + ACCENT +
    '" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M478 442 L502 447 L488 470" fill="none" stroke="' + ACCENT +
    '" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +

    // A thin rule near the foot, closing the composition.
    '<line x1="33" y1="520" x2="787" y2="520" stroke="' + RULE + '" stroke-width="1"/>' +
    '</svg></body></html>';
}

// One window is used for both sizes. A second window opened in the same
// session fails to load its page, so the window is resized and zoomed between
// captures instead.
async function captureAt(win, scale, file) {
  win.setContentSize(WIDTH * scale, HEIGHT * scale);
  win.webContents.setZoomFactor(scale);
  // Text rendered before the embedded typeface loads comes out in a fallback
  // face, so the capture waits for the font and then for two more frames.
  await win.webContents.executeJavaScript(
    'document.fonts.ready.then(function () { return new Promise(function (r) { ' +
    'requestAnimationFrame(function () { requestAnimationFrame(r); }); }); })'
  );
  await new Promise(function (resolve) { setTimeout(resolve, 300); });
  // The arrow toward the help icon starts at x 397, so the line before it has
  // to end short of that or the two touch.
  const linkEnd = await win.webContents.executeJavaScript(
    'document.getElementById("link").getBBox().x + document.getElementById("link").getBBox().width'
  );
  if (linkEnd > 390) {
    throw new Error('The last panel line ends at ' + Math.round(linkEnd) + ', past the arrow at 397.');
  }
  const image = await win.webContents.capturePage({
    x: 0, y: 0, width: WIDTH * scale, height: HEIGHT * scale
  });
  const size = image.getSize();
  if (size.width !== WIDTH * scale || size.height !== HEIGHT * scale) {
    throw new Error(file + ' came out at ' + size.width + ' by ' + size.height +
      ', not ' + WIDTH * scale + ' by ' + HEIGHT * scale + '.');
  }
  fs.writeFileSync(path.join(OUT, file), image.toPNG());
  console.log('wrote build/' + file + ' at ' + size.width + ' by ' + size.height);
}

async function render() {
  const win = new BrowserWindow({
    show: false,
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    webPreferences: { offscreen: true }
  });
  const temp = path.join(os.tmpdir(), 'chenoot-dmg-background.html');
  fs.writeFileSync(temp, page());
  try {
    await win.loadFile(temp);
    await captureAt(win, 1, 'dmg-background.png');
    await captureAt(win, 2, 'dmg-background@2x.png');
  } finally {
    win.destroy();
    fs.unlinkSync(temp);
  }
}

app.disableHardwareAcceleration();
app.whenReady().then(async function () {
  try {
    await render();
    app.exit(0);
  } catch (error) {
    console.error(error.message);
    app.exit(1);
  }
});
