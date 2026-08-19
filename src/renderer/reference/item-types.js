// The item taxonomy (Dillman, Smyth, & Christian, 2014).
//
// The source framework is emphatic that these labels do not all sit at the same
// level, and that an item is described by several of them at once and not by
// one. A screen that presented thirty-eight types as a single list would teach
// the opposite of what the framework says, so the groups here are the seven
// property sets an item is classified on, and the worked examples at the end
// exist to show that a real item carries a value from several of them.
//
// Kept apart from the response formats reference next door. That file covers the
// scales this application can attach to a generated item and argues about
// midpoints and scale length. This one is the wider vocabulary of survey item
// design, most of which the pipeline does not produce, and it is here because
// somebody writing or reviewing an instrument needs the distinctions whether or
// not this application can generate every one of them.

export const CITATION = {
  key: 'Dillman et al. 2014',
  parts: [
    { text: 'Dillman, D. A., Smyth, J. D., and Christian, L. M. (2014). ' },
    {
      text: 'Internet, Phone, Mail, and Mixed-Mode Surveys: The Tailored Design Method',
      italic: true
    },
    { text: ' (4th ed.). Wiley.' }
  ]
};

export const GROUPS = [
  {
    id: 'format',
    title: 'Primary response format',
    summary:
      'The first thing to settle about any item. Does the respondent write an answer or ' +
      'choose one, and if they choose, do the choices come in an order?'
  },
  {
    id: 'subtype',
    title: 'Subtype',
    summary: 'Within a primary format, the shape of the response task itself.'
  },
  {
    id: 'direction',
    title: 'Scale direction',
    summary:
      'For ordered categories only. Whether the scale runs from none upward, or from one ' +
      'direction through a middle to its opposite.'
  },
  {
    id: 'role',
    title: 'Questionnaire role',
    summary:
      'What the item does for the questionnaire, which is a separate property from how it is ' +
      'answered. An item has a role and a format, not one or the other.'
  },
  {
    id: 'structure',
    title: 'Compound structure',
    summary:
      'How items are grouped on the page. These describe presentation and say nothing about ' +
      'what is being measured.'
  },
  {
    id: 'control',
    title: 'Response control',
    summary:
      'What the respondent physically operates. The control does not settle what is being ' +
      'measured, since a slider can carry an ordinal scale or a numeric one.'
  },
  {
    id: 'information',
    title: 'Information type',
    summary: 'What the item is about, classified separately from how it is answered.'
  }
];

