// What each response format is for, and what it costs.
//
// Kept apart from the formats catalog in the main process, which holds the
// anchor labels the pipeline attaches to items. This is the reading matter:
// what a format measures well, where it goes wrong, and who established that.
// The two are separate because the catalog is compiled into every export and
// this is not, and because a paragraph of survey methodology has no business
// traveling with a Qualtrics file.
//
// Every claim here is attributable. Where the survey methodology literature
// disagrees, which it does on the midpoint and on the number of points, the
// disagreement is reported instead of one side of it. Nothing in this file is
// the application's own recommendation: the application picks a starting point
// during the run and explains that choice separately, and a person overruling
// it needs the field's reasoning, not ours.

// Short keys into the reference list below, so a claim and its source cannot
// drift apart when either is edited.
// Each reference as parts in place of as one string, so the journal title and
// volume can be set in italics and the rest cannot.
//
// APA 7 italicises the periodical title and the volume number, and the title of
// a book or report, and nothing else in the entry. That is a typographic rule
// and it cannot be expressed in a flat string without the renderer guessing
// where the italics belong, which is why these are split.
//
// Page ranges use a plain hyphen. APA sets them with an en dash and this project
// bans en dashes outright, so the hyphen is a deliberate departure from the
// style instead of an oversight.
export const SOURCES = {
  likert: {
    key: 'Likert 1932',
    parts: [
      { text: 'Likert, R. (1932). A technique for the measurement of attitudes. ' },
      { text: 'Archives of Psychology, 140', italic: true },
      { text: ', 1-55.' }
    ]
  },
  osgood: {
    key: 'Osgood et al. 1957',
    parts: [
      { text: 'Osgood, C. E., Suci, G. J., and Tannenbaum, P. H. (1957). ' },
      { text: 'The Measurement of Meaning', italic: true },
      { text: '. University of Illinois Press.' }
    ]
  },
  krosnick1991: {
    key: 'Krosnick 1991',
    parts: [
      {
        text: 'Krosnick, J. A. (1991). Response strategies for coping with the ' +
          'cognitive demands of attitude measures in surveys. '
      },
      { text: 'Applied Cognitive Psychology, 5', italic: true },
      { text: '(3), 213-236.' }
    ]
  },
  krosnickAlwin: {
    key: 'Krosnick and Alwin 1988',
    parts: [
      {
        text: 'Krosnick, J. A., and Alwin, D. F. (1988). A test of the form ' +
          'resistant correlation hypothesis. '
      },
      { text: 'Public Opinion Quarterly, 52', italic: true },
      { text: '(4), 526-538.' }
    ]
  },
  krosnickPresser: {
    key: 'Krosnick and Presser 2010',
    parts: [
      { text: 'Krosnick, J. A., and Presser, S. (2010). Question and questionnaire design. In P. V. Marsden and J. D. Wright (Eds.), ' },
      { text: 'Handbook of Survey Research', italic: true },
      { text: ' (2nd ed., pp. 263-313). Emerald.' }
    ]
  },
  dillman: {
    key: 'Dillman et al. 2014',
    parts: [
      { text: 'Dillman, D. A., Smyth, J. D., and Christian, L. M. (2014). ' },
      { text: 'Internet, Phone, Mail, and Mixed-Mode Surveys: The Tailored Design Method', italic: true },
      { text: ' (4th ed.). Wiley.' }
    ]
  },
  schwarz: {
    key: 'Schwarz 1999',
    parts: [
      { text: 'Schwarz, N. (1999). Self-reports: How the questions shape the answers. ' },
      { text: 'American Psychologist, 54', italic: true },
      { text: '(2), 93-105.' }
    ]
  },
  tourangeau: {
    key: 'Tourangeau et al. 2000',
    parts: [
      { text: 'Tourangeau, R., Rips, L. J., and Rasinski, K. (2000). ' },
      { text: 'The Psychology of Survey Response', italic: true },
      { text: '. Cambridge University Press.' }
    ]
  },
  saris: {
    key: 'Saris et al. 2010',
    parts: [
      {
        text: 'Saris, W. E., Revilla, M., Krosnick, J. A., and Shaeffer, E. M. (2010). ' +
          'Comparing questions with agree/disagree response options with questions ' +
          'with item-specific response options. '
      },
      { text: 'Survey Research Methods, 4', italic: true },
      { text: '(1), 61-79.' }
    ]
  },
  revilla: {
    key: 'Revilla et al. 2014',
    parts: [
      {
        text: 'Revilla, M. A., Saris, W. E., and Krosnick, J. A. (2014). Choosing the ' +
          'number of categories in agree/disagree scales. '
      },
      { text: 'Sociological Methods and Research, 43', italic: true },
      { text: '(1), 73-97.' }
    ]
  },
  simms: {
    key: 'Simms et al. 2019',
    parts: [
      {
        text: 'Simms, L. J., Zelazny, K., Williams, T. F., and Bernstein, L. (2019). ' +
          'Does the number of response options matter? Psychometric perspectives using ' +
          'personality questionnaire data. '
      },
      { text: 'Psychological Assessment, 31', italic: true },
      { text: '(4), 557-566.' }
    ]
  },
  presserSchuman: {
    key: 'Presser and Schuman 1980',
    parts: [
      {
        text: 'Presser, S., and Schuman, H. (1980). The measurement of a middle ' +
          'position in attitude surveys. '
      },
      { text: 'Public Opinion Quarterly, 44', italic: true },
      { text: '(1), 70-85.' }
    ]
  },
  schaeffer: {
    key: 'Schaeffer and Presser 2003',
    parts: [
      { text: 'Schaeffer, N. C., and Presser, S. (2003). The science of asking questions. ' },
      { text: 'Annual Review of Sociology, 29', italic: true },
      { text: ', 65-88.' }
    ]
  },
  couper: {
    key: 'Couper et al. 2006',
    parts: [
      {
        text: 'Couper, M. P., Tourangeau, R., Conrad, F. G., and Singer, E. (2006). ' +
          'Evaluating the effectiveness of visual analog scales. '
      },
      { text: 'Social Science Computer Review, 24', italic: true },
      { text: '(2), 227-245.' }
    ]
  }
};

