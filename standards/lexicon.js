// Authoritative banned lexicon for this project.
//
// The list is stored as roots and not surface forms because the governing
// rule covers every lexeme variation: tense, plurality, and derivation. A root
// of "align" therefore has to catch aligns, aligned, aligning, alignment, and
// alignments without listing each one by hand.
//
// Each entry is a regular expression fragment applied with word boundaries on
// both sides. Suffix groups are written explicitly, not generated so
// that a reader can see exactly what a given root will and will not match.

const BANNED_ROOTS = [
  'action(?:able|ability)',
  'aim(?:s|ed|ing)?',
  'align(?:s|ed|ing|ment|ments)?',
  'bolster(?:s|ed|ing)?',
  'commendabl[ey]',
  'delve(?:s|d)?|delving',
  'drawn',
  'enabl(?:e|es|ed|ing|ement)',
  'encompass(?:es|ed|ing)?',
  'enhanc(?:e|es|ed|ing|ement|ements)',
  'ensur(?:e|es|ed|ing)',
  'equip(?:s|ped|ping|ment)?',
  'esteem(?:ed)?',
  'facilitat(?:e|es|ed|ing|ion|or|ors)',
  'foster(?:s|ed|ing)?',
  'friendl(?:y|ier|iest|iness)',
  'functionalit(?:y|ies)',
  'grasp(?:s|ed|ing)?',
  'guarantee(?:s|d|ing)?',
  'hone(?:s|d)?|honing',
  'influenc(?:e|es|ed|ing|ial)',
  // Written out, not left as the rename produced it. A project-wide
  // substitution of the old application name rewrote the middle of this root
  // and left a string matching nothing, which quietly took a banned word off
  // the list.
  'instrumental(?:ly)?',
  'intersection(?:s|al)?',
  'intricat(?:e|ely|ies|y)',
  'invaluabl[ey]',
  'journey(?:s|ed|ing)?',
  'landscape(?:s)?',
  'leverag(?:e|es|ed|ing)',
  'maximiz(?:e|es|ed|ing|ation)',
  'meticulous(?:ly|ness)?',
  'multifaceted',
  'nuanc(?:e|es|ed|ing)',
  'passionate(?:ly)?|passion',
  'perspective(?:s)?',
  'pivotal(?:ly)?',
  'plethora',
  'realm(?:s)?',
  'rigor(?:ous|ously)?',
  'robust(?:ly|ness)?',
  'sacrific(?:e|es|ed|ing|ial)',
  'seamless(?:ly)?',
  'showcas(?:e|es|ed|ing)',
  'strengthen(?:s|ed|ing)?',
  'striv(?:e|es|ing)|strove|striven',
  'synerg(?:y|ies|istic)',
  'technique(?:s)?',
  'transformative',
  'translat(?:e|es|ed|ing|ion|ions)',
  'tweak(?:s|ed|ing)?',
  'utiliz(?:e|es|ed|ing|ation)',
  'vital(?:ly)?',
  'wish ?list(?:s)?'
];

// Reserved technical surface that happens to collide with the lexicon.
//
// These are not stylistic choices. They are identifiers defined by CSS, the
// DOM, Electron, or Node, and renaming them would break the program. The
// allowlist is deliberately exact-match and deliberately short: anything added
// here is a claim that the token cannot be spelled any other way. Prose that
// merely sits near one of these tokens is still checked normally.
const TECHNICAL_ALLOWLIST = new Set([
  // CSS box alignment and its React camelCase equivalents
  'align-items', 'align-self', 'align-content', 'text-align', 'vertical-align',
  'alignItems', 'alignSelf', 'alignContent', 'textAlign', 'verticalAlign',
  // Electron BrowserWindow surface
  'maximize', 'unmaximize', 'maximizable', 'isMaximized', 'maximized',
  // Config and DOM flags whose names are fixed by the platform or by Ollama
  'enabled', 'webPreferences',
  // Intl and ARIA surface
  'aria-disabled',
  // Column names in the REDCap data dictionary specification. The header row
  // has to match exactly or the import is rejected, so these are as fixed as
  // any language keyword.
  'Alignment',
  // Electron's own flag and environment variable for renderer logging. Both are
  // spelled by Electron, not by this project.
  '--enable-logging',
  'ELECTRON_ENABLE_LOGGING'
]);

// Proper nouns that happen to contain a banned lexeme.
//
// Separate from the technical allowlist above, because the reason is different.
// Those are identifiers the language or a library defines and that would break
// if renamed. These are the names of things that exist in the world: published
// instruments, organizations, standards. The lexicon governs how this project
// writes, not what published work is called, and silently renaming the
// Rosenberg Self-Esteem Scale to avoid a banned word would be a fabrication in
// service of a style rule.
//
// Kept exact-match and short for the same reason as the technical list. Adding
// an entry is a claim that a real thing carries this name.
const PROPER_NOUNS = new Set([
  'Self-Esteem',
  'self-esteem',
  'Esteem'
]);

// Style rules that travel with the lexicon across every project.
const FORBIDDEN_CHARACTERS = [
  { name: 'em dash', pattern: /\u2014/g },
  { name: 'en dash', pattern: /\u2013/g }
];

// Contractions are matched by apostrophe pattern, not by dictionary so
// that unusual forms are caught too. Both the straight and curly apostrophe
// are included because editors substitute one for the other silently.
//
// The apostrophe-s form is deliberately absent. It is ambiguous between a
// contraction of "is" and an ordinary possessive, and possessives are allowed,
// so including it would produce constant false positives on phrases such as
// "the user's machine".
const CONTRACTION_PATTERN =
  /\b[A-Za-z]+['\u2019](?:t|re|ve|ll|d|m)\b/g;

module.exports = {
  BANNED_ROOTS,
  TECHNICAL_ALLOWLIST,
  PROPER_NOUNS,
  FORBIDDEN_CHARACTERS,
  CONTRACTION_PATTERN
};
