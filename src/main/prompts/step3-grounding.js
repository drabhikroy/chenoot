// Prompt and schema for Step 2, literature grounding.
//
// The prompt does two unusual things, both addressing the same problem.
//
// It asks for phrasing conventions first and citations second, because a model
// asked to name a scale will name one whether or not it knows any. Putting the
// useful part first means a run that recalls nothing real still returns
// something worth having.
//
// It states plainly that an empty list is an acceptable answer. Local models
// treat a request for a list as an instruction to fill it, and saying otherwise
// measurably reduces invention.

const GUIDANCE = [
  'You are calibrating the wording of a new self-report instrument against',
  'published scales measuring the same or adjacent constructs.',
  '',
  'For each scale you can recall, give the phrasing conventions it uses: person',
  'and tense, typical item length, how it handles reverse keying, and the',
  'vocabulary level it is written at. These conventions are what matters here.',
  '',
  'Name only scales you actually recall. If you cannot recall any for this',
  'construct, return an empty list. An empty list is a correct and expected',
  'answer, and it is much better than a plausible name you are unsure of.',
  '',
  'Do not estimate a year or an author you are not confident of. Leave the',
  'source field empty instead.'
].join('\n');

function buildPrompt(scoping) {
  const dimensions = (scoping.dimensions || []).map(function (d) {
    return '  ' + d.name + ': ' + d.definition;
  });
  return [
    GUIDANCE,
    '',
    'Construct: ' + scoping.construct,
    'Dimensions:',
    dimensions.join('\n')
  ].join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    reference_scales: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          source: { type: 'string' },
          relevant_dimensions: { type: 'array', items: { type: 'string' } },
          phrasing_notes: { type: 'string' }
        },
        required: ['name', 'phrasing_notes']
      }
    }
  },
  required: ['reference_scales']
};

module.exports = { buildPrompt, SCHEMA };
