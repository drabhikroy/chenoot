// Prompt and schema for Step 3, item generation.
//
// The prompt states the rubric the items will be judged against in Step 4.
// Telling a model the criteria before it writes costs a few dozen tokens and
// removes a whole class of revision work, which on a local model is the
// difference between one pass and three.

const GUIDANCE = [
  'Write self-report survey items measuring one dimension of a construct.',
  '',
  'Each item is a single statement a respondent rates on an agreement scale.',
  'Write in the first person, present tense, at an eighth grade reading level',
  'or below, and keep items under twenty words.',
  '',
  'Every item must fail none of the following:',
  '  It must express exactly one idea. Items joining two claims with "and" or',
  '  "or" cannot be answered by someone who holds one and not the other.',
  '  It must not use always, never, everyone, or similar absolutes.',
  '  It must not signal which answer is the desirable one.',
  '  It must not lead the respondent toward agreement.',
  '',
  'Reverse keyed items state the opposite of the dimension. Write them as plain',
  'positive statements of the opposite, not as negations of the dimension: use',
  '"I find this work dull" and not "I do not find this work interesting".',
  '',
  'Vary the sentence openings. A block of items all beginning "I feel" measures',
  'the opening as much as the construct.'
].join('\n');

function buildPrompt({ construct, dimension, requested, reverseCount, phrasingNotes }) {
  const lines = [
    GUIDANCE,
    '',
    'Construct: ' + construct,
    'Dimension: ' + dimension.name,
    'Definition: ' + dimension.definition,
    '',
    'Write ' + requested + ' items for this dimension, of which ' + reverseCount +
      ' are reverse keyed.'
  ];

  // Phrasing conventions are passed through when Step 2 found any. The scale
  // names are deliberately left out: they are unverified, and a model shown an
  // unverified citation tends to write toward the name, not the note.
  const notes = (phrasingNotes || []).filter(function (n) { return n && n.length > 0; });
  if (notes.length > 0) {
    lines.push('', 'Conventions observed in comparable instruments:');
    notes.forEach(function (note) { lines.push('  ' + note); });
  }
  return lines.join('\n');
}

// The schema constrains direction to two values instead of accepting free
// text. Without the enum a local model returns "reversed", "negative", and
// "reverse-keyed" across a single run, and every one of those would have to be
// mapped back by hand in the step.
const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          direction: { type: 'string', enum: ['positive', 'reverse'] }
        },
        required: ['text', 'direction']
      }
    }
  },
  required: ['items']
};

module.exports = { buildPrompt, SCHEMA };
