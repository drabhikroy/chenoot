// Prompt and schema for Step 7, response scale selection.
//
// The prompt asks two questions in a fixed order, because the second only makes
// sense once the first is settled.
//
// Polarity comes first. Whether the construct has two opposing directions or
// measures the amount of a single thing determines which half of the catalog is
// even eligible, and getting it wrong produces a scale whose midpoint means
// nothing.
//
// The response dimension comes second. Within a polarity, the question is what
// the respondent is actually being asked to report: agreement, frequency,
// difficulty, confidence, and so on.
//
// A sample of the finished items is included, not only the construct
// name, since the correct scale depends on how the items are phrased and that
// is information the model can simply be shown.

const SAMPLE_SIZE = 10;

const GUIDANCE = [
  'Choose the response scale for a finished self-report instrument.',
  '',
  'First decide the polarity of the construct.',
  '',
  'A construct is BIPOLAR when it runs between two opposing states with a real',
  'neutral point between them. Agreement runs from disagreement through neutral',
  'to agreement. Satisfaction runs from dissatisfied to satisfied.',
  '',
  'A construct is UNIPOLAR when it measures how much of one thing is present,',
  'with a true zero and no opposite. Difficulty, confidence, importance, and',
  'frequency are unipolar: there is no negative amount of difficulty.',
  '',
  'Then decide what the respondent is being asked to report. Agreement with a',
  'statement is only one option and it is the most overused. When the items',
  'describe a quantity, a frequency, a difficulty, or a confidence, a scale',
  'naming that thing directly measures it better than asking whether the person',
  'agrees with a sentence about it.',
  '',
  'Prefer a scale that names the construct in its anchors over an agreement',
  'scale whenever the construct is adjectival. Agreement scales are subject to',
  'acquiescence, the tendency to agree with whatever is presented, which raises',
  'scores for reasons unrelated to what is being measured.',
  '',
  'When the behavior being reported can actually be counted, prefer specific',
  'frequencies over words like often and sometimes. Different respondents read',
  'those words as very different rates.',
  '',
  'Answer with one identifier from the list, the polarity you decided, and one',
  'or two sentences saying why it suits these items. Do not write out anchor',
  'labels.'
].join('\n');

function buildPrompt({ scoping, items, catalog }) {
  // Options are grouped by polarity in the prompt so that the structure of the
  // decision is visible in the structure of the list.
  const bipolar = [];
  const unipolar = [];
  Object.keys(catalog).forEach(function (key) {
    const entry = catalog[key];
    const line = '  ' + key + ': ' + entry.label + '. ' + entry.suits;
    if (entry.polarity === 'bipolar') {
      bipolar.push(line);
    } else {
      unipolar.push(line);
    }
  });

  const sample = items.slice(0, SAMPLE_SIZE).map(function (item) {
    return '  ' + item.text;
  });

  return [
    GUIDANCE,
    '',
    'Bipolar scales:',
    bipolar.join('\n'),
    '',
    'Unipolar scales:',
    unipolar.join('\n'),
    '',
    'Construct: ' + scoping.construct,
    'Dimensions: ' + scoping.dimensions.map(function (d) { return d.name; }).join(', '),
    '',
    'Sample of the finished items:',
    sample.join('\n')
  ].join('\n');
}

// scale_type is constrained by enum at decode time, built from the catalog keys
// so the two cannot drift apart. construct_word supplies the adjective used by
// the item-specific anchor sets, and is ignored for every other entry.
function buildSchema(catalog) {
  return {
    type: 'object',
    properties: {
      polarity: { type: 'string', enum: ['unipolar', 'bipolar'] },
      scale_type: { type: 'string', enum: Object.keys(catalog) },
      construct_word: { type: 'string' },
      justification: { type: 'string' }
    },
    required: ['polarity', 'scale_type', 'justification']
  };
}

module.exports = { buildPrompt, buildSchema, SAMPLE_SIZE };
