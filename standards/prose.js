// Checkers that enforce the writing standards across source, comments, and
// documentation. Everything here is pure: a checker takes text and returns
// findings, and the test suite decides what counts as a failure. Keeping the
// decision out of the checker means the same functions can drive an editor
// integration later without duplicating logic.

const {
  BANNED_ROOTS,
  TECHNICAL_ALLOWLIST,
  PROPER_NOUNS,
  FORBIDDEN_CHARACTERS,
  CONTRACTION_PATTERN
} = require('./lexicon');

// One combined expression is faster than fifty separate passes over the file
// and, more importantly, reports findings in source order.
const BANNED_PATTERN = new RegExp(
  '\\b(?:' + BANNED_ROOTS.join('|') + ')\\b',
  'gi'
);

// Grab the full identifier surrounding a match so that a hit inside
// "align-items" or "isMaximized" can be compared against the allowlist. Word
// characters, hyphens, and dollar signs are all legal in the identifiers this
// project uses.
const IDENTIFIER_BOUNDARY = /[A-Za-z0-9_$-]/;

function surroundingIdentifier(text, start, end) {
  let left = start;
  let right = end;
  while (left > 0 && IDENTIFIER_BOUNDARY.test(text[left - 1])) {
    left -= 1;
  }
  while (right < text.length && IDENTIFIER_BOUNDARY.test(text[right])) {
    right += 1;
  }
  return text.slice(left, right);
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

// Report every banned lexeme that is not part of a reserved technical token.
function findBannedTerms(text) {
  const findings = [];
  let match = BANNED_PATTERN.exec(text);
  while (match !== null) {
    const identifier = surroundingIdentifier(text, match.index, BANNED_PATTERN.lastIndex);
    // Two exemptions, kept distinct because they are granted for different
    // reasons: reserved technical surface that cannot be renamed, and the names
    // of real published things that must not be.
    if (!TECHNICAL_ALLOWLIST.has(identifier) && !PROPER_NOUNS.has(identifier)) {
      findings.push({
        term: match[0],
        identifier,
        line: lineNumberAt(text, match.index)
      });
    }
    match = BANNED_PATTERN.exec(text);
  }
  BANNED_PATTERN.lastIndex = 0;
  return findings;
}

function findForbiddenCharacters(text) {
  const findings = [];
  FORBIDDEN_CHARACTERS.forEach(function (rule) {
    let match = rule.pattern.exec(text);
    while (match !== null) {
      findings.push({ name: rule.name, line: lineNumberAt(text, match.index) });
      match = rule.pattern.exec(text);
    }
    rule.pattern.lastIndex = 0;
  });
  return findings;
}

function findContractions(text) {
  const findings = [];
  let match = CONTRACTION_PATTERN.exec(text);
  while (match !== null) {
    findings.push({ text: match[0], line: lineNumberAt(text, match.index) });
    match = CONTRACTION_PATTERN.exec(text);
  }
  CONTRACTION_PATTERN.lastIndex = 0;
  return findings;
}

// Comment density is measured in lines and not characters because the
// standard is about how much of the file explains reasoning, and a reader
// experiences that as vertical space. Blank lines are excluded from the
// denominator so that generously spaced files are not credited for whitespace.
//
// A line counts as a comment when it opens with a line comment marker or falls
// inside a block comment. Trailing comments on a code line are not counted,
// which makes the measure conservative, not flattering.
//
// JSX comments are recognized too. The brace-wrapped form is the only way to
// comment inside markup, and an earlier version of this function treated those
// lines as code, which meant documenting a component actively lowered its
// measured density. A checker that punishes the behavior it exists to
// encourage is worse than no checker.
function commentDensity(source) {
  const lines = source.split('\n');
  let commentLines = 0;
  let meaningfulLines = 0;
  let insideBlock = false;

  lines.forEach(function (rawLine) {
    const line = rawLine.trim();
    if (line.length === 0) {
      return;
    }
    meaningfulLines += 1;

    if (insideBlock) {
      commentLines += 1;
      // Closes on the plain terminator or on the brace-wrapped JSX form.
      if (line.indexOf('*/') !== -1) {
        insideBlock = false;
      }
      return;
    }
    if (line.startsWith('//')) {
      commentLines += 1;
      return;
    }
    if (line.startsWith('/*') || line.startsWith('{/*')) {
      commentLines += 1;
      if (line.indexOf('*/') === -1) {
        insideBlock = true;
      }
    }
  });

  return {
    commentLines,
    meaningfulLines,
    ratio: meaningfulLines === 0 ? 0 : commentLines / meaningfulLines
  };
}

module.exports = {
  findBannedTerms,
  findForbiddenCharacters,
  findContractions,
  commentDensity
};
