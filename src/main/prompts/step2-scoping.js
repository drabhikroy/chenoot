// Prompt and schema for Step 1, construct scoping.
//
// Prompt templates live apart from step logic so that wording can be revised
// and compared across models without touching anything that reads the result.
//
// The schema is passed to the backend as a decoding constraint never
// described in the prose. Anything the prose says about output format is
// therefore redundant, and saying it anyway costs context on a model that has
// little to spare.

// A construct is refused only when no defensible set of sub-dimensions could be
// written for it, which is a narrower test than "sounds vague". The distinction
// matters because a model asked whether something is vague will say yes far too
// often, and every false refusal here interrupts a pipeline that is otherwise
// meant to run unattended.
const SYSTEM_GUIDANCE = [
  'You are scoping a psychometric construct for instrument development.',
  '',
  'Break the construct into sub-dimensions that are conceptually distinct from',
  'one another and each measurable through self-report items. Give each one a',
  'single-sentence definition written for the stated population, not for a',
  'methods audience.',
  '',
  'Distribute the requested item count across dimensions in proportion to how',
  'much of the construct each one carries. Equal splits are acceptable only when',
  'the dimensions genuinely carry equal weight.',
  '',
  'A dimension measured by fewer than three items cannot have its reliability',
  'estimated, so the requested length puts a hard ceiling on how many dimensions',
  'are worth having. When the ceiling is lower than the number of facets you can',
  'see, combine the closest ones, not returning more dimensions than the',
  'instrument can carry. You are better placed to decide which facets belong',
  'together than anything downstream of you.',
  '',
  'Set operationalizable to false only when the construct cannot be decomposed',
  'at all, because it names a field of study instead of an attribute, or',
  'because it could plausibly mean several unrelated things and the supplied',
  'context does not settle which. A construct that is merely broad is still',
  'operationalizable. When you set it to false, write one specific question that',
  'would resolve the ambiguity.'
].join('\n');

function buildPrompt({
  construct, population, purpose, itemCount, maxDimensions,
  relatedConstructs, researchQuestions, constraints
}) {
  const lines = [
    SYSTEM_GUIDANCE,
    '',
    'Construct: ' + construct,
    'Target population: ' + population,
    'Purpose and context: ' + purpose,
    'Target item count for the finished instrument: ' + itemCount,
    'Maximum dimensions this length can carry: ' + maxDimensions +
      (maxDimensions === 1
        ? '. Return a single dimension covering the construct as a whole.'
        : '. Returning more than this is worse than combining facets.')
  ];
  // Dimensions have to serve the research questions and not the construct
  // in the abstract, so the questions are stated before the request.
  if (researchQuestions && researchQuestions.length > 0) {
    lines.push('', 'Research questions the instrument must answer:');
    researchQuestions.forEach(function (question) { lines.push('  ' + question); });
  }

  // Constraints that change what can be asked at all,, not only how it
  // is worded, are given here so scoping does not propose a dimension the
  // instrument cannot carry.
  if (constraints) {
    const stated = [];
    if (constraints.mode) { stated.push('Administration mode: ' + constraints.mode); }
    if (constraints.recallPeriod) { stated.push('Reference period: ' + constraints.recallPeriod); }
    if (constraints.sensitiveTopics) { stated.push('Sensitive topics declared: ' + constraints.sensitiveTopics); }
    if (constraints.accessibility) { stated.push('Accessibility: ' + constraints.accessibility); }
    if (stated.length > 0) {
      lines.push('', 'Constraints:');
      stated.forEach(function (line) { lines.push('  ' + line); });
    }
  }

  if (relatedConstructs && relatedConstructs.length > 0) {
    // Related constructs are given as things to stay clear of, not
    // things to cover, since the usual reason a person names them is that they
    // want the new instrument to be discriminable from an existing one.
    lines.push(
      'Related constructs the instrument should remain distinct from: ' +
      relatedConstructs.join(', ')
    );
  }
  return lines.join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    construct: { type: 'string' },
    operationalizable: { type: 'boolean' },
    clarification_question: { type: ['string', 'null'] },
    dimensions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          definition: { type: 'string' },
          target_item_count: { type: 'integer' }
        },
        required: ['name', 'definition', 'target_item_count']
      }
    }
  },
  required: ['construct', 'operationalizable', 'dimensions']
};

module.exports = { buildPrompt, SCHEMA };
