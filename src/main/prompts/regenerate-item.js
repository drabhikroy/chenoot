// Prompt and schema for rewriting one item into a different response format.
//
// The prompt states what the item currently measures and asks for the same
// thing asked a different way. That framing matters: the risk when changing a
// format is not that the new item will be badly written, it is that it will
// quietly measure something adjacent. An agreement item about finding work
// demanding, turned into a frequency item, can easily become a question about
// workload, not about perceived demand.

const GUIDANCE = [
  'Rewrite one survey item so that it asks for a different kind of answer.',
  '',
  'Keep what it measures. The rewritten item must sit in the same dimension and',
  'capture the same underlying judgment. If that cannot be done in the requested',
  'format without changing what is measured, return the closest item that does',
  'preserve it and say so in the note.',
  '',
  'Match the stem to the format. A statement suits an agreement scale. Something',
  'that happens suits a frequency scale. A question suits an open response. An',
  'item written for one and served in another reads as a mistake to the',
  'respondent and produces answers nobody can interpret.',
  '',
  'Keep it under twenty words, at an eighth grade reading level, expressing one',
  'idea, with no absolutes and nothing that signals a preferred answer.'
].join('\n');

function buildPrompt({ construct, dimension, item, target, targetId, isScale }) {
  const lines = [
    GUIDANCE,
    '',
    'Construct: ' + construct,
    'Dimension: ' + (dimension ? dimension.name : ''),
    dimension && dimension.definition ? 'Definition: ' + dimension.definition : '',
    '',
    'Current item: ' + item.text,
    item.direction ? 'Current keying: ' + item.direction : '',
    ''
  ].filter(function (line) { return line !== ''; });

  if (isScale) {
    lines.push('Rewrite it to be answered on this scale: ' + target.label + '.');
    lines.push('That scale suits ' + target.suits);
    // The anchors are shown and not described, so the model can see what
    // the respondent will actually be choosing between.
    lines.push('Its anchors run: ' + target.labels.join(' / '));
    if (item.direction === 'reverse') {
      lines.push('Keep it reverse keyed: it should state the opposite of the dimension.');
    }
  } else {
    lines.push('Rewrite it as ' + target.asks + '.');
    lines.push(target.guidance);
    if (targetId === 'single-select' || targetId === 'multi-select') {
      lines.push('Supply the response options as well.');
    }
  }

  return lines.join('\n');
}

// response_options is present for the formats that need them and ignored
// otherwise,, not a second schema existing for the two nominal cases.
const SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    response_options: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' }
  },
  required: ['text']
};

module.exports = { buildPrompt, SCHEMA };
