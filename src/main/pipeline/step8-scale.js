// Step 7: response scale selection.
//
// The model decides two things: whether the construct is unipolar or bipolar,
// and which response dimension the items are asking respondents to report. It
// does not write the anchor labels. Those come from a catalog that is balanced
// and fully labeled by construction.
//
// That split is deliberate. Anchor wording is among the most standardized parts
// of instrument design, and a local model asked to produce seven balanced
// anchors will routinely return six, place the midpoint off center, or pair
// mismatched intensifiers. None of that is judgment a model is better placed to
// make than a lookup table, and every instance is a defect a reader notices
// immediately.
//
// What the model is genuinely better at is reading a pool of items and saying
// what they are asking for. That is the part left to it.

const { buildPrompt, buildSchema } = require('../prompts/step8-scale');
const { CATALOG, UNSUPPORTED, FALLBACK, resolveLabels } = require('./scales/catalog');
const { PROVENANCE } = require('./audit');

// Signals that a pool describes countable events, not states. When a
// relative frequency scale is chosen over items like these, specific
// frequencies would measure the same thing with less respondent-to-respondent
// variance in what the anchors mean.
const COUNTABLE_MARKERS = [
  'attend', 'submit', 'ask', 'email', 'call', 'meet', 'visit', 'check',
  'complete', 'skip', 'miss', 'arrive', 'log in', 'sign up', 'volunteer',
  'practice', 'study', 'exercise', 'read', 'write'
];

// Whether a word can be dropped into an anchor frame such as "Extremely
// {construct}" without producing something nobody would write by hand. This is
// a rejection filter instead of a classifier, and the distinction is the
// point. Deciding that a word IS an adjective cannot be done by suffix:
// difficult, clear, and hard are all adjectives with no adjectival ending, and
// English has no closed set to test against. What can be done reliably is the
// negative case. A multi-word phrase never works in the frame, and the nominal
// suffixes below are dependable enough to exclude on sight: engagement,
// satisfaction, and development are nouns whatever else is true of them.
// Anything surviving both tests is accepted, because a rare odd-reading anchor
// costs less than routinely discarding good ones.
const NOMINAL_ENDINGS = /(?:ment|ness|tion|sion|ity|ism|ship|hood|ance|ence|ancy|ency|ure|age|ade|dom)$/;

function usableAsAnchorWord(word) {
  const cleaned = String(word || '').trim().toLowerCase();
  if (cleaned.length === 0 || /\s/.test(cleaned)) {
    return false;
  }
  return !NOMINAL_ENDINGS.test(cleaned);
}

function shareMatching(items, markers) {
  if (items.length === 0) {
    return 0;
  }
  const matching = items.filter(function (item) {
    const text = item.text.toLowerCase();
    return markers.some(function (marker) { return text.indexOf(marker) !== -1; });
  });
  return matching.length / items.length;
}

