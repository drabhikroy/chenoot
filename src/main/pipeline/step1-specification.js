// Step 1: specification review. The gate. It reads the survey specification,
// reports what is missing, and stops when what is missing would change what
// should be measured. An instrument built on invented requirements looks
// exactly as confident as one built on stated requirements, which is what
// makes the practice indefensible never merely imprecise. Two kinds of check
// run here and they are kept apart deliberately. Whether a field is empty is
// decided in code, because it is not a judgment and a model asked the same
// question twice would eventually answer differently. Whether a stated field
// says something usable is decided by the model, because that needs reading.

const { buildPrompt, SCHEMA } = require('../prompts/step1-specification');
const {
  FIELDS, presence, parseResearchQuestions, describeField
} = require('./spec/specification');
const { PROVENANCE } = require('./audit');

async function run({ input, backend, trail, entry }) {
  const specification = input.specification || {};
  const found = presence(specification);

  // Everything absent is recorded, blocking or not. A run that proceeded
  // without knowing the recall period should say so in its own audit trail,
  // not leaving a reader to notice the omission later.
  found.absent.forEach(function (key) {
    trail.recordDecision(entry, {
      code: FIELDS[key].level === 'required' ? 'specification_missing_required' : 'specification_missing_improving',
      description: describeField(key) + ' was not stated. ' + FIELDS[key].why,
      evidence: key,
      provenance: PROVENANCE.MEASURED
    });
  });

  if (found.missingRequired.length > 0) {
    return {
      needsClarification: true,
      missing: found.missingRequired.map(function (key) {
        return { field: key, label: describeField(key), asks: FIELDS[key].asks, why: FIELDS[key].why };
      }),
      clarificationQuestion: 'Before questions can be written, this needs: ' +
        found.missingRequired.map(describeField).join(', ') + '.',
      specification,
      presence: found
    };
  }

  const researchQuestions = parseResearchQuestions(specification.researchQuestions);

  // The model half is attempted and never allowed to end the run. Losing the
  // substantive review leaves the deterministic review intact, which is worth
  // more than failing outright.
  let gaps = [];
  let undeclaredSensitive = [];
  try {
    const raw = await backend.complete(buildPrompt(specification, found), SCHEMA, { temperature: 0.2 });
    gaps = Array.isArray(raw.gaps) ? raw.gaps : [];
    undeclaredSensitive = Array.isArray(raw.undeclared_sensitive_topics)
      ? raw.undeclared_sensitive_topics
      : [];
  } catch (error) {
    trail.recordDecision(entry, {
      code: 'specification_review_unavailable',
      description: 'The substantive review of the specification could not run, so only the ' +
        'presence of each field was checked: ' + error.message,
      provenance: PROVENANCE.MEASURED
    });
  }

  gaps.forEach(function (gap) {
    trail.recordDecision(entry, {
      code: gap.blocking ? 'specification_gap_blocking' : 'specification_gap_noted',
      description: describeField(gap.field) + ': ' + gap.problem,
      evidence: gap.field,
      provenance: PROVENANCE.JUDGED
    });
  });

  undeclaredSensitive.forEach(function (topic) {
    trail.recordDecision(entry, {
      code: 'sensitive_topic_undeclared',
      description: 'The material implies sensitive content that was not declared: ' + topic +
        '. Wording, precision, and placement in the instrument all change for this.',
      evidence: topic,
      provenance: PROVENANCE.JUDGED
    });
  });

  // A gap on an optional field cannot block, whatever the model says.
  //
  // The model was marking respondents and administration mode as blocking, and
  // both are classified as improving. It is not wrong that they would sharpen
  // the instrument; it is wrong that a judgment made per run can override a
  // classification made once. Left unchecked, the required set is whatever the
  // model felt strongly about that afternoon, and the person filling the form
  // has no way to know what will actually stop them.
  //
  // So blocking is intersected with the classification and not trusted.
  // Anything the model raised about an optional field is kept as a note.
  const blocking = gaps.filter(function (gap) {
    if (gap.blocking !== true) {
      return false;
    }
    const field = FIELDS[gap.field];
    if (field && field.level !== 'required') {
      trail.recordDecision(entry, {
        code: 'gap_downgraded',
        description: describeField(gap.field) + ' was raised as blocking, but it is an optional ' +
          'field, so the run continued. Supplying it would sharpen the instrument.',
        evidence: gap.field,
        provenance: PROVENANCE.MEASURED
      });
      return false;
    }
    return true;
  });
  if (blocking.length > 0) {
    return {
      needsClarification: true,
      missing: blocking.map(function (gap) {
        const field = FIELDS[gap.field];
        return {
          field: gap.field,
          label: describeField(gap.field),
          // The field's own prompt where one exists, so the hint tells the
          // person what to write, not repeating the complaint.
          asks: (field && field.asks) || gap.question_to_ask || '',
          why: gap.problem
        };
      }),
      clarificationQuestion: blocking[0].question_to_ask || blocking[0].problem,
      specification,
      presence: found
    };
  }

  return {
    specification,
    researchQuestions,
    presence: found,
    gaps,
    undeclaredSensitive,
    // Carried forward so later steps read one object, not reaching back
    // into the raw input for fields that shape their own decisions.
    constraints: {
      mode: specification.mode || '',
      recallPeriod: specification.recallPeriod || '',
      sensitiveTopics: specification.sensitiveTopics || '',
      existingMeasures: specification.existingMeasures || '',
      comparability: specification.comparability || '',
      accessibility: specification.accessibility || '',
      analysisPlan: specification.analysisPlan || ''
    }
  };
}

function describe(output) {
  if (output.needsClarification) {
    return 'Stopped. ' + output.missing.length +
      (output.missing.length === 1 ? ' item is needed' : ' items are needed') +
      ' before questions can be written.';
  }
  const noted = output.gaps.length + output.presence.missingImproving.length;
  return output.researchQuestions.length +
    (output.researchQuestions.length === 1 ? ' research question' : ' research questions') +
    ' accepted' + (noted > 0 ? ', ' + noted + ' gaps recorded and worked around.' : '.');
}

function recordInput({ input }) {
  return { specification: input.specification || {} };
}

module.exports = { number: 1, name: 'specification', run, describe, recordInput };
