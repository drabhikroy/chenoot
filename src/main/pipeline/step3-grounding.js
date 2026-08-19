// Step 2: literature grounding.
//
// This step is the most dangerous one in the pipeline and the least important
// to the result, which is an uncomfortable combination.
//
// It is dangerous because a seven or eight billion parameter model asked to
// recall validated scales will produce scale names, authors, and years fluently
// and frequently invent them. An application whose stated purpose is auditable
// reasoning cannot let fabricated citations enter the audit trail unmarked.
//
// It is unimportant because everything downstream works without it. Step 3
// generates from the dimension definitions; grounding only calibrates phrasing.
// So the correct posture is to run it, mark everything it produces as
// unverified, and never let it stop the pipeline for any reason.
//
// The default is therefore off. A person who wants recalled references turns
// them on knowingly, and the interface says what they are getting.

const { buildPrompt, SCHEMA } = require('../prompts/step3-grounding');
const { PROVENANCE } = require('./audit');
const reference = require('./spec/reference-instruments');

// Grounding is given a shorter budget than other steps. It is optional, so a
// slow response here should cost the run seconds and not minutes.
const GROUNDING_TIMEOUT_MS = 45000;

function emptyGrounding(reason) {
  return {
    referenceScales: [],
    grounded: false,
    reason
  };
}

async function run({ input, results, backend, trail, entry }) {
  const scoping = results.scoping;

  // Off by default. The flag is opt-in, not opt-out because the failure
  // mode of this step is silent and confident.
  if (!input.allowModelRecall) {
    trail.recordDecision(entry, {
      code: 'grounding_skipped',
      description: 'Grounding was not requested, so item generation proceeds from the dimension definitions alone.',
      provenance: PROVENANCE.MEASURED
    });
    return emptyGrounding('not-requested');
  }

  let raw;
  try {
    // Wrapped, not allowed to propagate. The specification requires that
    // this step never blocks the pipeline, and a timeout or a malformed
    // response is exactly the case that requirement was written for.
    raw = await Promise.race([
      backend.complete(buildPrompt(scoping), SCHEMA),
      new Promise(function (_resolve, reject) {
        setTimeout(function () { reject(new Error('Grounding timed out.')); }, GROUNDING_TIMEOUT_MS);
      })
    ]);
  } catch (error) {
    trail.recordDecision(entry, {
      code: 'grounding_unavailable',
      description: 'Grounding did not return usable output, so the pipeline continued without it: ' + error.message,
      provenance: PROVENANCE.MEASURED
    });
    return emptyGrounding('failed');
  }

  const scales = Array.isArray(raw.reference_scales) ? raw.reference_scales : [];
  if (scales.length === 0) {
    trail.recordDecision(entry, {
      code: 'grounding_empty',
      description: 'No reference scales were recalled for this construct.',
      provenance: PROVENANCE.MEASURED
    });
    return emptyGrounding('none-found');
  }

  // Every recalled scale is checked against the bundled reference list and gets
  // its own trail entry. One aggregate entry would let a reader carry a marker
  // away from the specific names it applies to, which is the confusion the
  // marker exists to prevent.
  //
  // Three outcomes, and only one of them upgrades the provenance. A match means
  // the name and the source are right, which is a real check and is recorded as
  // measured. Everything else stays unverified recall, because a list of a few
  // dozen instruments cannot confirm the absence of anything.
  const checked = scales.map(function (scale) {
    const result = reference.verify(scale);

    if (result.status === reference.MATCHED) {
      trail.recordDecision(entry, {
        code: 'reference_scale_verified',
        description: '"' + scale.name + '" was checked against the bundled reference list. ' +
          result.detail,
        evidence: result.entry.author + ', ' + result.entry.year,
        provenance: PROVENANCE.MEASURED
      });
    } else if (result.status === reference.CONTRADICTED) {
      trail.recordDecision(entry, {
        code: 'reference_scale_contradicted',
        description: '"' + scale.name + '" conflicts with the bundled reference list. ' +
          result.detail,
        evidence: scale.source || null,
        provenance: PROVENANCE.MEASURED
      });
    } else {
      trail.recordDecision(entry, {
        code: 'reference_scale_recalled',
        description: 'Model recalled "' + scale.name + '" and it could not be checked. ' +
          result.detail,
        evidence: scale.source || null,
        provenance: PROVENANCE.RECALLED
      });
    }

    return { scale, verification: result };
  });

  // Phrasing conventions are kept and the citations are kept separate from
  // them. A convention such as "items are written in the first person present
  // tense" is useful whether or not the scale it was attributed to exists.
  //
  // A contradicted entry is a different matter. Its attribution is demonstrably
  // wrong, which is evidence the recall itself was unreliable, so its phrasing
  // notes are dropped and not fed to item generation.
  return {
    referenceScales: checked.map(function (record) {
      const scale = record.scale;
      return {
        name: String(scale.name || '').trim(),
        source: String(scale.source || '').trim(),
        relevantDimensions: Array.isArray(scale.relevant_dimensions) ? scale.relevant_dimensions : [],
        phrasingNotes: String(scale.phrasing_notes || '').trim(),
        // Carried on the object itself, not only in the trail, so that any
        // export or screen rendering these has the marker in hand. Verified now
        // means checked against the bundled list and agreeing with it, which is
        // a narrower claim than verified against the literature.
        verified: record.verification.status === reference.MATCHED,
        verification: record.verification.status,
        verificationDetail: record.verification.detail
      };
    }),
    grounded: true,
    reason: 'model-recall'
  };
}

function describe(output) {
  if (!output.grounded) {
    const reasons = {
      'not-requested': 'Grounding skipped. Items will be written from the dimension definitions.',
      failed: 'Grounding was unavailable. Continuing without it.',
      'none-found': 'No comparable scales recalled. Continuing without grounding.'
    };
    return reasons[output.reason] || 'Continuing without grounding.';
  }
  const verified = output.referenceScales.filter(function (s) { return s.verified; }).length;
  const contradicted = output.referenceScales.filter(function (s) {
    return s.verification === 'contradicted';
  }).length;
  const parts = ['Recalled ' + output.referenceScales.length + ' comparable scales for phrasing'];
  parts.push(verified + ' checked against the reference list');
  if (contradicted > 0) {
    parts.push(contradicted + ' conflicting with it');
  }
  return parts.join(', ') + '.';
}

function recordInput({ results }) {
  return { dimensions: results.scoping ? results.scoping.dimensions : [] };
}

module.exports = { number: 3, name: 'grounding', run, describe, recordInput };
