// Step 1: construct scoping.
//
// Turns a construct name and a little context into named sub-dimensions with
// definitions and item quotas. Every later step works from these dimensions, so
// an error here propagates the whole way through, which is why the quota
// arithmetic is repaired in code and not trusted from the model.

const { buildPrompt, SCHEMA } = require('../prompts/step2-scoping');
const { PROVENANCE } = require('./audit');

// A dimension needs enough items to permit a reliability estimate. Below three
// the dimension cannot be evaluated at all, so a quota that lands under this is
// raised even when it costs another dimension an item.
const MINIMUM_ITEMS_PER_DIMENSION = 3;

// The rule that a dimension needs three items was enforced by raising the
// total instead of by limiting the dimensions, so a request for five items
// against five dimensions became a target of fifteen and the person received
// an instrument three times the length they asked for. The trail recorded the
// change, which is not the same as the person having agreed to it. The
// requested length is a constraint and not a suggestion. Someone who asks for
// five items has a reason, usually a place the instrument has to fit, and an
// instrument that does not fit there is not a longer version of the one they
// wanted. It is the wrong instrument.
function dimensionCeiling(itemCount) {
  // Anything that is not a number becomes one dimension. The only caller today
  // coerces its argument before calling, so this never fires in the running
  // application, but the function returned NaN for a missing count and a NaN
  // ceiling silently slices every dimension away. A latent trap rather than a
  // live defect, and one line to close.
  const count = Number(itemCount);
  if (!Number.isFinite(count)) {
    return 1;
  }
  return Math.max(1, Math.floor(count / MINIMUM_ITEMS_PER_DIMENSION));
}

// More than seven dimensions from a single construct almost always means the
// model has split facets that belong together. The pipeline does not refuse it,
// but the trail says so, because a reader looking at a nine-dimension
// instrument deserves to know it was unusual, not intended.
const DIMENSION_COUNT_WARNING = 7;

// Local models are unreliable at arithmetic. Rather than prompting harder for
// quotas that add up, the quotas are treated as proportions and rebuilt here,
// which cannot fail.
function reconcileQuotas(dimensions, targetTotal) {
  const requested = dimensions.map(function (d) {
    return Math.max(1, Number(d.target_item_count) || 1);
  });
  const requestedTotal = requested.reduce(function (a, b) { return a + b; }, 0);

  // Largest remainder apportionment. Proportional rounding alone can land one
  // or two items away from the target, and this settles the difference without
  // repeatedly favoring whichever dimension happens to be first.
  const exact = requested.map(function (value) {
    return (value / requestedTotal) * targetTotal;
  });
  const floors = exact.map(Math.floor);
  let remaining = targetTotal - floors.reduce(function (a, b) { return a + b; }, 0);

  const order = exact
    .map(function (value, index) { return { index, remainder: value - Math.floor(value) }; })
    .sort(function (a, b) { return b.remainder - a.remainder; });

  const allocated = floors.slice();
  let cursor = 0;
  while (remaining > 0) {
    allocated[order[cursor % order.length].index] += 1;
    remaining -= 1;
    cursor += 1;
  }

  // Raise anything below the reliability floor, taking from the largest
  // dimension that can spare an item.
  allocated.forEach(function (count, index) {
    while (allocated[index] < MINIMUM_ITEMS_PER_DIMENSION) {
      let donor = -1;
      let donorSize = MINIMUM_ITEMS_PER_DIMENSION;
      allocated.forEach(function (other, otherIndex) {
        if (otherIndex !== index && other > donorSize) {
          donor = otherIndex;
          donorSize = other;
        }
      });
      if (donor === -1) {
        break;
      }
      allocated[donor] -= 1;
      allocated[index] += 1;
    }
  });

  return allocated;
}

