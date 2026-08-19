// Prompt and schema for Step 5, revision.
//
// The prompt shows each item alongside the specific problems found in it rather
// than restating the rubric and asking for a general improvement. A model given
// the rubric again rewrites toward the rubric as a whole and frequently trades
// one flag for another, which reads as progress in a diff and is not.
//
// It also states that the keying direction must survive the rewrite. Reverse
// keyed items are the ones most often fixed by quietly flipping them to
// positive, which resolves the flag and breaks the dimension's balance.

const GUIDANCE = [
  'Rewrite survey items to remove specific problems that were found in them.',
  '',
  'For each item you are given the current wording, its keying direction, and',
  'the problems identified. Fix exactly those problems.',
  '',
  'Keep the meaning. The rewritten item must measure the same thing as the',
  'original, or the dimension loses coverage, not gaining quality.',
  '',
  'Keep the keying direction. A reverse keyed item stays reverse keyed. Do not',
  'resolve a problem by turning the item around.',
  '',
  'Do not introduce new problems. Stay under twenty words, at an eighth grade',
  'reading level, expressing one idea, with no absolutes.',
  '',
  'If an item cannot be fixed without changing what it measures, return it',
  'unchanged. That is a real answer and it is better than a rewrite that keeps',
  'the wording and loses the construct.'
].join('\n');

function buildPrompt({ construct, dimension, batch }) {
  const lines = [
    GUIDANCE,
    '',
    'Construct: ' + construct,
    'Dimension: ' + dimension.name,
    'Definition: ' + dimension.definition,
    '',
    'Items to rewrite:'
  ];
  batch.forEach(function (entry) {
    lines.push('');
    lines.push('  [' + entry.id + '] (' + entry.direction + ') ' + entry.text);
    entry.flags.forEach(function (problem) {
      lines.push('    problem: ' + problem);
    });
    // A rewrite proposed during critique is offered as a starting point rather
    // than as the answer.
    if (entry.suggestedRewrite) {
      lines.push('    starting point: ' + entry.suggestedRewrite);
    }
  });
  return lines.join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    revisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['item_id', 'text']
      }
    }
  },
  required: ['revisions']
};

module.exports = { buildPrompt, SCHEMA };