export const TYPES = [
  // ---- Primary response format
  {
    id: 'open-ended',
    group: 'format',
    glyph: 'text',
    title: 'Open-ended',
    asks: 'The respondent writes their own answer.',
    body:
      'No predetermined categories, or not only categories. Suits anything where the range of ' +
      'reasonable answers is unknown, or where the wording of the answer is itself the data.',
    example: 'What could be improved about this service?\n[ open text ]',
    good: [
      'Catches answers nobody thought to offer as an option.',
      'Records the respondent\u2019s own words, which closed categories destroy.'
    ],
    watch: [
      'Costs the respondent more effort than choosing, and drop-off rises with the number of ' +
        'open items.',
      'Answers need coding before they can be counted.'
    ]
  },
  {
    id: 'closed-nominal',
    group: 'format',
    glyph: 'nominal',
    title: 'Closed-ended nominal',
    asks: 'The respondent picks from categories that have no order.',
    body:
      'The categories differ in kind, not in degree. Nothing about the list implies that ' +
      'one option is more of anything than another.',
    example: 'Which type do you use most often?\n( ) Type A   ( ) Type B   ( ) Type C',
    good: ['Fast to answer and unambiguous to count.'],
    watch: [
      'The list has to cover the ground. An option somebody needs and cannot find becomes a ' +
        'wrong answer in place of a missing one.'
    ]
  },
  {
    id: 'closed-ordinal',
    group: 'format',
    glyph: 'ordinal',
    title: 'Closed-ended ordinal',
    asks: 'The respondent picks from categories that have an inherent order.',
    body:
      'The categories run in a direction. Whether the steps between them are equal is a ' +
      'separate question, and usually an assumption instead of a fact about the wording.',
    example: 'How often does this occur?\n( ) Always ( ) Often ( ) Sometimes ( ) Rarely ( ) Never',
    good: ['Records degree, which a nominal list cannot.'],
    watch: [
      'Ordered does not mean evenly spaced. Treating the categories as numbers assumes ' +
        'something the respondent was never asked.'
    ]
  },
  {
    id: 'partially-closed',
    group: 'format',
    glyph: 'partial',
    title: 'Partially closed-ended',
    asks: 'A list of categories, plus a place to write something else.',
    body:
      'A hybrid. Suits the case where the categories are known to cover most answers but not ' +
      'all of them.',
    example: 'Which type do you use most often?\n( ) Type A  ( ) Type B  ( ) Other, please specify ____',
    good: ['Keeps the counting benefit of a list without forcing a wrong answer.'],
    watch: [
      'An other box that fills up is telling you the categories were wrong, and it is worth ' +
        'reading and not discarding.'
    ]
  },

  // ---- Subtype
  {
    id: 'descriptive-open',
    group: 'subtype',
    glyph: 'text',
    title: 'Descriptive open-ended',
    asks: 'A narrative, explanation, reason, or suggestion in the respondent\u2019s own words.',
    body: 'Used when the content of the answer matters more than its comparability.',
    example: 'What could be improved about this service?\n[ open text ]',
    good: ['The only format that can return something unanticipated.'],
    watch: ['Needs coding. Budget for that before adding several.']
  },
  {
    id: 'numerical-open',
    group: 'subtype',
    glyph: 'numeric-field',
    title: 'Numerical open-ended',
    asks: 'One exact number.',
    body:
      'Counts, frequencies, amounts, money, dates, durations, percentages, and allocations all ' +
      'take this form. Where several entries have to total a known amount, the item is also an ' +
      'allocation.',
    example: 'How many times did you participate during the past month?\n___ times',
    good: ['Gives an exact value instead of a range somebody has to interpret later.'],
    watch: [
      'Only ask for precision the respondent actually has. A number recalled from a year ago ' +
        'is an estimate whether or not the box looks exact.'
    ]
  },
  {
    id: 'list-open',
    group: 'subtype',
    glyph: 'list',
    title: 'List-style open-ended',
    asks: 'Several separate short answers, not one passage.',
    body: 'Used when the respondent should supply discrete items.',
    example: 'Please list up to three activities in which you participated.\n1. ____\n2. ____\n3. ____',
    good: ['Separates the answers for you, so no parsing of a paragraph afterwards.'],
    watch: ['The number of boxes suggests how many answers are expected.']
  },
  {
    id: 'binary',
    group: 'subtype',
    glyph: 'binary',
    title: 'Binary or two-category',
    asks: 'One of two alternatives.',
    body: 'Yes and no, favor and oppose, did and did not, or any other either-or split.',
    example: 'Have you used this service during the past year?\n( ) Yes   ( ) No',
    good: ['Fastest item there is, and the least ambiguous to count.'],
    watch: [
      'Applying it to a matter of degree throws away everything except direction.'
    ]
  },
  {
    id: 'single-multicategory',
    group: 'subtype',
    glyph: 'radio',
    title: 'Single-answer multicategory',
    asks: 'One category from three or more that have no order.',
    body: 'The standard pick-one question.',
    example: 'Which type do you use most often?\n( ) Type A ( ) Type B ( ) Type C ( ) Type D',
    good: ['Clear response task, one value per respondent.'],
    watch: ['Where more than one answer is genuinely true, this format forces a false choice.']
  },
  {
    id: 'check-all',
    group: 'subtype',
    glyph: 'checkbox',
    title: 'Check-all-that-apply',
    asks: 'Every option that applies, from one list.',
    body:
      'The respondent scans the list and ticks. Nothing requires them to consider every line, ' +
      'and in practice many do not.',
    example: 'Which of the following have you used? Select all that apply.\n[ ] A  [ ] B  [ ] C  [ ] D',
    good: ['Quick, and familiar to every respondent.'],
    watch: [
      'Options further down the list are ticked less often, because attention runs out ' +
        'before the list does.',
      'An unticked box is ambiguous. It can mean no, or it can mean not read.'
    ]
  },
  {
    id: 'forced-choice',
    group: 'subtype',
    glyph: 'forced',
    title: 'Multiple-answer forced-choice',
    asks: 'An explicit yes or no against every option in turn.',
    body:
      'The same content as check-all-that-apply and a different response task. Every option ' +
      'receives a judgment, so an answer of no is a stated no.',
    example: 'Have you used each of the following?\n         Yes  No\nOption A  ( )  ( )\nOption B  ( )  ( )',
    good: [
      'Removes the ambiguity of an unticked box.',
      'Attention holds further down the list than it does in a check-all.'
    ],
    watch: [
      'This is not check-all-that-apply with a different appearance. The two formats produce ' +
        'different results from the same respondents, so they are not interchangeable.'
    ]
  },
  {
    id: 'ranking',
    group: 'subtype',
    glyph: 'rank',
    title: 'Ranking',
    asks: 'Several options placed in order against a stated criterion.',
    body:
      'The options themselves are nominal categories. The order is imposed by the respondent ' +
      'in place of carried by the list.',
    example: 'Rank the following from most to least important.\n___ Option A\n___ Option B\n___ Option C',
    good: [
      'Separates respondents where rating does not. Asked one at a time, almost everything ' +
        'is rated important.'
    ],
    watch: [
      'Effortful, and the effort grows quickly with the number of options.',
      'Produces no information about distance. First and second may be far apart or nearly tied.'
    ]
  },
  {
    id: 'paired-comparison',
    group: 'subtype',
    glyph: 'paired',
    title: 'Paired comparison',
    asks: 'Which of these two.',
    body:
      'One comparison at a time. Repeated across the set, the answers can be combined into an ' +
      'ordering afterwards.',
    example: 'Which of these is more important to you?\n( ) Option A   ( ) Option B',
    good: ['Each judgment is easy, even when the full ordering would be hard.'],
    watch: [
      'The number of pairs grows with the square of the options, so this gets long fast.'
    ]
  },
  {
    id: 'vague-quantifier',
    group: 'subtype',
    glyph: 'vague',
    title: 'Vague-quantifier scale',
    asks: 'An ordered degree, in words with no exact quantity behind them.',
    body:
      'Always, often, sometimes, rarely, never. Agreement, satisfaction, importance, ' +
      'likelihood, confidence, quality, and difficulty are usually measured this way.',
    example: 'How often does this occur?\n( ) Always ( ) Often ( ) Sometimes ( ) Rarely ( ) Never',
    good: ['Works where no natural unit exists, which is most attitude measurement.'],
    watch: [
      'Often means different amounts to different people, and is read against what each ' +
        'believes is normal. Answers are not comparable across respondents in the way a count is.'
    ]
  },
  {
    id: 'natural-metric',
    group: 'subtype',
    glyph: 'ranges',
    title: 'Natural-metric scale',
    asks: 'An ordered category expressed in real quantities or ranges.',
    body:
      'Counts, ranges, time periods, or other natural units. Ordered like a vague-quantifier ' +
      'scale and anchored to something measurable.',
    example: 'How many times during the past month?\n( ) None ( ) 1-2 ( ) 3-5 ( ) 6-10 ( ) More than 10',
    good: ['Means the same thing to every respondent, unlike often or rarely.'],
    watch: [
      'Not the same as an open numeric item. This asks for a band, and that asks for a value.',
      'The range of bands offered is read as information about what is typical, and shifts ' +
        'the answers given.'
    ]
  },

  // ---- Scale direction
  {
    id: 'unipolar',
    group: 'direction',
    glyph: 'unipolar',
    title: 'Unipolar',
    asks: 'How much of one thing, from none upward.',
    body:
      'A single dimension with its zero at one end. There is no opposite to be at, only less ' +
      'and less of the thing.',
    example: 'How useful was the information?\nExtremely / Very / Somewhat / Slightly / Not at all useful',
    good: ['Correct wherever the construct can genuinely be absent.'],
    watch: ['Do not add a midpoint to a unipolar scale. There is no middle for it to mark.']
  },
  {
    id: 'bipolar',
    group: 'direction',
    glyph: 'bipolar',
    title: 'Bipolar',
    asks: 'Which direction, and how strongly.',
    body:
      'Runs from one direction of a construct, through a middle, to its opposite. Measures ' +
      'direction and intensity together.',
    example:
      'How satisfied or dissatisfied are you?\nVery satisfied / Somewhat satisfied / ' +
      'Neither / Somewhat dissatisfied / Very dissatisfied',
    good: ['The right shape for anything a respondent can be for or against.'],
    watch: [
      'Whether to offer the middle is a real decision, not a default. It changes who lands ' +
        'where.',
      'Do not mix unipolar and bipolar logic inside one scale.'
    ]
  },
  {
    id: 'branched-bipolar',
    group: 'direction',
    glyph: 'branch',
    title: 'Branched bipolar',
    asks: 'Direction first, then intensity as a second question.',
    body:
      'The bipolar judgment split in two. Which side, then how far. Still bipolar ordinal ' +
      'measurement, asked in two steps.',
    example:
      'Are you satisfied, dissatisfied, or neither?\n' +
      'If satisfied, how satisfied? Slightly / Somewhat / Very',
    good: [
      'Each question is simpler than the combined one, which suits telephone administration ' +
        'and long scales.'
    ],
    watch: ['Two questions where there was one, and routing to get wrong.']
  },

  // ---- Questionnaire role
  {
    id: 'standard-item',
    group: 'role',
    glyph: 'standard',
    title: 'Standard substantive item',
    asks: 'An item asked of everyone, for its own sake.',
    body: 'The default role. Most items in most instruments.',
    example: 'How satisfied are you with this service?',
    good: [],
    watch: []
  },
  {
    id: 'screening',
    group: 'role',
    glyph: 'screen',
    title: 'Screening item',
    asks: 'Does this person qualify at all?',
    body:
      'Decides whether the respondent belongs in the survey, or in one section of it. This is ' +
      'a role and not a format. A screening item is usually closed, nominal, and binary too.',
    example: 'Are you 18 years of age or older?\n( ) Yes   ( ) No',
    good: ['Keeps ineligible respondents out of data they would distort.'],
    watch: ['A screener that reveals what qualifies invites people to answer their way in.']
  },
  {
    id: 'filter',
    group: 'role',
    glyph: 'filter',
    title: 'Filter or branching item',
    asks: 'Do the next questions apply to this person?',
    body: 'Routes the respondent. The answer decides what they see next.',
    example: 'Have you used this service during the past 12 months?\n( ) Yes   ( ) No',
    good: ['Nobody is asked about something that did not happen to them.'],
    watch: [
      'Respondents learn that yes brings more questions, and some answer no to shorten the ' +
        'survey.'
    ]
  },
  {
    id: 'follow-up',
    group: 'role',
    glyph: 'followup',
    title: 'Follow-up item',
    asks: 'The detail, asked only when it applies.',
    body: 'Shown because an earlier answer made it relevant.',
    example: 'If yes: how many times during the past 12 months?\n___ times',
    good: ['Detail where it is meaningful and nowhere else.'],
    watch: ['Answered by fewer people than the item above it, so the base changes.']
  },

  // ---- Compound structure
  {
    id: 'standalone',
    group: 'structure',
    glyph: 'standalone',
    title: 'Standalone',
    asks: 'One item, presented on its own.',
    body: 'The default structure.',
    example: 'How satisfied are you with this service?',
    good: [],
    watch: []
  },
  {
    id: 'grid',
    group: 'structure',
    glyph: 'grid',
    title: 'Grid',
    asks: 'Several items sharing one set of response categories.',
    body:
      'A presentation structure. Every row is still an individual item with its own format and ' +
      'its own answer.',
    example: '                 Very sat.  Somewhat  Slightly  Not at all\nItem A             ( )      ( )      ( )      ( )\nItem B             ( )      ( )      ( )      ( )',
    good: ['Compact, and the shared anchors are read once instead of per item.'],
    watch: [
      'Encourages straightlining, where a respondent answers down a column without reading.',
      'Long grids are hard to use on a narrow screen.'
    ]
  },
  {
    id: 'matrix',
    group: 'structure',
    glyph: 'matrix',
    title: 'Matrix',
    asks: 'Several pieces of information collected across rows and columns.',
    body:
      'A table gathering different quantities about each row. Saying matrix says nothing about ' +
      'whether the underlying items are nominal, ordinal, or open.',
    example: 'Activity    Times   Hours   Most recent\nActivity A   ___     ___     ___\nActivity B   ___     ___     ___',
    good: ['Efficient where the same set of facts is wanted about several things.'],
    watch: ['Demanding to complete, and unforgiving on small screens.']
  },

  // ---- Response control
  {
    id: 'text-box',
    group: 'control',
    glyph: 'text',
    title: 'Text box',
    asks: 'Typed words.',
    body: 'For open-ended text. Its size signals how much is expected.',
    example: '[________________________]',
    good: [],
    watch: ['A large box invites a long answer, and a small one truncates thinking.']
  },
  {
    id: 'numeric-entry',
    group: 'control',
    glyph: 'numeric-field',
    title: 'Numeric entry box',
    asks: 'One typed number.',
    body: 'For open numerical answers, usually with the unit printed beside the field.',
    example: '___ times',
    good: [],
    watch: ['State the unit next to the box, not only in the question.']
  },
  {
    id: 'radio',
    group: 'control',
    glyph: 'radio',
    title: 'Radio buttons',
    asks: 'One choice from a visible list.',
    body: 'The control for any single-answer item where the options should all be seen.',
    example: '( ) Option A\n( ) Option B\n( ) Option C',
    good: ['Every option is visible, so none is missed for being scrolled past.'],
    watch: []
  },
  {
    id: 'checkbox',
    group: 'control',
    glyph: 'checkbox',
    title: 'Check boxes',
    asks: 'Any number of choices.',
    body: 'The control for check-all-that-apply.',
    example: '[ ] Option A\n[ ] Option B\n[ ] Option C',
    good: [],
    watch: ['Carries the ambiguity of the unticked box along with the format.']
  },
  {
    id: 'dropdown',
    group: 'control',
    glyph: 'dropdown',
    title: 'Drop-down menu',
    asks: 'One choice from a hidden list.',
    body: 'Used where the list is too long to show, such as country or year.',
    example: '[ Select one  v ]',
    good: ['Keeps a long list from filling the page.'],
    watch: [
      'Options are unseen until opened, and the ones near the top are chosen more often.'
    ]
  },
  {
    id: 'slider',
    group: 'control',
    glyph: 'slider',
    title: 'Slider or visual analog',
    asks: 'A position along a line.',
    body:
      'The marker can stand for an ordinal scale or for a finely divided numeric one. The ' +
      'control does not say which.',
    example: 'Not at all  |------------o--------|  Extremely',
    good: ['Fine discrimination without writing an anchor for every point.'],
    watch: [
      'Where the handle starts biases where it ends up.',
      'Harder to operate with a keyboard, on a phone, or with a tremor.'
    ]
  },
  {
    id: 'drag-rank',
    group: 'control',
    glyph: 'drag',
    title: 'Drag-and-drop ranking',
    asks: 'Options dragged into order.',
    body: 'A control for ranking, where the ordering is done by moving the options themselves.',
    example: '[ Option B ]  <-> drag\n[ Option A ]\n[ Option C ]',
    good: ['The response task looks like what it means.'],
    watch: ['Poor keyboard access, and awkward on touch screens with long lists.']
  },
  {
    id: 'arrow-rank',
    group: 'control',
    glyph: 'arrows',
    title: 'Arrow ranking',
    asks: 'Options moved up or down.',
    body: 'The same ordering task with buttons instead of dragging.',
    example: 'Option A   ^ v\nOption B   ^ v',
    good: ['Usable from a keyboard, which dragging often is not.'],
    watch: ['Slower than dragging when the list is long.']
  },
  {
    id: 'structured-fields',
    group: 'control',
    glyph: 'fields',
    title: 'Structured fields',
    asks: 'An answer typed into separate labeled parts.',
    body: 'Separate boxes guide the format, most often for dates.',
    example: 'MM / DD / YYYY',
    good: ['Removes ambiguity about the format the answer should take.'],
    watch: ['Rigid. An answer that does not fit the template cannot be given.']
  },
  {
    id: 'auto-total',
    group: 'control',
    glyph: 'total',
    title: 'Automatic calculation field',
    asks: 'Several numbers, with a running total shown.',
    body: 'Used where entries have to add to a known amount, such as 100 percent.',
    example: 'Activity A ___\nActivity B ___\nActivity C ___\nTotal      ___',
    good: ['The respondent can see the total, so the correction happens before submission.'],
    watch: ['Needs a clear rule for what happens when the total is wrong.']
  },

  // ---- Information type
  {
    id: 'factual',
    group: 'information',
    glyph: 'fact',
    title: 'Factual or demographic',
    asks: 'An attribute, characteristic, condition, or fact.',
    body: 'Something with an answer that exists independently of the respondent\u2019s judgment.',
    example: 'In what year were you born?\n____',
    good: ['Verifiable in principle, and stable across askings.'],
    watch: ['Sensitive facts are answered less accurately than harmless ones.']
  },
  {
    id: 'attitude',
    group: 'information',
    glyph: 'attitude',
    title: 'Attitude or opinion',
    asks: 'A judgment, evaluation, belief, preference, or feeling.',
    body: 'Something that exists as the respondent\u2019s assessment and nowhere else.',
    example: 'How satisfied are you with this service?',
    good: ['The only way to reach what somebody thinks.'],
    watch: [
      'Shaped by the question. Wording, order, and the options offered all move the answer.'
    ]
  },
  {
    id: 'behavior',
    group: 'information',
    glyph: 'behavior',
    title: 'Behavior or event',
    asks: 'Something the respondent did, or something that happened.',
    body:
      'Whether it happened, what happened, how often, how many, when, how long, or how much ' +
      'was involved.',
    example: 'How many times did you use this service during the past month?\n___ times',
    good: ['Easier to report accurately than an attitude.'],
    watch: [
      'Recall decays with the length of the period asked about. Short windows are more ' +
        'accurate and catch less.'
    ]
  }
];

