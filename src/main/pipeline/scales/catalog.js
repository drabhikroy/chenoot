// The response scale catalog.
//
// Organized by the distinction that governs every other choice here: whether
// the construct is unipolar or bipolar.
//
// A unipolar construct measures how much of one thing is present. Difficulty,
// importance, confidence, and frequency have a true zero and no opposite pole:
// there is no negative amount of difficulty. These take scales running from
// none to a great deal, and five points is the usual recommendation because
// respondents cannot reliably discriminate more gradations of a single quantity.
//
// A bipolar construct has two opposing directions with a genuine neutral point
// between them. Agreement, satisfaction, and comparison run from negative
// through neutral to positive. These take seven points more comfortably,
// because the range covers twice as much conceptual ground.
//
// Matching the two wrongly is a common and consequential error. A unipolar
// construct forced onto an agree-disagree scale leaves respondents endorsing a
// statement, not reporting a quantity, and the midpoint stops meaning
// anything.
//
// Every set below is fully labeled. Labeling only the endpoints and leaving
// the middle as bare numbers asks respondents to invent the intervening
// meanings themselves, and they do not invent the same ones.
//
// ITEM-SPECIFIC ANCHORS
//
// Some entries carry a placeholder written as {construct}. These are
// construct-specific scales, where the anchors name the thing being measured
// instead of asking for agreement with a statement about it. Asking how
// difficult someone finds a task, on a scale from not at all difficult to
// extremely difficult, is a different measurement from asking whether they
// agree that the task is difficult, and it is generally the better one. The
// agreement version invites acquiescence, the documented tendency to agree with
// whatever is put in front of you, which inflates scores for reasons that have
// nothing to do with the construct.

