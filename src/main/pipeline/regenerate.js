// Changing the format of a single item after the instrument is built.
//
// Two kinds of change are possible here and they cost very different things,
// so they are separated and not both being sent to the model.
//
// A change WITHIN a family is a relabeling. Moving an agreement item from five
// points to seven does not alter the item at all: the stem still reads as a
// statement a respondent endorses, and only the anchors change. That is a
// lookup, it is instant, and calling a model for it would introduce variation
// into something that has a correct answer.
//
// A change ACROSS families is a rewrite. "I find these courses demanding" is an
// agreement item. As a frequency item it has to become something that happens,
// as an open question it has to become a question, and as a numeric item it has
// to name a countable quantity and a unit. The stem is wrong for the new format
// in every one of those cases, so the item is regenerated.
//
// The distinction is the whole value of this module. Most of what someone wants
// to adjust after seeing a draft is scale length, and none of that should cost
// a model call or produce a different item than the one they were looking at.

const { CATALOG, resolveLabels } = require('./scales/catalog');
const { buildPrompt, SCHEMA } = require('../prompts/regenerate-item');
const { checkItem } = require('./rubric/deterministic');

// Formats that are not anchored scales. These have no catalog entry because
// they carry no shared anchor set, and each one changes what the stem has to be.
const OPEN_FORMATS = {
  'open-text': {
    label: 'Open ended',
    family: 'open',
    asks: 'a question the respondent answers in their own words',
    guidance: 'Write it as a question, not a statement. Open questions should invite a ' +
      'specific kind of answer without suggesting its content.'
  },
  'open-numeric': {
    label: 'Number entry',
    family: 'numeric',
    asks: 'a countable quantity with a stated unit and period',
    guidance: 'Name what is being counted, the unit, and the period. Do not ask for a count the ' +
      'respondent is unlikely to know accurately.'
  },
  'date-entry': {
    label: 'Date',
    family: 'date',
    asks: 'a date or an approximate date',
    guidance: 'Ask for the level of precision the respondent plausibly remembers instead of the ' +
      'level the analysis would prefer.'
  },
  'single-select': {
    label: 'Choose one',
    family: 'nominal',
    asks: 'a question answered by picking one option from a set',
    guidance: 'The options must be mutually exclusive and cover the reasonable range of answers.'
  },
  'multi-select': {
    label: 'Choose any',
    family: 'nominal',
    asks: 'a question answered by picking any number of options',
    guidance: 'State that more than one may be chosen. Consider whether asking about each option ' +
      'separately would produce more considered answers than a single list.'
  }
};

// Everything offerable for one item, in the order someone would look for it.
function availableFormats() {
  const scales = Object.keys(CATALOG).map(function (id) {
    return {
      id,
      label: CATALOG[id].label,
      family: CATALOG[id].family,
      polarity: CATALOG[id].polarity,
      points: CATALOG[id].labels.length,
      // The anchors travel with the format. Without them the interface could
      // name a format on an item and then render the instrument's anchors
      // underneath it, which is what it was doing.
      labels: resolveLabels(CATALOG[id], ''),
      kind: 'scale'
    };
  });
  const open = Object.keys(OPEN_FORMATS).map(function (id) {
    return {
      id,
      label: OPEN_FORMATS[id].label,
      family: OPEN_FORMATS[id].family,
      kind: 'open'
    };
  });
  return scales.concat(open);
}

// Whether moving from one format to another keeps the stem usable.
//
// Same family means the item is asking for the same kind of judgment and only
// the granularity changed. Anything else changes the question.
function isRelabelOnly(fromId, toId) {
  const from = CATALOG[fromId];
  const to = CATALOG[toId];
  if (!from || !to) {
    return false;
  }
  return from.family === to.family && from.polarity === to.polarity;
}

// Apply a format to an item, regenerating the text only when the change
// requires it. Returns the updated item and a record of what was done.
async function applyFormat({ item, fromFormat, toFormat, construct, dimension, backend, options }) {
  const target = CATALOG[toFormat];
  const open = OPEN_FORMATS[toFormat];

  if (!target && !open) {
    throw new Error('Unknown format: ' + toFormat);
  }

  if (target && isRelabelOnly(fromFormat, toFormat)) {
    return {
      item: Object.assign({}, item, { format: toFormat }),
      regenerated: false,
      reason: 'Same response dimension at a different length, so the item itself is unchanged ' +
        'and only the anchors differ.',
      scaleLabels: resolveLabels(target, '')
    };
  }

  const raw = await backend.complete(
    buildPrompt({
      construct,
      dimension,
      item,
      target: target || open,
      targetId: toFormat,
      isScale: Boolean(target)
    }),
    SCHEMA,
    { temperature: 0.4 }
  );

  const text = String(raw.text || '').trim();
  if (text.length === 0) {
    throw new Error('The model returned no replacement item.');
  }

  const rewritten = Object.assign({}, item, {
    text,
    format: toFormat,
    // Keying only means something on a scale. An open question has no direction
    // to reverse, so the field is cleared, not carried across where it
    // would be meaningless.
    direction: target ? item.direction : null,
    responseOptions: Array.isArray(raw.response_options) ? raw.response_options : null
  });

  // The measured half of the rubric still applies to a rewritten item. Someone
  // changing a format should not quietly lose the checks the original passed.
  const flags = target ? checkItem(rewritten, options) : [];

  return {
    item: rewritten,
    regenerated: true,
    reason: 'The response dimension changed, so the item was rewritten to ask for the new kind ' +
      'of answer, not being relabeled.',
    flags,
    scaleLabels: target ? resolveLabels(target, '') : null
  };
}

module.exports = { availableFormats, isRelabelOnly, applyFormat, OPEN_FORMATS };
