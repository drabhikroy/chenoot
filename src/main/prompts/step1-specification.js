// Prompt and schema for Step 1, specification review.
//
// The model is asked only about substantive gaps, because whether a field is
// empty has already been decided in code and asking again would let a model
// disagree with a fact.
//
// What is left is the part that needs reading: whether the research questions
// are actually questions, whether the purpose and the research questions
// describe the same study, and whether the material implies sensitive content
// that has not been declared. Each of those changes what should be measured,
// which is the test for stopping.

const GUIDANCE = [
  'You are reviewing a survey specification before any questions are written.',
  '',
  'Report only gaps that would change what the instrument should measure. A gap',
  'that would merely improve the wording is not one of them.',
  '',
  'Check three things.',
  '',
  'Are the research questions answerable by a survey, and are they questions',
  ', not topics? "Student engagement" is a topic. "How does engagement',
  'differ between first and later year students?" is a research question. A topic',
  'cannot be traced to, so items generated against it cannot be checked for',
  'coverage.',
  '',
  'Do the purpose and the research questions describe the same study? When they',
  'do not, one of them is wrong and continuing means guessing which.',
  '',
  'Does the material imply sensitive content that has not been declared? Income,',
  'health, identity, illegal or workplace conduct, and trauma change wording,',
  'precision, and placement. Naming one that was not declared is useful. Treating',
  'ordinary content as sensitive is not.',
  '',
  'Most specifications have no blocking gap. Report none instead of finding one',
  'to justify the review.'
].join('\n');

function buildPrompt(specification, presence) {
  const stated = presence.present.map(function (key) {
    const value = specification[key];
    return '  ' + key + ': ' + (Array.isArray(value) ? value.join('; ') : value);
  });
  const notStated = presence.absent.map(function (key) { return '  ' + key; });

  return [
    GUIDANCE,
    '',
    'Stated:',
    stated.join('\n') || '  nothing',
    '',
    'Not stated:',
    notStated.join('\n') || '  nothing'
  ].join('\n');
}

// blocking separates a gap that stops the pipeline from one that is recorded
// and worked around, which is the distinction the whole step exists to make.
const SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          problem: { type: 'string' },
          blocking: { type: 'boolean' },
          question_to_ask: { type: 'string' }
        },
        required: ['field', 'problem', 'blocking']
      }
    },
    undeclared_sensitive_topics: { type: 'array', items: { type: 'string' } }
  },
  required: ['gaps']
};

module.exports = { buildPrompt, SCHEMA };