const CATALOG = {
  // ---- Bipolar: agreement ------------------------------------------------
  // The default in practice and the most overused format in the field. Kept
  // because it suits genuinely bipolar attitudinal content, and flagged by
  // Step 7 when something better fits.
  'agreement-5': {
    label: 'Five-point agreement',
    polarity: 'bipolar',
    family: 'agreement',
    labels: [
      'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'
    ],
    suits: 'Attitudinal statements a respondent endorses or rejects, where a neutral position is meaningful.'
  },
  'agreement-7': {
    label: 'Seven-point agreement',
    polarity: 'bipolar',
    family: 'agreement',
    labels: [
      'Strongly disagree', 'Disagree', 'Somewhat disagree', 'Neither agree nor disagree',
      'Somewhat agree', 'Agree', 'Strongly agree'
    ],
    suits: 'Attitudinal statements in research settings, where respondents can discriminate finely and the extra range is used.'
  },
  'agreement-6': {
    label: 'Six-point agreement, forced choice',
    polarity: 'bipolar',
    family: 'agreement',
    labels: [
      'Strongly disagree', 'Disagree', 'Somewhat disagree',
      'Somewhat agree', 'Agree', 'Strongly agree'
    ],
    suits: 'Attitudinal statements where a neutral answer would be an evasion and not a position.'
  },

  // ---- Bipolar: evaluation ------------------------------------------------
  'satisfaction-5': {
    label: 'Five-point satisfaction',
    polarity: 'bipolar',
    family: 'satisfaction',
    labels: [
      'Very dissatisfied', 'Dissatisfied', 'Neither satisfied nor dissatisfied',
      'Satisfied', 'Very satisfied'
    ],
    suits: 'How a respondent evaluates something they have experienced.'
  },
  'satisfaction-7': {
    label: 'Seven-point satisfaction',
    polarity: 'bipolar',
    family: 'satisfaction',
    labels: [
      'Very dissatisfied', 'Dissatisfied', 'Somewhat dissatisfied',
      'Neither satisfied nor dissatisfied',
      'Somewhat satisfied', 'Satisfied', 'Very satisfied'
    ],
    suits: 'Satisfaction where finer discrimination is wanted and respondents have enough experience to give it.'
  },
  // Balanced, with a middle that names both ends.
  //
  // The labels were Poor, Fair, Good, Very good, Excellent, which is the
  // familiar wording and is not a bipolar scale. Four of the five points sit at
  // or above neutral, so the scale offers one way to be negative and three ways
  // to be positive, and the middle point is itself a compliment. On a scale
  // declared bipolar the midpoint has to be the place a respondent lands when
  // they are neither one thing nor the other.
  'quality-5': {
    label: 'Five-point quality',
    polarity: 'bipolar',
    family: 'evaluation',
    labels: ['Very poor', 'Poor', 'Neither poor nor good', 'Good', 'Very good'],
    suits: 'Judgments of standard or workmanship, where the respondent is appraising, not reporting a feeling.'
  },
  'comparison-5': {
    label: 'Five-point comparison',
    polarity: 'bipolar',
    family: 'comparison',
    labels: ['Much worse', 'Somewhat worse', 'About the same', 'Somewhat better', 'Much better'],
    suits: 'Change over time or against a stated reference point. The item has to name what the comparison is against.'
  },
  'agreement-change-5': {
    label: 'Five-point change',
    polarity: 'bipolar',
    family: 'comparison',
    labels: ['Decreased a lot', 'Decreased a little', 'Stayed the same',
      'Increased a little', 'Increased a lot'],
    suits: 'Self-reported change in a quantity, where direction as well as size matters.'
  },

  // ---- Unipolar: quantity and extent --------------------------------------
  'extent-5': {
    label: 'Five-point extent',
    polarity: 'unipolar',
    family: 'extent',
    labels: ['Not at all', 'A little', 'A moderate amount', 'A lot', 'A great deal'],
    suits: 'How much of something is present. The general purpose unipolar scale when no more specific wording fits.'
  },
  'intensity-5': {
    label: 'Five-point intensity, construct specific',
    polarity: 'unipolar',
    family: 'intensity',
    itemSpecific: true,
    labels: [
      'Not at all {construct}', 'Slightly {construct}', 'Moderately {construct}',
      'Very {construct}', 'Extremely {construct}'
    ],
    suits: 'Naming the construct in the anchors instead of asking for agreement about it. Usually the stronger choice for an adjectival construct, since it sidesteps acquiescence.'
  },
  'importance-5': {
    label: 'Five-point importance',
    polarity: 'unipolar',
    family: 'importance',
    labels: [
      'Not at all important', 'Slightly important', 'Moderately important',
      'Very important', 'Extremely important'
    ],
    suits: 'How much weight a respondent places on something. Prone to ceiling effects, since few things are reported as unimportant.'
  },
  'difficulty-5': {
    label: 'Five-point difficulty',
    polarity: 'unipolar',
    family: 'difficulty',
    labels: [
      'Not at all difficult', 'Slightly difficult', 'Moderately difficult',
      'Very difficult', 'Extremely difficult'
    ],
    suits: 'Perceived demand of a task or activity.'
  },
  'confidence-5': {
    label: 'Five-point confidence',
    polarity: 'unipolar',
    family: 'confidence',
    labels: [
      'Not at all confident', 'Slightly confident', 'Moderately confident',
      'Very confident', 'Completely confident'
    ],
    suits: 'Self-efficacy and perceived capability. The standard format for confidence to perform a named task.'
  },
  'likelihood-5': {
    label: 'Five-point likelihood',
    polarity: 'unipolar',
    family: 'likelihood',
    labels: [
      'Not at all likely', 'Slightly likely', 'Moderately likely',
      'Very likely', 'Extremely likely'
    ],
    suits: 'Stated intention or expectation about future behavior.'
  },
  'helpfulness-5': {
    label: 'Five-point helpfulness',
    polarity: 'unipolar',
    family: 'evaluation',
    labels: [
      'Not at all helpful', 'Slightly helpful', 'Moderately helpful',
      'Very helpful', 'Extremely helpful'
    ],
    suits: 'Perceived usefulness of a service, resource, or piece of feedback.'
  },

  // ---- Unipolar: frequency ------------------------------------------------
  // Two kinds, and the distinction matters more than it looks. Vague
  // quantifiers such as "often" are interpreted very differently by different
  // respondents, and the same word can mean weekly to one person and daily to
  // another. When the behavior is countable, specific frequencies remove that
  // variance entirely and should be preferred.
  'frequency-vague-5': {
    label: 'Five-point frequency, relative',
    polarity: 'unipolar',
    family: 'frequency',
    labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
    suits: 'How often something happens, when the behavior cannot be counted or the respondent would not know the count.'
  },
  'frequency-vague-7': {
    label: 'Seven-point frequency, relative',
    polarity: 'unipolar',
    family: 'frequency',
    labels: ['Never', 'Almost never', 'Rarely', 'Sometimes', 'Often', 'Very often', 'Always'],
    suits: 'Relative frequency where finer gradation is wanted, accepting that the middle terms remain open to interpretation.'
  },
  'frequency-specific-6': {
    label: 'Six-point frequency, specific',
    polarity: 'unipolar',
    family: 'frequency',
    requiresTimeFrame: true,
    labels: [
      'Never', 'Less than once a month', 'Once or twice a month',
      'Once or twice a week', 'Several times a week', 'Every day'
    ],
    suits: 'Countable behavior. Removes the variance introduced by words like "often", which different respondents read as different rates. Preferred whenever the behavior can actually be counted.'
  },

  // ---- Endorsement and numeric --------------------------------------------
  'endorsement-2': {
    label: 'Binary endorsement',
    polarity: 'bipolar',
    family: 'endorsement',
    labels: ['No', 'Yes'],
    suits: 'Checklist and symptom-inventory formats where a graded answer would be false precision. Loses variance, so it needs more items to reach the same reliability.'
  },
  'numeric-11': {
    label: 'Eleven-point numeric, endpoints labeled',
    polarity: 'unipolar',
    family: 'numeric',
    endpointsOnly: true,
    labels: [
      'Not at all {construct}', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Extremely {construct}'
    ],
    suits: 'Familiar zero to ten format. The only entry here that is not fully labeled, which is a real cost, accepted because respondents already know how to use it.'
  }
};

