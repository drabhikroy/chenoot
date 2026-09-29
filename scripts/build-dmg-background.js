// The background of the macOS disk image window, generated, not made by hand.
//
// The disk image opens as a Finder window with this picture behind three icons.
// Chenoot and the Applications shortcut sit together in one region with the
// drag arrow between them, three numbered steps run beneath, and the
// Installation Help file sits in the lower right corner. The positions of
// those icons are set in package.json and electron-builder.config.cjs, and the
// region and arrow below are placed to meet them, so a change to
// one side needs the same change to the other.
//
// Rendered by Electron from the markup in this file, in the typeface the
// application uses, so the words can be changed by editing a string and running
// the script again. A picture made by hand in a drawing program keeps whatever
// it says until someone reopens the drawing, and installer text has to change
// whenever the way the application is signed or installed changes.
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
//
// The two icons of the drag sit 310 points apart. Dragging time grows with
// distance for a target of a given size (Fitts, 1954), and the Applications
// folder is a large target, so a shorter span costs nothing in accuracy. The
// help file sits in the lower right corner, out of the path of the drag, so the
// window offers two main icons and not three equally weighted ones (Hick, 1952).
const APP_ICON = { x: 255, y: 232 };
const APPLICATIONS_ICON = { x: 565, y: 232 };
const HELP_ICON = { x: 700, y: 452 };

// Colors for the installer window. These are cool blues of the installer's own
// and not the warm paper and teal of the application's interface.
const PAPER = '#f4f5f8';
const INK = '#111a33';
const MUTED = '#4a5468';
const ACCENT = '#0a4bcf';
const REGION = '#e3ecfb';
const CORNER_LIGHT = '#cfdcf6';
const CORNER_DEEP = '#9cb8ee';
const RULE = '#c9d6ee';

// Finder always draws this window in its light appearance when it has a
// background picture, whatever the system setting, and sets the icon labels
// in black on top of it. A window with no picture follows Dark Mode instead,
// but then it shows no picture at all, and Finder offers no way to supply a
// second one for Dark Mode. So this one light design is what everyone sees,
// and the black labels sit directly on the pale background at better than
// fifteen to one.

// The three steps, in the order they are done.
//
// Running an application straight from the mounted disk image is a common
// first install mistake on macOS, so the sequence runs past the drag to
// opening Chenoot and ejecting the disk.
//
// The second step says what the first launch dialog should report before it
// says which button to press. Attention to security prompts drops sharply once
// people learn to dismiss them without reading (Anderson et al., CHI 2015), and
// warnings are followed more often when people understand what they are being
// told (Felt et al., CHI 2015). Anyone who sees something else is sent to the
// help file instead of to the Open button.
const STEPS = [
  { title: 'Drag to Applications', lines: ['Copy Chenoot onto', 'this Mac.'] },
  { title: 'Open Chenoot', lines: ['macOS should confirm', 'Apple checked it.', 'Then choose Open.'] },
  { title: 'Eject this disk', lines: ['Chenoot runs from', 'Applications, not here.'] }
];
const STEP_X = [50, 250, 450];
const STEP_Y = 426;
const FALLBACK = 'Something different on screen? Open Installation Help, on the right.';

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
function step(number, x, content) {
  return '<g id="step' + number + '">' +
    '<circle cx="' + x + '" cy="' + (STEP_Y - 5) + '" r="13" fill="' + ACCENT + '"/>' +
    '<text x="' + x + '" y="' + STEP_Y + '" text-anchor="middle" font-size="14" font-weight="600" ' +
    'fill="#ffffff">' + number + '</text>' +
    '<text x="' + (x + 22) + '" y="' + STEP_Y + '" font-size="15" font-weight="600" fill="' + INK + '">' +
    content.title + '</text>' +
    content.lines.map(function (line, i) {
      return '<text x="' + (x + 22) + '" y="' + (STEP_Y + 21 + i * 18) + '" font-size="12.5" ' +
        'font-weight="350" fill="' + MUTED + '">' + line + '</text>';
    }).join('') +
    '</g>';
}

