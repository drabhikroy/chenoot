// A reference list of widely used published instruments.
//
// What this solves and what it does not.
//
// Step 3 can recall published scales, and a local model recalling citations
// invents them at a rate that makes the output unusable as a citation. Offline
// there is no way to check a name against the literature, so the application
// has had exactly one honest option available: mark everything recalled as
// unverified and let the reader decide.
//
// This list adds a second option that is still honest. It holds instruments
// that are well enough established that their name, first author, and year can
// be stated with confidence, and a recalled scale is checked against it. Three
// outcomes follow, and the third is the one that earns the list.
//
// MATCHED means the recalled name corresponds to an entry and the attribution
// agrees. That is not proof the model recalled it correctly in every detail,
// but the name and the source are right.
//
// UNMATCHED means the name is not in this list. That says nothing about whether
// the scale exists. The list is a few dozen instruments against a literature of
// many thousands, and an unmatched name is exactly as unverified as it was
// before.
//
// CONTRADICTED means the name matches an entry and the attribution does not.
// This is the useful case: a model producing the right instrument with the
// wrong author or a year that is out by a decade is the most common way a
// fabricated citation looks, and it is the hardest to catch by reading.
//
// The list is deliberately conservative. An entry earns its place by being
// citable from memory without hedging, and anything requiring a check is
// omitted and not guessed at, because a reference list with errors in it is
// worse than no reference list.

const INSTRUMENTS = [
  // Wellbeing, affect, and mental health
  { name: 'Maslach Burnout Inventory', abbreviations: ['MBI'], author: 'Maslach', year: 1981, domain: 'burnout' },
  { name: 'Oldenburg Burnout Inventory', abbreviations: ['OLBI'], author: 'Demerouti', year: 2001, domain: 'burnout' },
  { name: 'Perceived Stress Scale', abbreviations: ['PSS'], author: 'Cohen', year: 1983, domain: 'stress' },
  { name: 'Patient Health Questionnaire', abbreviations: ['PHQ-9', 'PHQ9'], author: 'Kroenke', year: 2001, domain: 'depression' },
  { name: 'Generalized Anxiety Disorder scale', abbreviations: ['GAD-7', 'GAD7'], author: 'Spitzer', year: 2006, domain: 'anxiety' },
  { name: 'Beck Depression Inventory', abbreviations: ['BDI'], author: 'Beck', year: 1961, domain: 'depression' },
  { name: 'Center for Epidemiologic Studies Depression Scale', abbreviations: ['CES-D', 'CESD'], author: 'Radloff', year: 1977, domain: 'depression' },
  { name: 'Edinburgh Postnatal Depression Scale', abbreviations: ['EPDS'], author: 'Cox', year: 1987, domain: 'depression' },
  { name: 'State-Trait Anxiety Inventory', abbreviations: ['STAI'], author: 'Spielberger', year: 1983, domain: 'anxiety' },
  { name: 'Positive and Negative Affect Schedule', abbreviations: ['PANAS'], author: 'Watson', year: 1988, domain: 'affect' },
  { name: 'Satisfaction With Life Scale', abbreviations: ['SWLS'], author: 'Diener', year: 1985, domain: 'wellbeing' },
  { name: 'Connor-Davidson Resilience Scale', abbreviations: ['CD-RISC'], author: 'Connor', year: 2003, domain: 'resilience' },
  { name: 'Pittsburgh Sleep Quality Index', abbreviations: ['PSQI'], author: 'Buysse', year: 1989, domain: 'sleep' },
  { name: 'Alcohol Use Disorders Identification Test', abbreviations: ['AUDIT'], author: 'Saunders', year: 1993, domain: 'substance use' },

  // Self and personality
  { name: 'Rosenberg Self-Esteem Scale', abbreviations: ['RSES'], author: 'Rosenberg', year: 1965, domain: 'self-esteem' },
  { name: 'Big Five Inventory', abbreviations: ['BFI'], author: 'John', year: 1999, domain: 'personality' },
  { name: 'NEO Personality Inventory Revised', abbreviations: ['NEO-PI-R'], author: 'Costa', year: 1992, domain: 'personality' },
  { name: 'General Self-Efficacy Scale', abbreviations: ['GSE'], author: 'Schwarzer', year: 1995, domain: 'self-efficacy' },

  // Work and organizations
  { name: 'Utrecht Work Engagement Scale', abbreviations: ['UWES'], author: 'Schaufeli', year: 2002, domain: 'work engagement' },
  { name: 'Job Descriptive Index', abbreviations: ['JDI'], author: 'Smith', year: 1969, domain: 'job satisfaction' },
  { name: 'Minnesota Satisfaction Questionnaire', abbreviations: ['MSQ'], author: 'Weiss', year: 1967, domain: 'job satisfaction' },
  { name: 'Organizational Commitment Questionnaire', abbreviations: ['OCQ'], author: 'Mowday', year: 1979, domain: 'commitment' },
  { name: 'Job Content Questionnaire', abbreviations: ['JCQ'], author: 'Karasek', year: 1985, domain: 'job demands' },
  { name: 'Copenhagen Psychosocial Questionnaire', abbreviations: ['COPSOQ'], author: 'Kristensen', year: 2005, domain: 'psychosocial work environment' },

  // Education
  { name: 'Motivated Strategies for Learning Questionnaire', abbreviations: ['MSLQ'], author: 'Pintrich', year: 1991, domain: 'learning strategies' },
  { name: 'Intrinsic Motivation Inventory', abbreviations: ['IMI'], author: 'Ryan', year: 1982, domain: 'motivation' },
  { name: 'Classroom Community Scale', abbreviations: ['CCS'], author: 'Rovai', year: 2002, domain: 'classroom community' },
  { name: 'Teachers Sense of Efficacy Scale', abbreviations: ['TSES'], author: 'Tschannen-Moran', year: 2001, domain: 'teacher efficacy' },

  // Health and quality of life
  { name: 'Short Form Health Survey', abbreviations: ['SF-36', 'SF36'], author: 'Ware', year: 1992, domain: 'health status' },
  { name: 'World Health Organization Quality of Life BREF', abbreviations: ['WHOQOL-BREF'], author: 'WHOQOL Group', year: 1998, domain: 'quality of life' },
  { name: 'Multidimensional Scale of Perceived Social Support', abbreviations: ['MSPSS'], author: 'Zimet', year: 1988, domain: 'social support' },

  // Technology and usability
  { name: 'System Usability Scale', abbreviations: ['SUS'], author: 'Brooke', year: 1996, domain: 'usability' },
  { name: 'NASA Task Load Index', abbreviations: ['NASA-TLX', 'TLX'], author: 'Hart', year: 1988, domain: 'workload' },
  { name: 'Technology Acceptance Model scales', abbreviations: ['TAM'], author: 'Davis', year: 1989, domain: 'technology acceptance' },
  { name: 'Unified Theory of Acceptance and Use of Technology', abbreviations: ['UTAUT'], author: 'Venkatesh', year: 2003, domain: 'technology acceptance' }
];