// Semantic differential is described, not offered. It requires a pair of
// opposing adjectives per item, not one shared anchor set, so it cannot
// be selected as a single scale for a whole instrument the way everything above
// can. Step 7 reports it as a possibility when the items would suit it, and
// leaves the anchor pairs to be written by hand.
const UNSUPPORTED = {
  'semantic-differential': {
    label: 'Semantic differential',
    reason: 'Needs a bipolar adjective pair written for each item instead of one shared anchor set, ' +
      'so it cannot be attached to a finished pool automatically.'
  }
};

// Selected when nothing recognizable comes back. Five-point agreement is the
// safest default for the first-person declarative statements Step 3 writes.
const FALLBACK = 'agreement-5';

// Substitute the construct name into item-specific anchors. Adjectival
// constructs read naturally; anything else is left on the shared wording,
// because "Extremely job satisfaction" is worse than a generic anchor.
function resolveLabels(entry, constructWord) {
  if (!entry.itemSpecific && !entry.endpointsOnly) {
    return entry.labels;
  }
  const word = String(constructWord || '').trim().toLowerCase();
  if (word.length === 0) {
    return entry.labels.map(function (label) {
      return label.replace(/\s*\{construct\}/g, '').trim() || label;
    });
  }
  return entry.labels.map(function (label) {
    return label.replace(/\{construct\}/g, word);
  });
}

function byPolarity(polarity) {
  return Object.keys(CATALOG).filter(function (key) {
    return CATALOG[key].polarity === polarity;
  });
}

module.exports = { CATALOG, UNSUPPORTED, FALLBACK, resolveLabels, byPolarity };
