// Step 5: revision loop.
//
// Rewrites every flagged item, re-judges the rewrite, and repeats up to a fixed
// cap. Items still failing at the cap are dropped with their full failure
// history recorded.
//
// The loop is batched by dimension and not run per item, and that choice is
// what makes the step usable. A fifty item pool with a third of it flagged is
// roughly seventeen items needing up to three rounds each. Run individually
// that is around a hundred model calls, which on an eight billion parameter
// model is most of an hour by itself. Batched, it is at most two calls per
// dimension per round, which is a small multiple of the critique step that
// preceded it.
//
// The cap is not a performance concession. An item that has failed the same
// rubric three times is not converging, and a fourth attempt produces a fourth
// variation on the same flaw, not a fix.

const { buildPrompt, SCHEMA } = require('../prompts/step6-revision');
const { assessItems } = require('./step5-critique');
const { PROVENANCE } = require('./audit');

const MAXIMUM_ITERATIONS = 3;

async function run({ input, results, backend, trail, entry, report, note }) {
  const scoping = results.scoping;
  const critique = results.critique;
  const critic = input.critiqueModel ? backend.withModel(input.critiqueModel) : backend;

  const options = {
    readabilityMeasure: input.readabilityMeasure,
    maximumGrade: input.maximumGrade,
    maximumWords: input.maximumWords
  };

  // Working copy keyed by id. Revised text replaces the original in place, so
  // downstream steps see one pool, not an original and a patch list.
  const byId = new Map();
  results.generation.items.forEach(function (item) {
    byId.set(item.id, Object.assign({}, item));
  });

  const assessmentById = new Map();
  critique.assessments.forEach(function (a) { assessmentById.set(a.itemId, a); });

  const dropped = [];
  let revisedCount = 0;
  let recoveredCount = 0;

  let dimensionIndex = 0;
  for (const dimension of scoping.dimensions) {
    dimensionIndex += 1;
    // Items enter the loop already failing. Each round narrows the set.
    let failing = critique.assessments.filter(function (a) {
      return a.dimension === dimension.name && !a.pass;
    });

    // Distinguishes an item that would not converge from a model that could not
    // be reached. Only the first is grounds for dropping anything.
    let callFailed = false;

    for (let iteration = 1; iteration <= MAXIMUM_ITERATIONS && failing.length > 0; iteration += 1) {
      if (report) {
        report(
          'Rewriting ' + failing.length + ' items in ' + dimension.name +
            ', round ' + iteration + ' of ' + MAXIMUM_ITERATIONS,
          dimensionIndex,
          scoping.dimensions.length
        );
      }
      const batch = failing.map(function (assessment) {
        const item = byId.get(assessment.itemId);
        return {
          id: item.id,
          text: item.text,
          direction: item.direction,
          flags: assessment.flags.map(function (f) { return f.message; }),
          suggestedRewrite: assessment.suggestedRewrite
        };
      });

      let rewrites = new Map();
      try {
        const raw = await critic.complete(
          buildPrompt({ construct: scoping.construct, dimension, batch }),
          SCHEMA,
          { temperature: 0.5 }
        );
        (Array.isArray(raw.revisions) ? raw.revisions : []).forEach(function (revision) {
          const text = String(revision.text || '').trim();
          if (text.length > 0) {
            rewrites.set(String(revision.item_id), text);
          }
        });
      } catch (error) {
        // A failed rewrite call ends the loop for this dimension. Retrying it
        // would spend the remaining iterations on the same broken call.
        callFailed = true;
        trail.recordDecision(entry, {
          code: 'revision_call_failed',
          description: 'Rewriting failed for ' + dimension.name + ' at round ' +
            iteration + ', so its flagged items were left as generated: ' + error.message,
          evidence: dimension.name,
          provenance: PROVENANCE.MEASURED
        });
        break;
      }

      // Apply rewrites. An item the model declined to rewrite keeps its text
      // and is re-judged unchanged, which will fail again and consume an
      // iteration. That is intended: it makes a model refusing to engage look
      // the same as a model failing to fix, and both end in a drop.
      const revisedItems = [];
      failing.forEach(function (assessment) {
        const item = byId.get(assessment.itemId);
        const rewrite = rewrites.get(item.id);
        if (rewrite && rewrite !== item.text) {
          trail.recordItemEvent(item.id, {
            event: 'revised',
            iteration,
            from: item.text,
            to: rewrite,
            addressing: assessment.flags.map(function (f) { return f.code; })
          });
          if (note) {
            note(item.id + ' rewritten, round ' + iteration);
          }
          item.text = rewrite;
          revisedCount += 1;
        }
        revisedItems.push(item);
      });

      // Re-judged through the same code path as the original critique, on the
      // revised subset only.
      const reassessed = await assessItems({
        backend: critic,
        construct: scoping.construct,
        dimension,
        items: revisedItems,
        options,
        trail,
        entry
      });

      reassessed.forEach(function (assessment) {
        assessmentById.set(assessment.itemId, assessment);
        if (assessment.pass) {
          recoveredCount += 1;
          trail.recordItemEvent(assessment.itemId, { event: 'cleared', iteration });
        }
      });

      failing = reassessed.filter(function (a) { return !a.pass; });
    }

    // An unreachable model is not the item's fault. Items left flagged by a
    // failed call are kept with their flags intact and reported, because
    // deleting work over an infrastructure problem is not a judgment anyone
    // asked this step to make.
    if (callFailed) {
      failing.forEach(function (assessment) {
        trail.recordItemEvent(assessment.itemId, {
          event: 'left-unrevised',
          reasons: assessment.flags.map(function (f) { return f.code; })
        });
      });
      if (failing.length > 0) {
        trail.recordDecision(entry, {
          code: 'items_left_flagged',
          description: failing.length + ' items in ' + dimension.name +
            ' remain flagged because revision could not run. They were kept and not dropped.',
          evidence: String(failing.length),
          provenance: PROVENANCE.MEASURED
        });
      }
      continue;
    }

    // Whatever is still failing has exhausted the cap.
    failing.forEach(function (assessment) {
      const item = byId.get(assessment.itemId);
      const reasons = assessment.flags.map(function (f) { return f.code; });
      dropped.push({ id: item.id, dimension: item.dimension, text: item.text, reasons });
      byId.delete(item.id);

      if (note) {
        note(item.id + ' dropped after ' + MAXIMUM_ITERATIONS + ' rounds: ' + reasons.join(', '));
      }
      trail.recordItemEvent(item.id, {
        event: 'dropped',
        afterIterations: MAXIMUM_ITERATIONS,
        reasons
      });
      trail.recordDecision(entry, {
        code: 'item_dropped',
        description: item.id + ' still failed after ' + MAXIMUM_ITERATIONS +
          ' revision rounds and was removed. Outstanding: ' + reasons.join(', ') + '.',
        evidence: item.text,
        provenance: PROVENANCE.MEASURED
      });
    });
  }

  const items = Array.from(byId.values());

  // Coverage is checked here as well as in Step 6, because a dimension gutted
  // by drops needs to be attributable to revision and not to deduplication.
  scoping.dimensions.forEach(function (dimension) {
    const remaining = items.filter(function (i) { return i.dimension === dimension.name; }).length;
    if (remaining < dimension.targetItemCount) {
      trail.recordDecision(entry, {
        code: 'coverage_lost_to_revision',
        description: dimension.name + ' fell to ' + remaining + ' items against a target of ' +
          dimension.targetItemCount + ' after revision drops.',
        evidence: remaining + '/' + dimension.targetItemCount,
        provenance: PROVENANCE.MEASURED
      });
    }
  });

  return {
    items,
    assessments: Array.from(assessmentById.values()),
    dropped,
    revisedCount,
    recoveredCount
  };
}

function describe(output) {
  const parts = [output.revisedCount + ' items revised'];
  if (output.recoveredCount > 0) {
    parts.push(output.recoveredCount + ' cleared the rubric');
  }
  if (output.dropped.length > 0) {
    parts.push(output.dropped.length + ' dropped after ' + MAXIMUM_ITERATIONS + ' attempts');
  }
  return parts.join(', ') + '. ' + output.items.length + ' items remain.';
}

function recordInput({ results }) {
  return {
    flaggedAtEntry: results.critique.assessments.filter(function (a) { return !a.pass; }).length,
    maximumIterations: MAXIMUM_ITERATIONS
  };
}

module.exports = { number: 6, name: 'revision', run, describe, recordInput, MAXIMUM_ITERATIONS };