// One entry per family in the formats catalog, in the order the format menu
// groups them.
export const FAMILY_NOTES = [
  {
    family: 'agreement',
    shape: 'bipolar',
    group: 'attitude',
    asks: 'How far do you agree with this statement?',
    madeOf: 'One statement, one shared anchor set, a midpoint in the odd-numbered forms.',
    title: 'Agreement',
    example: 'I can keep my work and home life separate. Strongly disagree to strongly agree.',
    purpose:
      'A statement is put to the respondent and they say how far they agree with it. This is ' +
      'the summated rating scale Likert described, and it is the most common item type in ' +
      'attitude research.',
    strengths: [
      'One anchor set serves every item, so a long instrument stays fast to answer.',
      'Familiar to almost every respondent, which lowers the cost of the first few items.',
      'Suits latent attitudes that have no natural unit of measurement.'
    ],
    cautions: [
      'Acquiescence. Some respondents agree with whatever is put to them regardless of ' +
        'content, which inflates correlations among same-direction items and is the reason ' +
        'reverse-keyed items exist.',
      'Item-specific wording usually measures the same thing more reliably. Asking how ' +
        'satisfied someone is, with satisfaction anchors, beats asking whether they agree they ' +
        'are satisfied.'
    ],
    sources: ['likert', 'krosnickPresser', 'saris']
  },
  {
    family: 'satisfaction',
    shape: 'bipolar',
    group: 'attitude',
    asks: 'How satisfied are you with this?',
    madeOf: 'Anchors naming satisfaction itself, written per item.',
    title: 'Satisfaction',
    example: 'How satisfied are you with your workload? Very dissatisfied to very satisfied.',
    purpose:
      'An item-specific scale where the anchors name the thing being judged instead of naming ' +
      'agreement with a statement about it.',
    strengths: [
      'Item-specific anchors avoid the acquiescence that agreement wording invites.',
      'The question and the answer options describe the same dimension, so less has to be ' +
        'held in mind while answering.'
    ],
    cautions: [
      'Satisfaction ratings skew high in most settings, which compresses the usable range. ' +
        'Where nearly everyone answers at the top, the item separates almost nobody.',
      'Each item needs its own anchor set written for it, which is more work than one shared set.'
    ],
    sources: ['saris', 'krosnickPresser', 'schaeffer']
  },
  {
    family: 'evaluation',
    shape: 'bipolar',
    group: 'attitude',
    asks: 'How good is it?',
    madeOf: 'Anchors from poor to excellent, or an equivalent quality word.',
    title: 'Evaluation and quality',
    example: 'How would you rate the quality of the guidance you received? Poor to excellent.',
    purpose: 'A judgment of standard or worth against a named quality.',
    strengths: [
      'Reads naturally for anything the respondent is assessing and not endorsing.',
      'The endpoints are concrete enough that respondents interpret them similarly.'
    ],
    cautions: [
      'Poor to excellent is not evenly spaced in respondents\u2019 minds. Treating the numbers ' +
        'as an interval scale is an assumption, not a fact about the wording.',
      'Shares the ceiling problem of satisfaction where the respondent has a relationship with ' +
        'whatever is being rated.'
    ],
    sources: ['schaeffer', 'krosnickPresser']
  },
  {
    family: 'frequency',
    shape: 'unipolar',
    group: 'amount',
    asks: 'How often did this happen?',
    madeOf: 'Either counts tied to a period, or vague words like often and rarely.',
    title: 'Frequency',
    example:
      'In the past month, how often did you work past 7pm? Never, once or twice, weekly, ' +
      'several times a week, daily.',
    purpose:
      'How often a behavior occurred. There are two forms and they are not interchangeable. ' +
      'One uses vague words such as often and rarely, the other uses counts tied to a period.',
    strengths: [
      'Specific counts are answerable from memory, not from judgment, and they mean ' +
        'the same thing to every respondent.',
      'Behavior is easier to report accurately than attitude.'
    ],
    cautions: [
      'Vague quantifiers are interpreted relative to what the respondent believes is normal, ' +
        'so often means different amounts to different people and cannot be compared across them.',
      'The range of options offered is itself read as information about what is typical, and ' +
        'shifts the answers given. This is a documented effect, not a theoretical risk.',
      'Long recall periods invite estimation. Shorter windows are more accurate but catch ' +
        'less behavior.'
    ],
    sources: ['schwarz', 'tourangeau', 'dillman']
  },
  {
    family: 'extent',
    shape: 'unipolar',
    group: 'amount',
    asks: 'How much of this is there?',
    madeOf: 'A true zero at one end, rising to a great deal.',
    title: 'Extent and intensity',
    example: 'To what extent do the new requirements affect your planning? Not at all to a great deal.',
    purpose: 'How much of something there is, from none upward. Unipolar by construction.',
    strengths: [
      'A true zero point at one end, which suits anything that can be genuinely absent.',
      'Avoids forcing a respondent to place themselves on a positive or negative side when ' +
        'the construct has no negative side.'
    ],
    cautions: [
      'Unipolar and bipolar scales are not interchangeable, and choosing the wrong one changes ' +
        'what the item measures in place of only how precisely it measures it.',
      'The intermediate anchors are vague quantifiers and carry the same comparability problem ' +
        'as vague frequency.'
    ],
    sources: ['krosnickPresser', 'schwarz']
  },
  {
    family: 'importance',
    shape: 'unipolar',
    group: 'amount',
    asks: 'How much does this matter to you?',
    madeOf: 'Not at all important through to extremely important.',
    title: 'Importance',
    example: 'How important is schedule control to you? Not at all important to extremely important.',
    purpose: 'The weight a respondent places on something.',
    strengths: [
      'Directly asks the thing many studies infer indirectly.',
      'Unipolar and interpretable without reference to other items.'
    ],
    cautions: [
      'Almost everything is rated important when rated one item at a time. Where the research ' +
        'question is what matters most, ranking or forced choice separates respondents that ' +
        'rating does not.',
      'Ranking is harder to answer and harder to analyze, so the gain is not free.'
    ],
    sources: ['krosnickAlwin', 'krosnickPresser']
  },
  {
    family: 'difficulty',
    shape: 'unipolar',
    group: 'self',
    asks: 'How hard is this to do?',
    madeOf: 'Very easy through to very difficult.',
    title: 'Difficulty',
    example: 'How difficult is it to take leave when you need it? Very easy to very difficult.',
    purpose: 'Perceived effort or obstacle.',
    strengths: [
      'Concrete and behaviorally anchored, which respondents answer more consistently than ' +
        'abstract attitude items.'
    ],
    cautions: [
      'Difficulty is confounded with experience. Someone who has never attempted the thing ' +
        'answers about their expectation, which is a different quantity.'
    ],
    sources: ['tourangeau', 'schaeffer']
  },
  {
    family: 'confidence',
    shape: 'unipolar',
    group: 'self',
    asks: 'How sure are you that you could do this?',
    madeOf: 'Not at all confident through to completely confident.',
    title: 'Confidence',
    example: 'How confident are you that you could arrange cover at short notice? Not at all to completely.',
    purpose: 'Self-assessed capability or certainty. The usual form for self-efficacy items.',
    strengths: [
      'Well established in self-efficacy measurement, where the construct is defined as ' +
        'confidence in performing a specific action.',
      'Unipolar with a meaningful zero.'
    ],
    cautions: [
      'Confidence and ability are different things, and an instrument measuring confidence ' +
        'should not be described as measuring competence.',
      'Self-assessment is systematically miscalibrated in both directions depending on the ' +
        'respondent\u2019s actual skill.'
    ],
    sources: ['krosnickPresser', 'tourangeau']
  },
  {
    family: 'likelihood',
    shape: 'unipolar',
    group: 'self',
    asks: 'How likely is this to happen?',
    madeOf: 'Very unlikely through to very likely.',
    title: 'Likelihood',
    example: 'How likely are you to apply for promotion this year? Very unlikely to very likely.',
    purpose: 'Expected future behavior or event.',
    strengths: [
      'Answers a forward-looking question directly instead of inferring intention from attitude.'
    ],
    cautions: [
      'Stated intention predicts behavior weakly, and more weakly the further off the ' +
        'behavior is. An instrument built on likelihood items measures intention and should ' +
        'say so.',
      'Verbal probability anchors are read as different numeric probabilities by different ' +
        'people, which is why numeric formats are sometimes preferred here.'
    ],
    sources: ['tourangeau', 'schaeffer']
  },
  {
    family: 'comparison',
    shape: 'bipolar',
    group: 'attitude',
    asks: 'How does this compare with a stated reference point?',
    madeOf: 'A named comparison point in the stem, less to more anchors.',
    title: 'Comparison and change',
    example: 'Compared with a year ago, how manageable is your workload? Much less to much more.',
    purpose: 'A judgment against a stated reference point, often the respondent\u2019s own past.',
    strengths: [
      'Answers a change question in one item where two measurements are not available.',
      'The reference point is stated in the item, so it is the same for every respondent.'
    ],
    cautions: [
      'Retrospective change reports are not equivalent to measuring the same people twice. ' +
        'They are reconstructions, shaped by how the respondent feels now.',
      'Where the study can measure at two points, it should.'
    ],
    sources: ['tourangeau', 'schwarz']
  },
  {
    family: 'endorsement',
    shape: 'binary',
    group: 'other',
    asks: 'Did this happen, yes or no?',
    madeOf: 'Two states and nothing between them.',
    title: 'Binary endorsement',
    example: 'Have you requested flexible hours in the past year? Yes or no.',
    purpose: 'A yes or no answer, usually for a fact and not an attitude.',
    strengths: [
      'Fastest item type to answer and the least ambiguous to interpret.',
      'Appropriate where the underlying thing genuinely has two states.'
    ],
    cautions: [
      'Applying it to an attitude throws information away. A binary item cannot tell mild ' +
        'from strong, and a scale built from binary items measures less reliably than the ' +
        'same number of graded ones.',
      'Encourages acquiescence in the same way agreement wording does.'
    ],
    sources: ['krosnickPresser', 'krosnick1991']
  },
  {
    family: 'numeric',
    shape: 'numeric',
    group: 'other',
    asks: 'Where does this sit on a numbered line?',
    madeOf: 'Eleven points from 0 to 10, with only the ends named.',
    title: 'Numeric rating',
    example: 'On a scale of 0 to 10, how manageable is your current workload?',
    purpose: 'A long numbered line with only the ends named.',
    strengths: [
      'Familiar from customer research, and offers fine discrimination without writing an ' +
        'anchor for every point.',
      'Works where no verbal anchors would be agreed on.'
    ],
    cautions: [
      'Unlabeled intermediate points are interpreted inconsistently, and fully labeled ' +
        'scales are generally more reliable than end-labeled ones.',
      'Respondents cluster on round numbers and avoid the extremes, which narrows the range ' +
        'actually used.'
    ],
    sources: ['krosnickPresser', 'couper', 'dillman']
  }
];