const MATCHED = 'matched';
const UNMATCHED = 'unmatched';
const CONTRADICTED = 'contradicted';

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token overlap, not exact equality, because a recalled name arrives
// with an article, an edition, or a trailing "scale" as often as not. Requiring
// exact strings would report every real match as unmatched.
function overlap(a, b) {
  const left = new Set(normalize(a).split(' ').filter(function (t) { return t.length > 2; }));
  const right = normalize(b).split(' ').filter(function (t) { return t.length > 2; });
  if (left.size === 0 || right.length === 0) {
    return 0;
  }
  const shared = right.filter(function (token) { return left.has(token); }).length;
  return shared / Math.max(left.size, right.length);
}

const NAME_THRESHOLD = 0.6;

function findEntry(recalledName) {
  const normalized = normalize(recalledName);
  if (normalized.length === 0) {
    return null;
  }

  // An abbreviation is an exact signal and is checked first, since "PHQ-9"
  // shares no meaningful tokens with its full name.
  const byAbbreviation = INSTRUMENTS.find(function (entry) {
    return entry.abbreviations.some(function (abbreviation) {
      return normalize(abbreviation) === normalized ||
        normalized.split(' ').includes(normalize(abbreviation));
    });
  });
  if (byAbbreviation) {
    return byAbbreviation;
  }

  let best = null;
  let bestScore = 0;
  INSTRUMENTS.forEach(function (entry) {
    const score = overlap(entry.name, recalledName);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });
  return bestScore >= NAME_THRESHOLD ? best : null;
}

// Check one recalled scale. The source string is whatever the model produced,
// so the author and year are pulled out of it and not assumed to be
// structured.
function verify(recalled) {
  const entry = findEntry(recalled.name);
  if (!entry) {
    return {
      status: UNMATCHED,
      detail: 'Not found in the bundled reference list. That list holds a few dozen instruments ' +
        'against a literature of many thousands, so this says nothing about whether the scale ' +
        'exists. Treat it as unverified.'
    };
  }

  const source = String(recalled.source || '');
  const yearMatch = source.match(/\b(1[89]\d{2}|20\d{2})\b/);
  const statedYear = yearMatch ? Number(yearMatch[1]) : null;
  const authorPresent = normalize(source).includes(normalize(entry.author).split(' ')[0]);

  const problems = [];
  // A year is allowed to differ by a little, since revisions and second
  // editions are legitimately cited by their own dates.
  if (statedYear !== null && Math.abs(statedYear - entry.year) > 3) {
    problems.push('the year given is ' + statedYear + ' and the original is ' + entry.year);
  }
  if (source.length > 0 && !authorPresent) {
    problems.push('the attribution does not name ' + entry.author);
  }

  if (problems.length > 0) {
    return {
      status: CONTRADICTED,
      entry,
      detail: 'The name matches ' + entry.name + ' (' + entry.author + ', ' + entry.year +
        '), but ' + problems.join(', and ') + '. A correct instrument with a wrong attribution ' +
        'is the most common shape of a fabricated citation.'
    };
  }

  return {
    status: MATCHED,
    entry,
    detail: 'Matches ' + entry.name + ' (' + entry.author + ', ' + entry.year +
      ') in the bundled reference list. The name and source are right; this is not a check of ' +
      'anything else the model said about it.'
  };
}

module.exports = { INSTRUMENTS, verify, findEntry, MATCHED, UNMATCHED, CONTRADICTED };
