// Emits palettes.css from palettes.js so the stylesheet and the audited values
// cannot drift apart. Run as part of the renderer build, not by hand.
//
// Custom properties are namespaced by mode and by palette on the document
// element, which means switching either is one attribute change and no
// stylesheet reload.

const fs = require('node:fs');
const path = require('node:path');
const { NEUTRALS, STATUS } = require('../src/renderer/tokens/palettes');

// Written on every renderer build. The renderer imports it, so what appears in
// the interface is the moment the bundle was produced and not anything
// declared by hand.
//
// The version comes from package.json for the same reason. Typing it into a
// second file leaves two numbers that have to be kept in step by hand, and the
// one that gets forgotten is the one people read.
fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'build-number.js'),
  '// Written by scripts/build-palettes.js on every renderer build.\n' +
  '// The value comes from package.json, so the version shown in the interface\n' +
  '// is always the version the application was packaged as. Editing this file\n' +
  '// by hand has no effect: the next build overwrites it.\n' +
  'export const BUILD_NUMBER = ' + JSON.stringify(require('../package.json').version) + ';\n',
  'utf8'
);

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'build-stamp.js'),
  'export const BUILD_STAMP = ' + JSON.stringify(
    new Date().toISOString().slice(0, 16).replace('T', ' ')
  ) + ';\n',
  'utf8'
);

function kebab(key) {
  return key.replace(/[A-Z]/g, function (character) { return '-' + character.toLowerCase(); });
}

const blocks = ['/* Generated from palettes.js by scripts/build-palettes.js. Do not edit. */'];

Object.keys(STATUS).forEach(function (palette) {
  ['dark', 'light'].forEach(function (mode) {
    const lines = ['[data-palette="' + palette + '"][data-mode="' + mode + '"] {'];
    Object.entries(NEUTRALS[mode]).forEach(function ([key, value]) {
      lines.push('  --color-' + kebab(key) + ': ' + value + ';');
    });
    Object.entries(STATUS[palette][mode]).forEach(function ([key, value]) {
      lines.push('  --status-' + key + ': ' + value + ';');
    });
    lines.push('}');
    blocks.push(lines.join('\n'));
  });
});

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'tokens', 'palettes.css'),
  blocks.join('\n\n') + '\n',
  'utf8'
);
