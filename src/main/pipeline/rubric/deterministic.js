// The checkable portion of the Step 5 rubric.
//
// The build specification hands the whole rubric to the model. Three of its five
// criteria do not need a model at all: whether an item joins two predicates,
// what reading level it sits at, and whether reverse keying is balanced within a
// dimension are all decidable from the text. Computing them here makes the flags
// reproducible across runs, removes the largest source of false negatives from a
// model reviewing its own writing, and produces an audit trail entry that states
// a measured value instead of an opinion.
//
// What is left for the model is the part that actually requires judgment:
// whether an item leads the respondent, and whether it invites a socially
// desirable answer. Those two live in the model prompt.
//
// Every function returns flags, not a verdict. Step 5 decides what a
// flag costs, and Step 6 decides what to do about it.

// Syllable counting and the readability formulas live in readability.js, which
// holds eight measures and knows which can be applied to a single item. Keeping
// a second copy here is how the two would eventually disagree about the same
// sentence.
const readability = require('./readability');

// Coordinating conjunctions that most often join two separate propositions in a
// survey item. "and" and "or" carry nearly all real cases; the rest appear in
// items written by people trying to avoid the first two.
const CONJUNCTIONS = [
  ' and ', ' or ', ' as well as ', ' along with ', ' plus ', '/'
];

// Conjunctions inside these phrases join parts of one idea, not two
// propositions, so they should not raise a flag. The list is short on purpose:
// a longer one would start excusing genuine double-barreled items.
const BOUND_PHRASES = [
  'more and more', 'now and then', 'over and over', 'back and forth',
  'again and again', 'time and effort', 'friends and family',
  'terms and conditions', 'trial and error'
];

// Absolutes push respondents toward the endpoints of a scale for reasons that
// have nothing to do with the construct, since almost any statement containing
// "never" is literally false.
const ABSOLUTES = [
  'always', 'never', 'all of', 'none of', 'every time', 'everyone',
  'nobody', 'entirely', 'completely', 'totally', 'constantly'
];

// Negation interacts badly with reverse keying. A reverse-keyed item that also
// contains a negation asks the respondent to hold two inversions at once.
const NEGATIONS = [
  'not', 'never', 'no', 'cannot', 'without', 'rarely', 'neither', 'nor',
  'none', 'nothing', 'nobody', 'nowhere'
];