async function run({ results, backend, trail, entry }) {
  const scoping = results.scoping;
  const items = results.coverage.finalItems;

  let chosen = null;
  let polarity = null;
  let constructWord = '';
  let justification = '';

  try {
    const raw = await backend.complete(
      buildPrompt({ scoping, items, catalog: CATALOG }),
      buildSchema(CATALOG),
      { temperature: 0.2 }
    );
    chosen = String(raw.scale_type || '').trim();
    polarity = String(raw.polarity || '').trim();
    constructWord = String(raw.construct_word || '').trim();
    justification = String(raw.justification || '').trim();
  } catch (error) {
    trail.recordDecision(entry, {
      code: 'scale_selection_failed',
      description: 'Scale selection could not run, so the default was applied: ' + error.message,
      provenance: PROVENANCE.MEASURED
    });
  }

  if (!Object.prototype.hasOwnProperty.call(CATALOG, chosen)) {
    if (chosen) {
      trail.recordDecision(entry, {
        code: 'scale_type_unrecognized',
        description: 'Model proposed "' + chosen + '", which is not a catalog entry, so ' +
          FALLBACK + ' was applied instead.',
        evidence: chosen,
        provenance: PROVENANCE.MEASURED
      });
    }
    chosen = FALLBACK;
    if (!justification) {
      justification = 'Items are first-person declarative statements, which an agreement scale rates directly.';
    }
  }

  const selected = CATALOG[chosen];

  // The polarity the model declared is checked against the polarity the catalog
  // records. A disagreement means the reasoning and the choice came apart, and
  // the catalog is the authority because it is a stated property and not a
  // judgment made in the moment.
  if (polarity && polarity !== selected.polarity) {
    trail.recordDecision(entry, {
      code: 'polarity_mismatch',
      description: 'Model reasoned the construct is ' + polarity + ' but selected a ' +
        selected.polarity + ' scale. The scale was kept and the disagreement is recorded, ' +
        'because a mismatched polarity is worth a second look before this instrument is used.',
      evidence: polarity + ' against ' + selected.polarity,
      provenance: PROVENANCE.MEASURED
    });
  }

  // Item-specific anchors need an adjective. Without a usable one the
  // placeholder is stripped and the anchors fall back to generic wording, which
  // is why the check happens here, not being trusted to the model.
  if ((selected.itemSpecific || selected.endpointsOnly) && !usableAsAnchorWord(constructWord)) {
    trail.recordDecision(entry, {
      code: 'construct_word_unusable',
      description: constructWord
        ? '"' + constructWord + '" reads as a noun or a phrase instead of a modifier, so the anchors use generic wording instead of naming the construct.'
        : 'No adjective was supplied for the construct-specific anchors, so generic wording was used.',
      evidence: constructWord || null,
      provenance: PROVENANCE.MEASURED
    });
    constructWord = '';
  }

  const labels = resolveLabels(selected, constructWord);

  trail.recordDecision(entry, {
    code: 'scale_selected',
    description: selected.label + ' selected, ' + selected.polarity + '. ' + justification,
    evidence: chosen,
    provenance: PROVENANCE.JUDGED
  });
  trail.recordDecision(entry, {
    code: 'scale_labels_from_catalog',
    description: 'Anchor labels came from the catalog and not being generated, so the set is ' +
      (selected.endpointsOnly ? 'anchored at both ends with a familiar numeric range.' : 'fully labeled and symmetric.'),
    evidence: labels.length + ' anchors',
    provenance: PROVENANCE.MEASURED
  });

  // Acquiescence advisory. An agreement scale over an adjectival construct
  // measures willingness to agree alongside the construct itself, and a scale
  // naming the construct in its anchors would separate the two.
  if (selected.family === 'agreement') {
    trail.recordDecision(entry, {
      code: 'agreement_scale_advisory',
      description: 'An agreement scale was selected. Agreement formats are subject to acquiescence, ' +
        'the tendency to agree with whatever is presented, which raises scores for reasons unrelated ' +
        'to the construct. Where the construct can be named as an adjective, a scale whose anchors ' +
        'name it directly, such as not at all to extremely, measures it with less of that contamination. ' +
        'Reverse keyed items reduce the problem without removing it.',
      evidence: chosen,
      provenance: PROVENANCE.MEASURED
    });
  }

  // Relative frequency over countable behavior.
  if (selected.family === 'frequency' && !selected.requiresTimeFrame) {
    const countable = shareMatching(items, COUNTABLE_MARKERS);
    if (countable >= 0.5) {
      trail.recordDecision(entry, {
        code: 'frequency_could_be_specific',
        description: Math.round(countable * 100) + ' percent of items describe countable behavior, so ' +
          'specific frequencies such as once or twice a week would remove the variance introduced by ' +
          'words like often, which different respondents read as very different rates.',
        evidence: Math.round(countable * 100) + ' percent',
        provenance: PROVENANCE.MEASURED
      });
    }
  }

  // A specific frequency scale is unusable without a reference period on the
  // items, and nothing upstream adds one.
  if (selected.requiresTimeFrame) {
    trail.recordDecision(entry, {
      code: 'time_frame_required',
      description: 'This scale reports rates, so each item needs a reference period stating over what ' +
        'span the respondent should answer. None was added automatically and one has to be written in ' +
        'before the instrument is administered.',
      provenance: PROVENANCE.MEASURED
    });
  }

  return {
    scaleType: chosen,
    scaleLabel: selected.label,
    scaleLabels: labels,
    polarity: selected.polarity,
    family: selected.family,
    points: labels.length,
    hasMidpoint: labels.length % 2 === 1,
    fullyLabelled: !selected.endpointsOnly,
    requiresTimeFrame: Boolean(selected.requiresTimeFrame),
    justification,
    alternatives: Object.keys(UNSUPPORTED).map(function (key) {
      return { id: key, label: UNSUPPORTED[key].label, reason: UNSUPPORTED[key].reason };
    })
  };
}

function describe(output) {
  return output.scaleLabel + ', ' + output.polarity + ', anchored ' +
    output.scaleLabels[0] + ' to ' + output.scaleLabels[output.points - 1] + '.';
}

function recordInput({ results }) {
  return { itemCount: results.coverage.finalItems.length, options: Object.keys(CATALOG).length };
}

module.exports = {
  number: 8,
  name: 'scale',
  run,
  describe,
  recordInput,
  CATALOG,
  FALLBACK,
  usableAsAnchorWord,
  shareMatching
};