// The two decisions that cut across every family, where the literature does not
// speak with one voice. Presented as an unsettled question, not as a
// recommendation, because that is what it is.
export const CROSS_CUTTING = [
  {
    title: 'How many points',
    body:
      'For bipolar attitude scales, five to seven points is the usual recommendation, and ' +
      'reliability gains flatten out beyond about seven. Unipolar scales are commonly given ' +
      'four or five. Work on agree/disagree scales has argued for longer scales than the ' +
      'traditional five, and psychometric comparisons of six-point and longer formats have ' +
      'found differences small enough that the choice rarely dominates a study. Two points is ' +
      'measurably worse than any graded alternative for an attitude.',
    sources: ['krosnickPresser', 'revilla', 'simms']
  },
  {
    title: 'Midpoint or no midpoint',
    body:
      'Offering a middle option raises the proportion choosing it, and the people who move ' +
      'there are disproportionately those with no real opinion, which can be an argument for ' +
      'the midpoint or against it depending on whether the study wants to record that. Removing ' +
      'it forces a side from respondents who genuinely have none. The choice should follow from ' +
      'whether neutrality is a meaningful answer to the question being asked.',
    sources: ['presserSchuman', 'krosnickPresser', 'schaeffer']
  },
  {
    title: 'Agreement wording against item-specific wording',
    body:
      'Agreement items are quick to write and quick to answer, and one anchor set covers a ' +
      'whole instrument. Item-specific wording, where the anchors name the dimension being ' +
      'asked about, has been found to measure with less error and less acquiescence. Where an ' +
      'item can be rewritten as a direct question with its own anchors, that is usually the ' +
      'stronger form.',
    sources: ['saris', 'krosnickPresser', 'dillman']
  },
  {
    title: 'Semantic differential',
    body:
      'A bipolar pair of adjectives with unlabeled points between them, from Osgood\u2019s work ' +
      'on connotative meaning. It is documented here in place of offered, because it needs an ' +
      'adjective pair written for each item instead of one shared anchor set, which cannot be ' +
      'attached to a finished pool automatically.',
    sources: ['osgood']
  }
];