// Generated items use contractions even though this project does not, and a
// contracted "do not" is the most common way a reverse item gets negated. Any
// word ending in n, an apostrophe, and t is a negation whatever verb it is
// attached to. Straight and curly apostrophes are both accepted.
const CONTRACTED_NEGATION = /n['\u2019]t$/;

// Flesch published Reading Ease with a table placing score bands at school
// grades (Flesch, 1949, The Art of Readable Writing). The target in settings is
// a grade, and Reading Ease runs the other way on a different scale, so the
// grade is converted through that table and never compared to the score
// directly. Each row is the highest grade the band covers and the lowest score
// that still counts as that band.
const EASE_FLOOR_BY_GRADE = [
  { grade: 5, floor: 90 },
  { grade: 6, floor: 80 },
  { grade: 7, floor: 70 },
  { grade: 9, floor: 60 },
  { grade: 12, floor: 50 },
  { grade: 16, floor: 30 }
];

function easeFloorForGrade(grade) {
  const row = EASE_FLOOR_BY_GRADE.find(function (r) { return grade <= r.grade; });
  return row ? row.floor : 0;
}

// Defaults. General population instruments are usually written at or below
// eighth grade; a clinical or workplace instrument may sit higher.
const DEFAULTS = {
  readabilityMeasure: readability.DEFAULT_MEASURE,
  maximumGrade: 8,
  maximumWords: 20,
  // Roughly a quarter to a third reverse keyed is the common recommendation.
  // Below the floor the dimension is exposed to acquiescence bias; above the
  // ceiling the reverse items start driving a method factor of their own.
  reverseFloor: 0.2,
  reverseCeiling: 0.5,
  // A dimension needs at least three items before reverse-keying balance is a
  // meaningful thing to measure.
  minimumForBalance: 3
};

function countSyllables(word) {
  return readability.syllables(word);
}

function tokenize(text) {
  return text.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
}

// The item as a run of bare lowercase words with single spaces and a space at
// each end. Punctuation touching a word would otherwise hide it, so "never,"
// and "never." read as "never" the way a respondent reads them. Apostrophes are
// kept, and curly ones straightened, so that contractions survive intact.
function wordRun(text) {
  const words = String(text).toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(function (w) { return w.length > 0; });
  return { words, padded: ' ' + words.join(' ') + ' ' };
}

// Reading grade for one item, using whichever measure has been chosen. Only
// measures valid at item length are offered in settings, so this cannot be
// handed a formula that needs a thirty sentence sample.
//
// A survey item is treated as a single sentence, which is what it should be; an
// item containing a sentence break is a different problem and is caught by the
// double-barreled check.
function readingGrade(text, measureId) {
  const id = measureId || readability.DEFAULT_MEASURE;
  const value = readability.score(text, id);
  if (value !== null) {
    return value;
  }
  // No text means nothing to flag, so the neutral value is whichever end of
  // the scale can never trip the check. That is zero for a grade and the top of
  // the scale for Reading Ease, where zero would be the hardest possible text.
  const measure = readability.MEASURES[id];
  return measure && measure.higherIsEasier ? 100 : 0;
}

function flag(code, message, evidence) {
  return { code, message, evidence, source: 'deterministic' };
}

// Item-level checks. Returns an array of flags, empty when the item is clean.
function checkItem(item, options) {
  const config = Object.assign({}, DEFAULTS, options || {});
  const text = item.text || '';
  const lower = ' ' + text.toLowerCase() + ' ';
  const flags = [];

  // Double-barreled. A conjunction only counts when both sides carry enough
  // words to be a proposition, which keeps compound nouns from raising flags.
  let masked = lower;
  BOUND_PHRASES.forEach(function (phrase) {
    masked = masked.split(phrase).join(' ');
  });
  // Every occurrence is tested, not only the first. In "Pros and cons of my
  // job make me want to stay and grow here" the first "and" is inside a phrase
  // and the second is the one joining two propositions.
  CONJUNCTIONS.forEach(function (conjunction) {
    let position = masked.indexOf(conjunction);
    while (position !== -1) {
      const before = tokenize(masked.slice(0, position));
      const after = tokenize(masked.slice(position + conjunction.length));
      if (before.length >= 3 && after.length >= 3) {
        flags.push(flag(
          'double_barreled',
          'Joins two propositions, so a respondent who agrees with one and not the other has no correct answer.',
          conjunction.trim()
        ));
        return;
      }
      position = masked.indexOf(conjunction, position + conjunction.length);
    }
  });

  // Sentence breaks inside a single item.
  if ((text.match(/[.!?]/g) || []).length > 1) {
    flags.push(flag(
      'multiple_sentences',
      'Contains more than one sentence, which usually means more than one question.',
      text
    ));
  }

  // Reading level.
  const measureId = config.readabilityMeasure || readability.DEFAULT_MEASURE;
  const measure = readability.MEASURES[measureId] || readability.MEASURES[readability.DEFAULT_MEASURE];
  const grade = readingGrade(text, measureId);
  // Compared at the precision it is reported at. Comparing 8.04 against 8 and
  // then printing "grade 8.0, above the target of 8" is a message that reads as
  // a fault in the application instead of a finding about the item.
  const reported = Math.round(grade * 10) / 10;
  if (measure.higherIsEasier) {
    const floor = easeFloorForGrade(config.maximumGrade);
    if (reported < floor) {
      flags.push(flag(
        'reading_level',
        'Reading ease of ' + reported.toFixed(1) + ' by ' + measure.label + ', below the ' +
          floor + ' that Flesch places at grade ' + config.maximumGrade + '.',
        grade.toFixed(1)
      ));
    }
  } else if (reported > config.maximumGrade) {
    flags.push(flag(
      'reading_level',
      // The measure is named in the finding. Two measures disagree by a grade
      // or more on the same sentence, so a bare number is not checkable.
      'Reads at grade ' + reported.toFixed(1) + ' by ' + measure.label +
        ', above the target of ' + config.maximumGrade + '.',
      grade.toFixed(1)
    ));
  }

  // Length. Long items increase working memory load before the respondent even
  // reaches the scale.
  const words = tokenize(text);
  if (words.length > config.maximumWords) {
    flags.push(flag(
      'item_length',
      words.length + ' words, above the target of ' + config.maximumWords + '.',
      String(words.length)
    ));
  }

  // Absolutes.
  const run = wordRun(text);
  ABSOLUTES.forEach(function (term) {
    if (run.padded.indexOf(' ' + term + ' ') !== -1) {
      flags.push(flag(
        'absolute_term',
        'Uses an absolute, which pushes responses toward a scale endpoint for reasons unrelated to the construct.',
        term
      ));
    }
  });

  // Negation combined with reverse keying.
  if (item.direction === 'reverse') {
    const found = NEGATIONS.filter(function (term) {
      return run.padded.indexOf(' ' + term + ' ') !== -1;
    }).concat(run.words.filter(function (w) { return CONTRACTED_NEGATION.test(w); }));
    if (found.length > 0) {
      flags.push(flag(
        'negated_reverse_item',
        'Reverse keyed and negated, so agreeing requires resolving two inversions at once.',
        found.join(', ')
      ));
    }
  }

  return flags;
}

// Dimension-level check. Reverse keying balance cannot be judged one item at a
// time, so it is measured across the pool and reported against the dimension,
// not against any single item.
function checkDimensionBalance(items, options) {
  const config = Object.assign({}, DEFAULTS, options || {});
  const byDimension = new Map();

  items.forEach(function (item) {
    if (!byDimension.has(item.dimension)) {
      byDimension.set(item.dimension, []);
    }
    byDimension.get(item.dimension).push(item);
  });

  const findings = [];
  byDimension.forEach(function (group, dimension) {
    if (group.length < config.minimumForBalance) {
      return;
    }
    const reversed = group.filter(function (i) { return i.direction === 'reverse'; }).length;
    const proportion = reversed / group.length;

    if (proportion < config.reverseFloor) {
      findings.push({
        dimension,
        code: 'reverse_keying_low',
        proportion,
        message: dimension + ' is ' + (proportion * 100).toFixed(0) +
          ' percent reverse keyed, below the ' + (config.reverseFloor * 100) +
          ' percent floor, leaving it open to acquiescence bias.'
      });
    }
    if (proportion > config.reverseCeiling) {
      findings.push({
        dimension,
        code: 'reverse_keying_high',
        proportion,
        message: dimension + ' is ' + (proportion * 100).toFixed(0) +
          ' percent reverse keyed, above the ' + (config.reverseCeiling * 100) +
          ' percent ceiling, which risks a method factor of its own.'
      });
    }
  });
  return findings;
}

module.exports = {
  checkItem,
  checkDimensionBalance,
  readingGrade,
  countSyllables,
  easeFloorForGrade,
  DEFAULTS
};