function page() {
  const dx = (APP_ICON.x + APPLICATIONS_ICON.x) / 2 - 405;
  const dy = APP_ICON.y - 8 - 208;
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    fontFace() +
    'html, body { margin: 0; padding: 0; background: ' + PAPER + '; }' +
    'svg { display: block; }' +
    'text { font-family: "Lexend", sans-serif; }' +
    '</style></head><body>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT +
    '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '">' +

    // Small brand squares in the upper corners, quieter than the landing page
    // so they frame the window without drawing the eye.
    '<g fill="' + CORNER_LIGHT + '">' +
    '<rect x="24" y="22" width="30" height="30" rx="7"/>' +
    '<rect x="60" y="44" width="18" height="18" rx="4" fill="' + CORNER_DEEP + '"/>' +
    '<rect x="760" y="22" width="30" height="30" rx="7"/>' +
    '<rect x="742" y="44" width="18" height="18" rx="4" fill="' + CORNER_DEEP + '"/>' +
    '</g>' +

    // The name and what the application is for, kept small so the drag below
    // is the first thing the eye lands on.
    '<text x="' + WIDTH / 2 + '" y="60" text-anchor="middle" font-size="40" font-weight="250" ' +
    'letter-spacing="10" fill="' + INK + '">CHENOOT</text>' +
    '<text x="' + WIDTH / 2 + '" y="86" text-anchor="middle" font-size="14" font-weight="350" ' +
    'fill="' + MUTED + '">Auditable survey instrument construction</text>' +

    // One shared region behind the application, the arrow, and Applications.
    // Elements inside a common boundary are seen as belonging together
    // (Palmer, 1992), so the three read as one action.
    '<rect x="130" y="112" width="560" height="228" rx="28" fill="' + REGION + '"/>' +

    // The drag arrow, its hand-lettered note, and the stroke under the note,
    // with the same shapes, sizes, and spacing as the original window, moved
    // as one piece to sit between the two icons. The coordinates are measured
    // from the original picture, where the arrow ran from x 355 to 454 at y 208,
    // and dx and dy shift all of them together.
    '<line x1="' + (355 + dx) + '" y1="' + (208 + dy) + '" x2="' + (451 + dx) + '" y2="' + (208 + dy) +
    '" stroke="' + ACCENT + '" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M' + (438 + dx) + ' ' + (192 + dy) + ' L' + (454 + dx) + ' ' + (208 + dy) + ' L' + (438 + dx) +
    ' ' + (224 + dy) + '" fill="none" stroke="' + ACCENT +
    '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<text x="' + (408 + dx) + '" y="' + (256 + dy) + '" text-anchor="middle" style="font-family: Caveat; ' +
    'font-size: 25px; font-weight: 600" fill="' + ACCENT + '" transform="rotate(-7 ' + (408 + dx) + ' ' +
    (256 + dy) + ')">Drag to install</text>' +
    '<path d="M' + (359 + dx) + ' ' + (284 + dy) + ' Q ' + (392 + dx) + ' ' + (272 + dy) + ' ' + (440 + dx) +
    ' ' + (270 + dy) + '" fill="none" stroke="' + ACCENT + '" stroke-width="3.5" stroke-linecap="round"/>' +

    // The steps, a rule above them, and the pointer to the help file.
    '<line x1="40" y1="382" x2="600" y2="382" stroke="' + RULE + '" stroke-width="1"/>' +
    STEPS.map(function (content, i) { return step(i + 1, STEP_X[i], content); }).join('') +
    '<text id="fallback" x="' + STEP_X[0] + '" y="520" font-size="12.5" font-weight="350" fill="' +
    MUTED + '">' + FALLBACK + '</text>' +
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
  // Each step has to end before the next one begins, and the last step and
  // the pointer line have to end before the help icon, which reaches about
  // fifty six points left of its center.
  const ends = await win.webContents.executeJavaScript(
    '["step1", "step2", "step3", "fallback"].map(function (id) { ' +
    'var e = document.getElementById(id).getBBox(); return e.x + e.width; })'
  );
  for (let i = 0; i < 2; i += 1) {
    if (ends[i] > STEP_X[i + 1] - 16) {
      throw new Error('Step ' + (i + 1) + ' ends at ' + Math.round(ends[i]) + ', into step ' + (i + 2) + '.');
    }
  }
  if (Math.max(ends[2], ends[3]) > HELP_ICON.x - 62) {
    throw new Error('The steps run to ' + Math.round(Math.max(ends[2], ends[3])) + ', into the help icon.');
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
