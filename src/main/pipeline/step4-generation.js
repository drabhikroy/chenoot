// Step 3: item generation.
//
// Produces an oversized pool so that Steps 4 through 6 have something to
// discard. Generating exactly the target count would leave the critique step
// unable to reject anything without falling below quota, which turns critique
// into theatre.
//
// Generation runs one call per dimension, not one call for the whole
// instrument. A local model given eight dimensions at once produces items that
// drift toward whichever dimension it wrote first, and per-dimension calls also
// give the pipeline view something to report while it works.

const { buildPrompt, SCHEMA } = require('../prompts/step4-generation');
const { PROVENANCE } = require('./audit');

// Pool multiplier. Three times target is the specification's upper bound and is
// used here because the revision loop in Step 5 drops items permanently, so
// the pool has to survive both critique and deduplication.
const POOL_MULTIPLIER = 3;

// Share of each dimension written reverse keyed. This sits inside the band the
// deterministic rubric checks against, so generation and critique are working
// toward the same target and not against each other.
const REVERSE_TARGET = 0.3;

// Item wording benefits from variation in a way that structured extraction does
// not, so this step runs warmer than the schema-heavy steps around it.
const GENERATION_TEMPERATURE = 0.85;

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Exact and near-exact repeats are common when a local model generates fifteen
// items in one response. Removing them here is cheap and keeps Step 6 from
// spending embedding calls on duplicates that never needed a similarity score.
function normalizeForComparison(text) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

async function run({ results, backend, trail, entry, report, note }) {
  const scoping = results.scoping;
  const grounding = results.grounding || { referenceScales: [], grounded: false };

  const items = [];
  const perDimension = [];

  let dimensionIndex = 0;
  for (const dimension of scoping.dimensions) {
    dimensionIndex += 1;
    if (report) {
      report('Writing items for ' + dimension.name, dimensionIndex, scoping.dimensions.length);
    }
    const requested = dimension.targetItemCount * POOL_MULTIPLIER;
    const reverseCount = Math.round(requested * REVERSE_TARGET);

    const raw = await backend.complete(
      buildPrompt({
        construct: scoping.construct,
        dimension,
        requested,
        reverseCount,
        phrasingNotes: grounding.referenceScales.map(function (s) { return s.phrasingNotes; })
      }),
      SCHEMA,
      { temperature: GENERATION_TEMPERATURE }
    );

    const produced = Array.isArray(raw.items) ? raw.items : [];
    const seen = new Set();
    let duplicatesDropped = 0;

    produced.forEach(function (item, index) {
      const text = String(item.text || '').trim();
      if (text.length === 0) {
        return;
      }
      const key = normalizeForComparison(text);
      if (seen.has(key)) {
        duplicatesDropped += 1;
        return;
      }
      seen.add(key);

      const id = slug(dimension.name) + '-' + String(index + 1).padStart(2, '0');
      const record = {
        id,
        dimension: dimension.name,
        text,
        // Anything the model does not explicitly mark reverse is treated as
        // positive. Guessing direction from the wording would be a second
        // heuristic layered on an already uncertain one.
        direction: item.direction === 'reverse' ? 'reverse' : 'positive'
      };
      items.push(record);
      if (note) {
        note(id + ' \u00B7 ' + text);
      }
      trail.recordItemEvent(id, {
        event: 'generated',
        dimension: dimension.name,
        direction: record.direction,
        text
      });
    });

    const kept = items.filter(function (i) { return i.dimension === dimension.name; }).length;
    perDimension.push({ dimension: dimension.name, requested, kept, duplicatesDropped });

    if (duplicatesDropped > 0) {
      trail.recordDecision(entry, {
        code: 'verbatim_duplicates_removed',
        description: duplicatesDropped + ' verbatim repeats were removed from ' +
          dimension.name + ' before critique.',
        evidence: String(duplicatesDropped),
        provenance: PROVENANCE.MEASURED
      });
    }

    // A dimension that comes back badly short will not recover downstream,
    // since every later step only removes items. Recording it here means the
    // shortfall is attributable to generation, not appearing as a
    // mystery at assembly.
    if (kept < dimension.targetItemCount) {
      trail.recordDecision(entry, {
        code: 'pool_below_target',
        description: dimension.name + ' produced ' + kept + ' usable items against a target of ' +
          dimension.targetItemCount + ', so it has no margin for rejection.',
        evidence: kept + '/' + dimension.targetItemCount,
        provenance: PROVENANCE.MEASURED
      });
    }
  }

  // An empty pool ends the run here.
  //
  // Every step after this one only removes items, so a pool of nothing stays
  // nothing all the way to the end, and the end is an instrument record listing
  // zero items under a construct, a response scale, and a paragraph explaining
  // why that scale suits the construct. It reads as a finished piece of work.
  // Somebody waited eight minutes for it.
  //
  // The usual cause is the model ignoring the response schema, which happens
  // more with some models than others and is not something the pipeline can
  // repair by continuing. Stopping at the step that actually failed names the
  // model and the construct, which is what a person needs in order to try a
  // different model rather than wonder what they did wrong.
  if (items.length === 0) {
    throw new Error(
      'Generation produced no usable items for ' + scoping.construct + '. ' +
      'The model returned nothing matching the expected shape, which usually ' +
      'means it is not following the response format. Trying a different ' +
      'model is normally enough.'
    );
  }

  return { items, perDimension };
}

function describe(output) {
  const dimensions = output.perDimension.length;
  const reverse = output.items.filter(function (i) { return i.direction === 'reverse'; }).length;
  return 'Generated ' + output.items.length + ' candidate items across ' +
    dimensions + ' dimensions, ' + reverse + ' of them reverse keyed.';
}

function recordInput({ results }) {
  return {
    dimensions: results.scoping.dimensions,
    grounded: results.grounding ? results.grounding.grounded : false,
    poolMultiplier: POOL_MULTIPLIER,
    reverseTarget: REVERSE_TARGET
  };
}

module.exports = {
  number: 4,
  name: 'generation',
  run,
  describe,
  recordInput,
  normalizeForComparison,
  POOL_MULTIPLIER,
  REVERSE_TARGET
};
