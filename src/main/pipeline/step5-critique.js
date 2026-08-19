// Step 4: self-critique.
//
// Two sources of flags are combined here, and keeping them apart is the whole
// design.
//
// The measured checks run first, in code. Reading grade, double-barreling,
// length, absolutes, and negation crossed with reverse keying are all decidable
// from the text, so they produce identical results on every run and appear in
// the trail as numbers, not opinions. They also cost nothing, which
// matters because they run against the full oversized pool.
//
// The model is then asked only about the two criteria that genuinely need
// judgment: whether an item leads the respondent, and whether it invites a
// socially desirable answer. Those depend on what the item is about and on what
// a respondent would want to be seen as, neither of which is in the string.
//
// Where a critique model is configured, it is a different model than Step 3
// wrote with. A model reviewing its own output shares the priors that produced
// it and passes work it should catch.

const { buildPrompt, SCHEMA } = require('../prompts/step5-critique');
const { checkItem, checkDimensionBalance } = require('./rubric/deterministic');
const { PROVENANCE } = require('./audit');

// Items go to the model one dimension at a time instead of one item at a time.
// A fifty item pool critiqued individually is fifty round trips, which on an
// eight billion parameter model is most of the pipeline's total runtime for no
// gain in judgment quality.
async function critiqueDimension(backend, construct, dimension, items) {
  const raw = await backend.complete(
    buildPrompt({ construct, dimension, items }),
    SCHEMA,
    { temperature: 0.2 }
  );
  const judgments = new Map();
  (Array.isArray(raw.judgments) ? raw.judgments : []).forEach(function (judgment) {
    judgments.set(String(judgment.item_id), judgment);
  });
  return judgments;
}

// Assess one dimension's worth of items and return their assessments. Step 5
// calls this directly on revised items, so the rubric applied to a rewrite is
// the same code that judged the original, not a second implementation
// that could drift away from it.
async function assessItems({ backend, construct, dimension, items, options, trail, entry }) {
  let judgments = new Map();
  try {
    judgments = await critiqueDimension(backend, construct, dimension, items);
  } catch (error) {
    if (trail && entry) {
      trail.recordDecision(entry, {
        code: 'judgment_unavailable',
        description: 'Model critique failed for ' + dimension.name +
          ', so only the measured checks were applied there: ' + error.message,
        evidence: dimension.name,
        provenance: PROVENANCE.MEASURED
      });
    }
  }

  return items.map(function (item) {
    const flags = checkItem(item, options);
    const judgment = judgments.get(item.id);
    if (judgment) {
      if (judgment.leading === true) {
        flags.push({
          code: 'leading',
          message: judgment.leading_note || 'Leads the respondent toward one answer.',
          evidence: null,
          source: 'model'
        });
      }
      if (judgment.socially_desirable === true) {
        flags.push({
          code: 'social_desirability',
          message: judgment.desirability_note || 'Invites the answer the respondent would prefer to give.',
          evidence: null,
          source: 'model'
        });
      }
    }
    return {
      itemId: item.id,
      dimension: item.dimension,
      pass: flags.length === 0,
      flags,
      suggestedRewrite: judgment && judgment.suggested_rewrite
        ? String(judgment.suggested_rewrite).trim()
        : null
    };
  });
}

async function run({ input, results, backend, trail, entry, report, note }) {
  const scoping = results.scoping;
  const pool = results.generation.items;

  // The override is optional. When no critique model is set the same backend is
  // used, which is weaker but still better than skipping the step.
  const critic = input.critiqueModel ? backend.withModel(input.critiqueModel) : backend;
  if (input.critiqueModel) {
    trail.recordDecision(entry, {
      code: 'independent_critic',
      description: 'Critique ran on ' + input.critiqueModel +
        ', a different model than the one that wrote the items.',
      evidence: input.critiqueModel,
      provenance: PROVENANCE.MEASURED
    });
  }

  const options = {
    readabilityMeasure: input.readabilityMeasure,
    maximumGrade: input.maximumGrade,
    maximumWords: input.maximumWords
  };

  const assessments = [];

  let dimensionIndex = 0;
  for (const dimension of scoping.dimensions) {
    dimensionIndex += 1;
    const items = pool.filter(function (i) { return i.dimension === dimension.name; });
    if (items.length === 0) {
      continue;
    }
    if (report) {
      report(
        'Reviewing ' + items.length + ' items in ' + dimension.name,
        dimensionIndex,
        scoping.dimensions.length
      );
    }

    // Judgment is attempted but never allowed to end the run. Losing the model
    // half of the rubric degrades the critique; losing the measured half as
    // collateral would be worse, and so would losing the pipeline.
    const dimensionAssessments = await assessItems({
      backend: critic,
      construct: scoping.construct,
      dimension,
      items,
      options,
      trail,
      entry
    });

    dimensionAssessments.forEach(function (assessment) {
      const item = assessment.itemId;
      const flags = assessment.flags;
      assessments.push(assessment);

      if (!assessment.pass) {
        trail.recordItemEvent(item, {
          event: 'critiqued',
          pass: false,
          flags: flags.map(function (f) { return f.code; })
        });
        if (note) {
          note(item + ' flagged: ' + flags.map(function (f) { return f.code.replace(/_/g, ' '); }).join(', '));
        }
        flags.forEach(function (flagged) {
          trail.recordDecision(entry, {
            code: flagged.code,
            description: item + ': ' + flagged.message,
            evidence: flagged.evidence,
            // Measured checks and model judgments land in the same list, and
            // this field is the only thing distinguishing them afterwards.
            provenance: flagged.source === 'model' ? PROVENANCE.JUDGED : PROVENANCE.MEASURED
          });
        });
      } else {
        trail.recordItemEvent(item, { event: 'critiqued', pass: true, flags: [] });
      }
    });
  }

  // Balance is a property of the pool, not of any item, so it is
  // reported against the dimension and carried forward for Step 5 to act on.
  const balance = checkDimensionBalance(pool, options);
  balance.forEach(function (finding) {
    trail.recordDecision(entry, {
      code: finding.code,
      description: finding.message,
      evidence: (finding.proportion * 100).toFixed(0) + ' percent',
      provenance: PROVENANCE.MEASURED
    });
  });

  return { assessments, balance };
}

function describe(output) {
  const failed = output.assessments.filter(function (a) { return !a.pass; });
  const measured = failed.filter(function (a) {
    return a.flags.some(function (f) { return f.source === 'deterministic'; });
  }).length;
  const balanceNote = output.balance.length > 0
    ? ' ' + output.balance.length + ' dimensions are outside the reverse keying band.'
    : '';
  return failed.length + ' of ' + output.assessments.length +
    ' items flagged, ' + measured + ' by measurement.' + balanceNote;
}

function recordInput({ results }) {
  return { itemCount: results.generation.items.length };
}

module.exports = { number: 5, name: 'critique', run, describe, recordInput, assessItems };
