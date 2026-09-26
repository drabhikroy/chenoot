// American English spelling.
//
// The house standard is American spelling everywhere a person can read it,
// which includes identifiers, because a field named in British spelling ends up
// in exported files and saved runs where a reader meets it as text.
//
// Two kinds of rule. The first is a list of whole words whose British form
// cannot be predicted from an ending, such as centre, grey, and catalogue. The
// second covers the productive endings, where a British writer adds ise or
// doubles a final l. Those are matched only against stems listed here and never
// against the ending alone, because an ending alone would condemn precise,
// promise, exercise, and every correctly spelled word that happens to end the
// same way.
//
// This file has to name every British form in order to ban it, so the gate
// excludes it from its own check, the same way the lexicon file is excluded.

const WHOLE_WORDS = {
  centre: 'center', centres: 'centers', centred: 'centered', centring: 'centering',
  metre: 'meter', metres: 'meters', litre: 'liter', litres: 'liters',
  fibre: 'fiber', theatre: 'theater', calibre: 'caliber', spectre: 'specter',
  grey: 'gray', greys: 'grays', catalogue: 'catalog', catalogues: 'catalogs',
  dialogue: 'dialog', dialogues: 'dialogs', analogue: 'analog',
  defence: 'defense', offence: 'offense', licence: 'license', pretence: 'pretense',
  programme: 'program', programmes: 'programs', judgement: 'judgment',
  ageing: 'aging', sceptical: 'skeptical', sceptic: 'skeptic',
  whilst: 'while', amongst: 'among', enrol: 'enroll', enrolment: 'enrollment',
  fulfil: 'fulfill', fulfilment: 'fulfillment', instalment: 'installment',
  practise: 'practice', practised: 'practiced', practising: 'practicing',
  aluminium: 'aluminum', manoeuvre: 'maneuver', jewellery: 'jewelry',
  plough: 'plow', tyre: 'tire', tyres: 'tires', cheque: 'check', mould: 'mold',
  speciality: 'specialty', draught: 'draft', kerb: 'curb', pyjamas: 'pajamas',
  counsellor: 'counselor', counselling: 'counseling', paediatric: 'pediatric',
  encyclopaedia: 'encyclopedia', anaemia: 'anemia', oestrogen: 'estrogen'
};

// Words in our and their derived forms. Listed by stem because the ending
// alone matches four, hour, your, and pour.
const OUR_STEMS = [
  'col', 'behavi', 'fav', 'hon', 'lab', 'neighb', 'hum', 'flav', 'harb',
  'rum', 'vig', 'endeav', 'od', 'arb', 'arm', 'clam', 'parl', 'sav', 'splend',
  'tum', 'val', 'vap', 'rig'
];
const OUR_PATTERN = new RegExp(
  '^(' + OUR_STEMS.join('|') + ')our(s|ed|ing|ful|fully|less|able|ably|ite|ites|al|ally|hood|ly)?$'
);

// Words that take ize in American spelling. The British ise, isation, and the
// rest are caught on these stems only.
const IZE_STEMS = [
  'organ', 'recogn', 'real', 'util', 'optim', 'normal', 'standard', 'special',
  'character', 'categor', 'prior', 'summar', 'visual', 'minim', 'maxim',
  'author', 'emphas', 'apolog', 'final', 'initial', 'custom', 'serial',
  'random', 'synchron', 'capital', 'critic', 'general', 'harmon', 'ideal',
  'internal', 'legal', 'local', 'memor', 'modern', 'neutral', 'penal', 'polar',
  'popular', 'public', 'rational', 'stabil', 'steril', 'symbol', 'theor',
  'civil', 'colon', 'crystal', 'sanit', 'familiar', 'industrial', 'personal',
  'italic', 'token', 'parameter', 'parametr', 'vector', 'regular', 'digit',
  'hospital', 'mobil', 'legitim', 'marginal', 'contextual', 'conceptual',
  'operational', 'individual', 'global', 'commercial', 'trivial', 'verbal',
  'fertil', 'anonym', 'normal', 'central', 'equal', 'formal', 'material',
  'natural', 'rational', 'initial', 'serial', 'modular', 'vocal', 'dramat',
  'econom', 'emphas', 'jeopard', 'patron', 'scrutin', 'agon', 'sympath',
  'summar', 'terror', 'vandal', 'victim', 'weather', 'prior', 'polar',
  'motor', 'miniatur', 'magnet', 'lexical', 'hypothes', 'homogen', 'fossil',
  'extern', 'energ', 'dehuman', 'demobil', 'decentral', 'criminal', 'canon',
  'caramel', 'bowdler', 'alphabet', 'american', 'western', 'visual'
];
const IZE_PATTERN = new RegExp(
  '^(?:re|de|un|over|under|non)?(' + IZE_STEMS.join('|') +
  ')is(e|es|ed|ing|er|ers|ation|ations|able)$'
);

// Verbs ending in a single l that British spelling doubles before ed, ing,
// er, and or, and American spelling does not.
const L_STEMS = [
  'cancel', 'model', 'label', 'travel', 'level', 'signal', 'total', 'fuel',
  'channel', 'barrel', 'dial', 'marshal', 'tunnel', 'counsel', 'label',
  'jewel', 'marvel', 'quarrel', 'shovel', 'snorkel', 'swivel', 'tassel',
  'unravel', 'equal', 'duel', 'grovel', 'libel', 'panel', 'pedal', 'rival',
  'model', 'refuel', 'relabel', 'remodel', 'bevel', 'chisel', 'enamel',
  'funnel', 'gravel', 'kernel', 'yodel', 'spiral'
];
const DOUBLE_L_PATTERN = new RegExp(
  '^(?:re|un|mis)?(' + L_STEMS.join('|') + ')l(ed|ing|er|ers|or|ors)$'
);

// Words that may appear in British spelling for a stated reason. Each entry
// carries its reason here, not at the use, so the list stays reviewable.
const SPELLING_ALLOWLIST = new Set([
  // Saved runs written before the field was renamed carry this key, and the
  // results screen reads it so those runs still display correctly.
  'fullyLabelled'
]);

// A camel case identifier is read as the words it is made of, so that
// setCancelling is judged as set and cancelling.
function wordsInToken(token) {
  return token
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .map(function (w) { return w.toLowerCase(); });
}

function americanFor(word) {
  if (Object.prototype.hasOwnProperty.call(WHOLE_WORDS, word)) {
    return WHOLE_WORDS[word];
  }
  let match = OUR_PATTERN.exec(word);
  if (match) {
    return match[1] + 'or' + (match[2] || '');
  }
  match = IZE_PATTERN.exec(word);
  if (match) {
    return word.replace(/is(e|es|ed|ing|er|ers|ation|ations|able)$/, 'iz$1');
  }
  match = DOUBLE_L_PATTERN.exec(word);
  if (match) {
    return word.replace(/ll(ed|ing|er|ers|or|ors)$/, 'l$1');
  }
  return null;
}

module.exports = { americanFor, wordsInToken, SPELLING_ALLOWLIST };
