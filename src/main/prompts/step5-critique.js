// Prompt and schema for Step 4, self-critique.
//
// The prompt asks about two criteria and no others. Everything else in the
// rubric is measured in code, and including those criteria here would invite
// the model to disagree with a computed value, producing a contradiction in the
// audit trail that neither side can settle.
//
// It also asks for a rewrite only where the item failed. A model asked to
// improve every item will improve every item, including the ones that were
// already correct, and Step 5 would then rewrite work that needed nothing.

const GUIDANCE = [
  'You are reviewing draft survey items for two specific problems. Judge only',
  'these two. Other properties of the items are checked separately.',
  '',
  'Leading: the item is worded so that one answer feels expected. Wording that',
  'presupposes the respondent already holds a position, or that praises or',
  'criticizes the position it describes, is leading.',
  '',
  'Socially desirable: agreeing or disagreeing would make the respondent look',
  'good or bad to themselves or to whoever reads the results. Items about',
  'honesty, effort, prejudice, and care for others are the usual cases.',
  '',
  'Most items have neither problem. Mark an item only when you can say what',
  'about the wording causes it. If you cannot name the cause, the item passes.',
  '',
  'Where you mark an item, supply a rewrite that removes the problem and keeps',
  'the meaning and the keying direction unchanged. Where an item passes, leave',
  'the rewrite empty.'
].join('\n');

function buildPrompt({ construct, dimension, items }) {
  const lines = [
    GUIDANCE,
    '',
    'Construct: ' + construct,
    'Dimension: ' + dimension.name,
    'Definition: ' + dimension.definition,
    '',
    'Items:'
  ];
  // Direction is shown because a reverse keyed item that reads as criticism of
  // the respondent is ordinary, not leading, and the model cannot tell
  // the difference without knowing which way the item is scored.
  items.forEach(function (item) {
    lines.push('  [' + item.id + '] (' + item.direction + ') ' + item.text);
  });
  return lines.join('\n');
}

// Every item in the batch gets a row whether or not it failed. Asking for only
// the failures produces a shorter response that is far more likely to omit an
// item the model did intend to flag.
const SCHEMA = {
  type: 'object',
  properties: {
    judgments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          leading: { type: 'boolean' },
          leading_note: { type: 'string' },
          socially_desirable: { type: 'boolean' },
          desirability_note: { type: 'string' },
          suggested_rewrite: { type: 'string' }
        },
        required: ['item_id', 'leading', 'socially_desirable']
      }
    }
  },
  required: ['judgments']
};

module.exports = { buildPrompt, SCHEMA };
