// Readability measures.
//
// Eight formulas, and one caveat that governs how all of them are used here.
//
// Every classical readability formula was derived against continuous prose,
// usually samples of a hundred words or more, and several specify a minimum
// sample explicitly. A survey item is one sentence of roughly ten to fifteen
// words. Applying a formula outside the sample size it was validated on does
// not produce a rough answer; it produces a number with no standing, and one
// that looks exactly as authoritative as a real one.
//
// SMOG is the clearest case. It counts polysyllables across a thirty sentence
// block and its coefficients assume that block. Run against a single item it
// returns a grade level derived from a sample it was never meant to see. The
// same objection applies with less force to Gunning Fog, which uses a
// percentage that becomes unstable on short text.
//
// So each measure declares the sample it needs, and the two places measures are
// used differ accordingly. Per item, only measures that behave at sentence
// length are offered. Across the finished instrument, where the whole item pool
// is a reasonable prose sample, all of them apply.
//
// Dale-Chall and Spache are absent, not approximated. Both compare
// against a fixed list of familiar words, three thousand in Dale-Chall's case,
// and a formula run against a truncated list is a different formula wearing the
// same name.

const VOWEL_GROUPS = /[aeiouy]{1,2}/g;

// Vowel group counting with a correction for silent terminal e. Wrong on
// perhaps five percent of English words, which is why it underpins threshold
// checks and not published figures.
function syllables(word) {
  const cleaned = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) {
    return 0;
  }
  if (cleaned.length <= 3) {
    return 1;
  }
  const groups = cleaned.replace(/(?:es|ed|e)$/, '').match(VOWEL_GROUPS);
  return groups === null ? 1 : groups.length;
}

function words(text) {
  return String(text).trim().split(/\s+/).filter(function (w) { return w.length > 0; });
}

function sentences(text) {
  const marks = String(text).match(/[.!?]+/g);
  return Math.max(1, marks ? marks.length : 1);
}

function letters(text) {
  const found = String(text).match(/[A-Za-z]/g);
  return found ? found.length : 0;
}

function counts(text) {
  const w = words(text);
  const s = sentences(text);
  const syllableTotal = w.reduce(function (total, word) { return total + syllables(word); }, 0);
  const polysyllables = w.filter(function (word) { return syllables(word) >= 3; }).length;
  const monosyllables = w.filter(function (word) { return syllables(word) === 1; }).length;
  return {
    words: w.length,
    sentences: s,
    syllables: syllableTotal,
    polysyllables,
    monosyllables,
    letters: letters(text)
  };
}