// The four groups the cards are arranged in.
//
// Grouped by the shape of the response instead of by subject, because the shape
// is what the graphic on each card shows and what actually decides whether a
// format suits a question. Two-sided and one-sided scales are not
// interchangeable, and someone who understands that distinction has learned the
// most useful thing on this screen.
export const GROUPS = [
  {
    id: 'attitude',
    title: 'Two-sided scales',
    summary:
      'A dimension with opposite ends and a middle. Suits anything a respondent can be ' +
      'positive or negative about.'
  },
  {
    id: 'amount',
    title: 'One-sided scales',
    summary:
      'A dimension running from none upward. Suits anything that can genuinely be absent, ' +
      'where there is no opposite to be at.'
  },
  {
    id: 'self',
    title: 'Judgments about oneself',
    summary:
      'One-sided in shape, but asking the respondent to assess their own capability, ' +
      'effort, or future behavior, which carries its own biases.'
  },
  {
    id: 'other',
    title: 'Other shapes',
    summary: 'Formats that are not a labeled scale at all.'
  }
];


// The mark for each family, shared with the item format menu so a family looks
// the same wherever it appears. Chosen to suggest the shape of the response
// in place of to decorate: graduations for agreement, an arc for satisfaction,
// two arrows for a comparison, a square for a yes or no.
export const FAMILY_MARK = {
  agreement: '\u2261',
  satisfaction: '\u2312',
  evaluation: '\u2606',
  comparison: '\u21C4',
  extent: '\u25E7',
  intensity: '\u25D0',
  importance: '\u25B3',
  difficulty: '\u2206',
  confidence: '\u25CE',
  likelihood: '\u223C',
  frequency: '\u2237',
  endorsement: '\u25A1',
  numeric: '\u0023',
  open: '\u00B6'
};
