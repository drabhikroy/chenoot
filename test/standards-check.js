// House standards test suite. Run with: node test/standards.test.js
//
// This runs before the palette audit in the build script, on the reasoning that
// a violation caught on the first commit costs a minute and the same violation
// caught in month three costs an afternoon of rewriting comments.

const fs = require('fs');
const path = require('path');
const {
  findBannedTerms,
  findForbiddenCharacters,
  findContractions,
  commentDensity
} = require('../standards/prose');

const ROOT = path.join(__dirname, '..');
const SOURCE_EXTENSIONS = ['.js', '.jsx', '.css', '.md', '.html'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build']);

// Generated files are excluded. They are outputs of a build step, not
// anything a person wrote, so holding them to a comment density target or a
// vocabulary rule would be checking the wrong artifact. Both are reproducible
// from sources that are checked.
const GENERATED = new Set([
  'src/renderer/app.js',
  'src/renderer/build-stamp.js',
  'src/renderer/tokens/palettes.css',
  'design/palettes.generated.css'
]);

// The comment density target. Fifteen percent is the working figure across the
// portfolio.
//
// An upper bound was tried here and removed. The reasoning behind it was that
// comments outrunning their code signal a structural problem, but the first
// interface file written against it sat at fifty-six percent while being
// exactly as long as it should be: a file whose entire job is to declare a
// contract is mostly contract. A rule that fires on correct code is worse than
// no rule, so only the floor remains.
const DENSITY_FLOOR = 0.15;

// The lexicon has to name the banned terms in order to ban them, and the audit
// script has to print the word "separation" alongside them. Excluding the
// standards machinery from its own prose checks avoids that circularity.
//
// The format reference is exempt for a different reason. It carries the titles
// of published papers exactly as they were published, and two of those titles
// happen to contain words on the list. A citation edited to satisfy a house
// style no longer points at the paper it names, and a reader searching for the
// altered wording would not find it. The prose around the citations is held to
// the list by reading it, the same as everything else.
const LEXICON_EXEMPT = new Set([
  'standards/lexicon.js',
  'src/renderer/reference/formats-reference.js'
]);

function walk(directory, collected) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        walk(path.join(directory, entry.name), collected);
      }
      return;
    }
    if (SOURCE_EXTENSIONS.indexOf(path.extname(entry.name)) !== -1) {
      collected.push(path.join(directory, entry.name));
    }
  });
  return collected;
}

const failures = [];
const files = walk(ROOT, []);

files.forEach(function (file) {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (GENERATED.has(relative)) {
    return;
  }
  const source = fs.readFileSync(file, 'utf8');

  if (!LEXICON_EXEMPT.has(relative)) {
    findBannedTerms(source).forEach(function (hit) {
      failures.push(relative + ':' + hit.line + '  banned term "' + hit.term + '"');
    });
  }

  findForbiddenCharacters(source).forEach(function (hit) {
    failures.push(relative + ':' + hit.line + '  ' + hit.name);
  });

  findContractions(source).forEach(function (hit) {
    failures.push(relative + ':' + hit.line + '  contraction "' + hit.text + '"');
  });

  // Density applies to executable source. Markdown, CSS, and HTML carry their
  // explanation in the prose itself, so measuring comment lines there would
  // report a number that means nothing.
  //
  // Test files are exempt for a different reason. A test name is already a
  // sentence describing intent, so a well written test file documents itself
  // and a fifteen percent floor would only add narration restating the name
  // directly above it. The prose checks above still apply to them.
  // Reference content is exempt for a third reason. The files under reference
  // are almost entirely prose written for the reader: paragraphs about response
  // formats, and the citations behind them. There is very little code to
  // explain, and meeting a fifteen percent floor there would mean writing
  // commentary about paragraphs that already say what they mean. The header of
  // each file carries the reasoning that a maintainer actually needs, which is
  // where the material came from and why it is kept separate from the formats
  // catalog.
  const isSource = path.extname(file) === '.js' || path.extname(file) === '.jsx';
  const isTest = relative.endsWith('.test.js') || relative.startsWith('test/');
  const isReference = relative.startsWith('src/renderer/reference');
  if (isSource && !isTest && !isReference) {
    const density = commentDensity(source);
    if (density.ratio < DENSITY_FLOOR) {
      failures.push(
        relative + '  comment density ' + (density.ratio * 100).toFixed(1) +
        '%, floor is ' + (DENSITY_FLOOR * 100) + '%'
      );
    }
  }
});

console.log('Checked ' + files.length + ' files.');
if (failures.length === 0) {
  console.log('PASS. No standards violations.');
  process.exit(0);
}
console.log('FAIL. ' + failures.length + ' violations:');
failures.forEach(function (f) { console.log('  ' + f); });
process.exit(1);