// Worked classifications, which are the point of the whole screen.
//
// The framework's own rule is that an item should not be reduced to one label,
// and no amount of explaining that is as convincing as three examples where the
// same question carries a value on five or six properties at once.
export const WORKED_EXAMPLES = [
  {
    question: 'Have you participated in each of the following during the past year?',
    layout: '            Yes   No\nActivity A   ( )   ( )\nActivity B   ( )   ( )\nActivity C   ( )   ( )',
    properties: [
      ['Primary response format', 'Closed-ended nominal'],
      ['Subtype', 'Multiple-answer forced-choice'],
      ['Questionnaire role', 'Standard substantive item'],
      ['Compound structure', 'Grid'],
      ['Response control', 'Radio buttons'],
      ['Information type', 'Behavior or event']
    ]
  },
  {
    question: 'How satisfied or dissatisfied are you with the service?',
    layout:
      '( ) Very satisfied\n( ) Somewhat satisfied\n( ) Neither\n' +
      '( ) Somewhat dissatisfied\n( ) Very dissatisfied',
    properties: [
      ['Primary response format', 'Closed-ended ordinal'],
      ['Subtype', 'Vague-quantifier scale'],
      ['Scale direction', 'Bipolar'],
      ['Questionnaire role', 'Standard substantive item'],
      ['Compound structure', 'Standalone'],
      ['Response control', 'Radio buttons'],
      ['Information type', 'Attitude or opinion']
    ]
  },
  {
    question: 'During the past 30 days, how many times did you use the service?',
    layout: '___ times',
    properties: [
      ['Primary response format', 'Open-ended'],
      ['Subtype', 'Numerical open-ended, count'],
      ['Questionnaire role', 'Standard substantive item'],
      ['Compound structure', 'Standalone'],
      ['Response control', 'Numeric entry'],
      ['Information type', 'Behavior or event']
    ]
  }
];
