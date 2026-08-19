// The survey specification. Everything downstream is derived from this, so it
// is defined before anything that reads it. That is the practice the
// methodology explicitly rules out: substantive assumptions invented to fill a
// gap change what gets measured, and they do it invisibly, because the
// resulting instrument looks exactly as confident as one built on stated
// requirements. So fields are classified, not merely collected. A required
// field is one whose absence changes what should be measured, and the pipeline
// stops for it. An improving field is one whose absence lowers the quality of
// the result without making it indefensible, and the pipeline proceeds while
// recording what it did not know. The distinction is the whole point. A gate
// that stops for everything is a gate nobody gets through, and one that stops
// for nothing is not a gate. The required set is deliberately two fields.
// Requiring a field because it improves the result is the error that turns a
// gate into an obstacle. The test is narrower than that: without this, would
// the instrument measure something different? Only purpose and population meet
// it.

const REQUIRED = 'required';
const IMPROVING = 'improving';

// Each entry states what the field is for, not only what it is called,
// because the interface asks for these in a person's own working language and
// the prompt needs to explain why an absent one matters.
const FIELDS = {
  purpose: {
    label: 'Survey purpose',
    level: REQUIRED,
    asks: 'What this survey is for, in one or two sentences.',
    why: 'Purpose determines which concepts belong in the instrument at all. Without it every ' +
      'later decision about what to include is arbitrary.'
  },
  researchQuestions: {
    label: 'Research questions',
    level: IMPROVING,
    multiline: true,
    asks: 'The questions the findings should answer. One per line.',
    why: 'Every item has to trace back to a research question. Without them there is nothing to ' +
      'trace to, and coverage cannot be judged.'
  },
  intendedUse: {
    label: 'Intended use of the findings',
    level: IMPROVING,
    asks: 'What decisions or reporting the results feed. For example program improvement, ' +
      'a funder report, or a published study.',
    why: 'Intended use sets the precision required. A screening instrument and a research ' +
      'instrument measuring the same construct are different instruments.'
  },
  targetPopulation: {
    label: 'Target population',
    level: REQUIRED,
    asks: 'The population the findings are meant to describe.',
    why: 'Population sets vocabulary, reading level, and which concepts are meaningful.'
  },
  respondentPopulation: {
    label: 'Respondents',
    level: IMPROVING,
    asks: 'Who actually answers, when this differs from the target population. For example ' +
      'teachers answering about students.',
    why: 'Proxy reporting changes what can be asked and how much the respondent plausibly knows.'
  },
  unitOfObservation: {
    label: 'Unit of observation',
    level: IMPROVING,
    asks: 'What each response describes. A person, a household, a classroom, a site.',
    why: 'Items written for one unit and analyzed at another produce a mismatch nothing later ' +
      'in the pipeline can detect.'
  },
  unitOfReference: {
    label: 'Unit of reference',
    level: IMPROVING,
    asks: 'What the respondent should answer about, when it differs from themselves.',
    why: 'Determines whether an item says "you" or names something else, which changes the item.'
  },
  mode: {
    label: 'Administration mode',
    level: IMPROVING,
    choices: ['web', 'mobile', 'telephone', 'in-person interview', 'paper', 'mixed'],
    asks: 'How the instrument will be administered.',
    why: 'Mode governs item length, response format, list length, and whether a matrix is ' +
      'usable at all. An item written for web and read aloud on the telephone is a different ' +
      'measurement.'
  },
  recallPeriod: {
    label: 'Reference or recall period',
    level: IMPROVING,
    asks: 'The span respondents should answer about, if the instrument covers behavior or ' +
      'events. For example the past four weeks, or this school year.',
    why: 'Behavioral items without a stated period are answered against whatever span each ' +
      'respondent picks, which is a source of variance unrelated to the construct.'
  },
  sensitiveTopics: {
    label: 'Sensitive topics',
    level: IMPROVING,
    multiline: true,
    asks: 'Topics respondents may find private, embarrassing, or consequential. Income, health, ' +
      'identity, illegal or workplace conduct, trauma.',
    why: 'Sensitive content changes wording, precision, placement in the instrument, and ' +
      'sometimes the mode it can be collected in.'
  },
  existingMeasures: {
    label: 'Existing measures to retain',
    level: IMPROVING,
    multiline: true,
    asks: 'Established items or scales that must be kept, and whether wording may change.',
    why: 'An item required to stay comparable with earlier data cannot be rewritten, however ' +
      'much a critique step would like to.'
  },
  comparability: {
    label: 'Comparison requirements',
    level: IMPROVING,
    asks: 'Any earlier survey, site, group, or time point the results must be comparable with.',
    why: 'Comparability constrains wording and response format regardless of what would ' +
      'otherwise be better.'
  },
  analysisPlan: {
    label: 'Planned analysis',
    level: IMPROVING,
    asks: 'What will be done with the responses. Subgroup comparison, scale scoring, ' +
      'regression, simple description.',
    why: 'Scale scoring needs multiple items per construct and a defensible response format. ' +
      'Simple description may not.'
  },
  subgroups: {
    label: 'Important subgroups',
    level: IMPROVING,
    asks: 'Groups the findings must be reported separately for.',
    why: 'Subgroup reporting sets a minimum item count and affects which classification ' +
      'questions the instrument needs.'
  },
  lengthTarget: {
    label: 'Desired length',
    level: IMPROVING,
    asks: 'Target completion time or item count.',
    why: 'Burden is a design constraint instead of an outcome, and constructs have to be ' +
      'measured in proportion to their importance within it.'
  },
  accessibility: {
    label: 'Accessibility requirements',
    level: IMPROVING,
    asks: 'Screen reader support, reading level, language versions, or other stated requirements.',
    why: 'These constrain format and wording, and retrofitting them afterwards rarely works.'
  }
};

const REQUIRED_FIELDS = Object.keys(FIELDS).filter(function (key) {
  return FIELDS[key].level === REQUIRED;
});

// Deterministic completeness. A field is present when it holds something a
// person actually typed, so whitespace and placeholder dashes do not count.
//
// This runs before any model call, because whether a field is empty is not a
// judgment and asking a model to decide it would make the answer vary between
// runs of the same input.
function presence(specification) {
  const present = [];
  const absent = [];

  Object.keys(FIELDS).forEach(function (key) {
    const raw = specification[key];
    const value = Array.isArray(raw) ? raw.join(' ').trim() : String(raw === undefined ? '' : raw).trim();
    const meaningful = value.length > 0 && !/^[-\u2013\u2014.]+$/.test(value);
    (meaningful ? present : absent).push(key);
  });

  return {
    present,
    absent,
    missingRequired: absent.filter(function (key) { return FIELDS[key].level === REQUIRED; }),
    missingImproving: absent.filter(function (key) { return FIELDS[key].level === IMPROVING; })
  };
}

// Research questions are the one field with internal structure worth checking.
// One per line, and a line that is not a question is usually a topic, which is
// the most common way this field gets filled in without being answered.
function parseResearchQuestions(raw) {
  return String(raw || '')
    .split('\n')
    .map(function (line) { return line.replace(/^\s*[-*\u2022\d.)]+\s*/, '').trim(); })
    .filter(function (line) { return line.length > 0; });
}

function describeField(key) {
  const field = FIELDS[key];
  return field ? field.label : key;
}

// Everything above is data. Nothing here reads a file or calls a model, so the
// field definitions can be imported by the renderer and the tests without
// pulling the pipeline in behind them.
module.exports = {
  FIELDS,
  REQUIRED,
  IMPROVING,
  REQUIRED_FIELDS,
  presence,
  parseResearchQuestions,
  describeField
};
