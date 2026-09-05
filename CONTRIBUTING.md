# Contributing to Chenoot

## Before you start

Chenoot is an Electron application. Node and npm are the only
prerequisites. Install dependencies with `npm install`.

## Running the app

Run `npm start`, which builds the renderer bundle with esbuild and
launches Electron.

## Running the tests

Run `npm test`, which runs the standards check first (via the
`pretest` script) and then the Node test suite in `test/*.test.js`.
`npm run verify` adds a smoke test and a screenshot pass on top of
that, and is what a release build runs before packaging.

## Adding a reference instrument

Step 3's citation check is a conservative catalog of published scales
in `src/main/pipeline/spec/reference-instruments.js`; an addition
needs a name, first author, and year confident enough to state
outright, since an entry here is what turns a fabricated citation into
a caught one.

## Adding a response scale

The response scale catalog in `src/main/pipeline/scales/catalog.js` is
organized by whether a construct is unipolar or bipolar; a new scale
belongs under whichever distinction it actually measures, not by point
count alone.

## Style

`standards/lexicon.js` holds the banned lexicon as word roots rather
than surface forms, so a ban on "align" also catches "aligned" and
"alignment." `standards/prose.js` checks source, comments, and
documentation against it, and also rejects forbidden characters and
contractions. Run with `npm run standards`, or automatically before
`npm test`.

## Accessibility

`standards/color.js` and `test/audit-palettes.js` check every semantic
color twice: WCAG contrast against its background, and chromatic
separation from every other status color for a color-vision-deficient
viewer. Both run as part of `npm run standards`.