// Each measure states what it produces, the sample it was derived against, and
// whether it can be trusted on a single item. The prose is written for the
// settings screen, where someone is choosing between them.
const MEASURES = {
  'flesch-kincaid': {
    label: 'Flesch-Kincaid Grade Level',
    unit: 'grade',
    validAtItemLength: true,
    minimumSentences: 1,
    summary: 'Average sentence length and average syllables per word, expressed as a United ' +
      'States school grade. The most widely reported measure and the safest default, because ' +
      'more people can interpret the number than any other on this list.',
    caution: 'Rewards short sentences and short words without regard to whether the words are ' +
      'familiar. A sentence of brief technical terms scores well and reads badly.',
    compute: function (c) {
      return 0.39 * (c.words / c.sentences) + 11.8 * (c.syllables / c.words) - 15.59;
    }
  },
  'flesch-reading-ease': {
    label: 'Flesch Reading Ease',
    unit: 'score',
    validAtItemLength: true,
    minimumSentences: 1,
    higherIsEasier: true,
    summary: 'The same inputs as Flesch-Kincaid on a 0 to 100 scale where higher is easier. ' +
      'Around 60 to 70 is plain English suitable for a general population survey.',
    caution: 'Inherits every weakness of Flesch-Kincaid, and the scale has no natural ceiling ' +
      'or floor, so very short items can score above 100.',
    compute: function (c) {
      return 206.835 - 1.015 * (c.words / c.sentences) - 84.6 * (c.syllables / c.words);
    }
  },
  'automated-readability': {
    label: 'Automated Readability Index',
    unit: 'grade',
    validAtItemLength: true,
    minimumSentences: 1,
    summary: 'Characters per word and words per sentence, with no syllable counting at all. ' +
      'Because it never guesses at syllables it is the most reproducible measure here, and it ' +
      'is the one to prefer when a figure has to be defended.',
    caution: 'Character count is a coarse proxy for difficulty. Short but unfamiliar words are ' +
      'scored as easy.',
    compute: function (c) {
      return 4.71 * (c.letters / c.words) + 0.5 * (c.words / c.sentences) - 21.43;
    }
  },
  'coleman-liau': {
    label: 'Coleman-Liau Index',
    unit: 'grade',
    validAtItemLength: true,
    minimumSentences: 1,
    summary: 'Letters and sentences per hundred words, designed originally for text read by ' +
      'machine. Like the Automated Readability Index it avoids syllables, and the two usually ' +
      'agree closely.',
    caution: 'Derived against samples of a hundred words. On a single item the per-hundred ' +
      'scaling is an extrapolation and not a measurement.',
    compute: function (c) {
      const lettersPer100 = (c.letters / c.words) * 100;
      const sentencesPer100 = (c.sentences / c.words) * 100;
      return 0.0588 * lettersPer100 - 0.296 * sentencesPer100 - 15.8;
    }
  },
  'forcast': {
    label: 'FORCAST',
    unit: 'grade',
    validAtItemLength: true,
    minimumSentences: 1,
    summary: 'Single-syllable word density, ignoring sentence length entirely. It was built for ' +
      'material that is not continuous prose, which makes it unusually well suited to survey ' +
      'items, forms, and checklists.',
    caution: 'Because it ignores sentence structure, a long and tangled item scores the same as ' +
      'a short clear one built from the same vocabulary.',
    compute: function (c) {
      // The published formula uses a 150 word sample; the density is scaled to
      // that basis so shorter text is comparable, not penalized.
      const perSample = (c.monosyllables / c.words) * 150;
      return 20 - (perSample / 10);
    }
  },
  'gunning-fog': {
    label: 'Gunning Fog Index',
    unit: 'grade',
    validAtItemLength: false,
    minimumSentences: 5,
    summary: 'Sentence length plus the percentage of words with three or more syllables, read ' +
      'as years of formal education. Widely used in plain language work.',
    caution: 'The polysyllable percentage is unstable on short text: one long word in a ten ' +
      'word item moves the score by several grades. Meaningful across the instrument, not per ' +
      'item.',
    compute: function (c) {
      return 0.4 * ((c.words / c.sentences) + 100 * (c.polysyllables / c.words));
    }
  },
  'smog': {
    label: 'SMOG',
    unit: 'grade',
    validAtItemLength: false,
    minimumSentences: 30,
    summary: 'Polysyllable count across a thirty sentence sample. The standard in health ' +
      'communication, where it is often required, and the strictest measure on this list.',
    caution: 'Its coefficients assume a thirty sentence block. Applied to fewer it returns a ' +
      'number with no standing, so it is offered only across a finished instrument of at least ' +
      'thirty items.',
    compute: function (c) {
      return 1.043 * Math.sqrt(c.polysyllables * (30 / c.sentences)) + 3.1291;
    }
  },
  'linsear-write': {
    label: 'Linsear Write',
    unit: 'grade',
    validAtItemLength: false,
    minimumSentences: 5,
    summary: 'Weighs easy words against words of three or more syllables over a sample. ' +
      'Developed for United States military technical manuals, so it suits instrument text ' +
      'that has to be followed, not enjoyed.',
    caution: 'Built on a hundred word sample and coarse at anything shorter.',
    compute: function (c) {
      const easy = c.words - c.polysyllables;
      const raw = ((easy * 1) + (c.polysyllables * 3)) / c.sentences;
      return raw > 20 ? raw / 2 : (raw / 2) - 1;
    }
  }
};

const DEFAULT_MEASURE = 'flesch-kincaid';

// Measures that can be applied to one item without misusing them.
function itemLevelMeasures() {
  return Object.keys(MEASURES).filter(function (id) { return MEASURES[id].validAtItemLength; });
}

// Score one text with one measure. Returns null, not a number, when the
// sample is below what the measure requires, so a caller cannot accidentally
// report a figure the formula does not support.
function score(text, measureId) {
  const measure = MEASURES[measureId] || MEASURES[DEFAULT_MEASURE];
  const c = counts(text);
  if (c.words === 0) {
    return null;
  }
  if (c.sentences < measure.minimumSentences) {
    return null;
  }
  return measure.compute(c);
}

// Score a whole instrument by joining its items into one sample. Every measure
// applies here, subject to its own minimum, because the pool is a reasonable
// body of prose in a way that one item is not.
function scoreInstrument(texts, measureId) {
  const joined = texts
    .map(function (t) { return String(t).trim().replace(/[.!?]*$/, '') + '.'; })
    .join(' ');
  const measure = MEASURES[measureId] || MEASURES[DEFAULT_MEASURE];
  const c = counts(joined);
  if (c.words === 0 || c.sentences < measure.minimumSentences) {
    return { value: null, belowMinimum: true, sentences: c.sentences, measure: measure.label };
  }
  return {
    value: measure.compute(c),
    belowMinimum: false,
    sentences: c.sentences,
    measure: measure.label
  };
}

module.exports = {
  MEASURES,
  DEFAULT_MEASURE,
  itemLevelMeasures,
  score,
  scoreInstrument,
  counts,
  syllables
};