async function run({ input, results, backend, trail, entry, note }) {
  // Scoping now works from the reviewed specification, not from raw
  // input, so it inherits the research questions every dimension has to trace
  // back to and the constraints that shape what can be asked.
  const specification = results.specification;
  const requested = Math.max(1, Number(input.itemCount) || 0);
  const ceiling = dimensionCeiling(requested);
  const prompt = buildPrompt({
    construct: input.construct,
    population: specification.specification.targetPopulation || input.population,
    purpose: specification.specification.purpose || input.purpose,
    itemCount: input.itemCount,
    maxDimensions: ceiling,
    relatedConstructs: input.relatedConstructs,
    researchQuestions: specification.researchQuestions,
    constraints: specification.constraints
  });
  const raw = await backend.complete(prompt, SCHEMA);

  if (raw.operationalizable === false) {
    trail.recordDecision(entry, {
      code: 'construct_not_operationalizable',
      description: 'Scoping stopped and asked for clarification instead of guessing at the intended meaning.',
      evidence: raw.clarification_question || null,
      provenance: PROVENANCE.JUDGED
    });
    return {
      needsClarification: true,
      clarificationQuestion: raw.clarification_question ||
        'Which sense of this construct should the instrument measure?'
    };
  }

  const proposed = Array.isArray(raw.dimensions) ? raw.dimensions : [];
  if (proposed.length === 0) {
    throw new Error('Scoping returned no dimensions.');
  }

  // The ceiling is stated in the prompt and enforced here, because a local
  // model given a limit will sometimes return one more than it anyway, and one
  // more is the difference between every dimension being measurable and none of
  // them being. What is set aside is named, not silently discarded.
  const dimensions = proposed.slice(0, ceiling);
  const setAside = proposed.slice(ceiling);
  if (setAside.length > 0) {
    trail.recordDecision(entry, {
      code: 'dimensions_capped',
      description: 'A ' + requested + ' item instrument supports at most ' + ceiling +
        (ceiling === 1 ? ' dimension' : ' dimensions') + ' at ' +
        MINIMUM_ITEMS_PER_DIMENSION + ' items each, so the ' + setAside.length +
        ' beyond that were set aside instead of lengthening the instrument.',
      evidence: setAside.map(function (d) { return String(d.name).trim(); }).join(', '),
      provenance: PROVENANCE.MEASURED
    });
  }

  // The requested length, held to. Every quota below apportions this number and
  // nothing later in the pipeline raises it.
  const targetTotal = requested;
  const quotas = reconcileQuotas(dimensions, targetTotal);

  const scoped = dimensions.map(function (dimension, index) {
    if (note) {
      note('Dimension: ' + String(dimension.name).trim() + ', ' + quotas[index] + ' items');
    }
    return {
      name: String(dimension.name).trim(),
      definition: String(dimension.definition).trim(),
      targetItemCount: quotas[index]
    };
  });

  // Record the repair whenever the arithmetic actually moved, so a reader can
  // see that the quotas in the finished instrument are not the ones the model
  // proposed.
  const modelTotal = dimensions.reduce(function (total, d) {
    return total + (Number(d.target_item_count) || 0);
  }, 0);
  if (modelTotal !== targetTotal) {
    trail.recordDecision(entry, {
      code: 'item_quota_reconciled',
      description: 'Model quotas summed to ' + modelTotal + ' against a target of ' +
        targetTotal + ', so counts were reapportioned by largest remainder.',
      evidence: scoped.map(function (d) { return d.name + ': ' + d.targetItemCount; }).join(', '),
      provenance: PROVENANCE.MEASURED
    });
  }

  if (scoped.length > DIMENSION_COUNT_WARNING) {
    trail.recordDecision(entry, {
      code: 'dimension_count_high',
      description: 'Scoping produced ' + scoped.length +
        ' dimensions, which usually indicates facets that belong together.',
      evidence: String(scoped.length),
      provenance: PROVENANCE.MEASURED
    });
  }

  return {
    construct: raw.construct || input.construct,
    dimensions: scoped,
    totalTargetItems: targetTotal
  };
}

function describe(output) {
  if (output.needsClarification) {
    return 'Paused for clarification before scoping could proceed.';
  }
  const names = output.dimensions.map(function (d) { return d.name; });
  return 'Scoped into ' + names.length + ' dimensions covering ' +
    output.totalTargetItems + ' items: ' + names.join(', ') + '.';
}

// Recorded separately from the live input so the trail holds exactly what was
// sent to the model on this run, including the assembled prompt.
function recordInput({ input, results }) {
  return {
    construct: input.construct,
    researchQuestions: results.specification ? results.specification.researchQuestions : []
  };
}

module.exports = {
  number: 2,
  name: 'scoping',
  run,
  describe,
  recordInput,
  reconcileQuotas,
  dimensionCeiling,
  MINIMUM_ITEMS_PER_DIMENSION
};
