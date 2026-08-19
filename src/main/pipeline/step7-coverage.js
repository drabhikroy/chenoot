// Step 6: coverage and redundancy.
//
// The specification names a fixed cosine cutoff of 0.92 for near-duplicates.
// That number is not portable and this step does not use it as written, for
// two reasons.
//
// Cosine distributions are specific to the embedding model. A pair sitting at
// 0.92 under one model sits at 0.78 under another with no change in the text,
// so a constant lifted from one setup silently means something different in
// another.
//
// More importantly, items within a dimension are supposed to be similar. That
// similarity is the thing internal consistency measures. Against a background
// where most legitimate pairs already sit high, an absolute cutoff either
// strips items that were doing their job or catches nothing at all.
//
// So a near-duplicate is treated as an outlier in the dimension's own
// similarity distribution, not as a value above a line. The cutoff is
// computed per dimension from the median and the median absolute deviation, and
// floored so that a dimension of genuinely varied items cannot have its most
// similar pair removed merely for being the most similar.
//
// The distribution is written to the trail either way, so the decision can be
// checked, not taken on faith.

const { PROVENANCE } = require('./audit');
const { REVERSE_TARGET } = require('./step4-generation');

// Nothing below this is ever removed, whatever the distribution says.
const ABSOLUTE_FLOOR = 0.88;

// Deviations above the median before a pair is considered an outlier. Three is
// the conventional choice for outlier detection under a median-based estimator and errs toward keeping
// items, which is the right direction when the alternative is deleting work.
const DEVIATION_MULTIPLIER = 3;

// Scales the median absolute deviation so it is comparable to a standard
// deviation for a normal distribution.
const MAD_CONSISTENCY = 1.4826;

// Pairs from different dimensions that sit this close suggest the dimensions
// are not discriminable. These are reported and never removed, because the
// problem they indicate is in the scoping, not in the items.
const CROSS_DIMENSION_ALERT = 0.9;

// A dimension needs a handful of pairs before a distribution means anything.
const MINIMUM_PAIRS_FOR_DISTRIBUTION = 6;

function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort(function (a, b) { return a - b; });
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function medianAbsoluteDeviation(values, center) {
  return median(values.map(function (v) { return Math.abs(v - center); }));
}

// Quality ordering for deciding which of a near-duplicate pair survives. Fewer
// outstanding flags wins first, then the plainer item, then the shorter one.
// Every criterion is measured, so the choice is reproducible.
function preferredItem(a, b, assessmentById) {
  const flagsA = (assessmentById.get(a.id) || { flags: [] }).flags.length;
  const flagsB = (assessmentById.get(b.id) || { flags: [] }).flags.length;
  if (flagsA !== flagsB) {
    return flagsA < flagsB ? a : b;
  }
  if (a.text.length !== b.text.length) {
    return a.text.length < b.text.length ? a : b;
  }
  return a.id < b.id ? a : b;
}

async function run({ results, backend, trail, entry, report, note }) {
  const scoping = results.scoping;
  const items = results.revision.items;
  const assessmentById = new Map();
  results.revision.assessments.forEach(function (a) { assessmentById.set(a.itemId, a); });

  // Embeddings are the only external dependency here. Without them the
  // coverage half of the step still runs, which is worth more than failing.
  const vectors = new Map();
  let embeddingsAvailable = true;
  let embedded = 0;
  for (const item of items) {
    embedded += 1;
    if (report && embedded % 5 === 1) {
      report('Measuring item similarity', embedded, items.length);
    }
    try {
      vectors.set(item.id, await backend.embed(item.text));
    } catch (error) {
      embeddingsAvailable = false;
      trail.recordDecision(entry, {
        code: 'embeddings_unavailable',
        description: 'Redundancy checking was skipped because embeddings could not be produced: ' +
          error.message,
        provenance: PROVENANCE.MEASURED
      });
      break;
    }
  }

  const removedDuplicates = [];
  const crossDimensionAlerts = [];
  const distributions = [];
  const meanSimilarity = new Map();
  const trimmed = [];

  if (embeddingsAvailable) {
    const survivors = new Set(items.map(function (i) { return i.id; }));

    scoping.dimensions.forEach(function (dimension) {
      const group = items.filter(function (i) { return i.dimension === dimension.name; });
      const pairs = [];
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          pairs.push({
            a: group[i],
            b: group[j],
            similarity: cosine(vectors.get(group[i].id), vectors.get(group[j].id))
          });
        }
      }
      if (pairs.length === 0) {
        return;
      }

      // Mean similarity of each item to the rest of its dimension. An item that
      // sits close to everything else adds least, so this becomes the diversity
      // term when the pool has to be narrowed to the target count below.
      group.forEach(function (item) {
        const related = pairs.filter(function (p) {
          return p.a.id === item.id || p.b.id === item.id;
        });
        meanSimilarity.set(
          item.id,
          related.length === 0
            ? 0
            : related.reduce(function (total, p) { return total + p.similarity; }, 0) / related.length
        );
      });

      const similarities = pairs.map(function (p) { return p.similarity; });
      const center = median(similarities);
      const spread = medianAbsoluteDeviation(similarities, center) * MAD_CONSISTENCY;

      // With too few pairs the distribution is noise, so the floor alone
      // governs and the trail says which rule was applied.
      const adaptive = pairs.length >= MINIMUM_PAIRS_FOR_DISTRIBUTION
        ? center + DEVIATION_MULTIPLIER * spread
        : 0;
      const cutoff = Math.max(ABSOLUTE_FLOOR, adaptive);

      distributions.push({
        dimension: dimension.name,
        pairs: pairs.length,
        median: center,
        deviation: spread,
        cutoff,
        rule: pairs.length >= MINIMUM_PAIRS_FOR_DISTRIBUTION ? 'adaptive' : 'floor-only'
      });

      trail.recordDecision(entry, {
        code: 'similarity_distribution',
        description: dimension.name + ' pairwise similarity had a median of ' +
          center.toFixed(3) + ' across ' + pairs.length + ' pairs, giving a removal cutoff of ' +
          cutoff.toFixed(3) + '.',
        evidence: 'median ' + center.toFixed(3) + ', deviation ' + spread.toFixed(3) +
          ', cutoff ' + cutoff.toFixed(3),
        provenance: PROVENANCE.MEASURED
      });

      // Highest similarity first, so the closest pair is resolved before a
      // looser pair sharing one of its items.
      pairs
        .filter(function (p) { return p.similarity >= cutoff; })
        .sort(function (x, y) { return y.similarity - x.similarity; })
        .forEach(function (pair) {
          if (!survivors.has(pair.a.id) || !survivors.has(pair.b.id)) {
            return;
          }
          const kept = preferredItem(pair.a, pair.b, assessmentById);
          const removed = kept === pair.a ? pair.b : pair.a;
          survivors.delete(removed.id);
          removedDuplicates.push({
            kept: kept.id,
            removed: removed.id,
            dimension: dimension.name,
            similarity: pair.similarity,
            removedText: removed.text
          });
          if (note) {
            note(removed.id + ' removed, near-duplicate of ' + kept.id +
              ' at ' + pair.similarity.toFixed(2));
          }
          trail.recordItemEvent(removed.id, {
            event: 'removed-as-duplicate',
            of: kept.id,
            similarity: pair.similarity
          });
          trail.recordDecision(entry, {
            code: 'duplicate_removed',
            description: removed.id + ' was removed as a near-duplicate of ' + kept.id +
              ' at cosine ' + pair.similarity.toFixed(3) + ', above the ' +
              cutoff.toFixed(3) + ' cutoff for this dimension.',
            evidence: pair.similarity.toFixed(3),
            provenance: PROVENANCE.MEASURED
          });
        });
    });

    // Cross-dimension similarity is reported without action. An item that looks
    // like an item in another dimension is evidence the two dimensions overlap,
    // and deleting one of them would hide that, not fix it.
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (items[i].dimension === items[j].dimension) {
          continue;
        }
        if (!survivors.has(items[i].id) || !survivors.has(items[j].id)) {
          continue;
        }
        const similarity = cosine(vectors.get(items[i].id), vectors.get(items[j].id));
        if (similarity >= CROSS_DIMENSION_ALERT) {
          crossDimensionAlerts.push({
            a: items[i].id,
            b: items[j].id,
            dimensions: [items[i].dimension, items[j].dimension],
            similarity
          });
          trail.recordDecision(entry, {
            code: 'cross_dimension_overlap',
            description: items[i].id + ' and ' + items[j].id + ' sit at cosine ' +
              similarity.toFixed(3) + ' across ' + items[i].dimension + ' and ' +
              items[j].dimension + ', which suggests the dimensions are not fully distinct. ' +
              'Both were kept.',
            evidence: similarity.toFixed(3),
            provenance: PROVENANCE.MEASURED
          });
        }
      }
    }

    // Coverage is restored before anything leaves this step. Deduplication is
    // worth less than a dimension that can be scored, so the least similar
    // removals are put back until quota is met.
    scoping.dimensions.forEach(function (dimension) {
      const remaining = items.filter(function (i) {
        return i.dimension === dimension.name && survivors.has(i.id);
      }).length;
      if (remaining >= dimension.targetItemCount) {
        return;
      }
      const restorable = removedDuplicates
        .filter(function (r) { return r.dimension === dimension.name; })
        .sort(function (x, y) { return x.similarity - y.similarity; });

      let shortfall = dimension.targetItemCount - remaining;
      while (shortfall > 0 && restorable.length > 0) {
        const restored = restorable.shift();
        survivors.add(restored.removed);
        removedDuplicates.splice(removedDuplicates.indexOf(restored), 1);
        shortfall -= 1;
        trail.recordItemEvent(restored.removed, { event: 'restored-for-coverage' });
        trail.recordDecision(entry, {
          code: 'duplicate_restored',
          description: restored.removed + ' was put back because ' + dimension.name +
            ' would otherwise have fallen below its target of ' + dimension.targetItemCount + '.',
          evidence: restored.similarity.toFixed(3),
          provenance: PROVENANCE.MEASURED
        });
      }
      if (shortfall > 0) {
        trail.recordDecision(entry, {
          code: 'coverage_short',
          description: dimension.name + ' finished ' + shortfall +
            ' items below its target with nothing left to restore.',
          evidence: String(shortfall),
          provenance: PROVENANCE.MEASURED
        });
      }
    });

    // Narrow each dimension to its target count.
    //
    // This is the step the step was missing. Everything before it removes items
    // for cause: a failed rubric, a near-duplicate. None of it selects. Without
    // a selection pass the oversized pool that Step 3 drafted deliberately, so
    // that later steps would have something to discard, survives intact and a
    // request for eight items returns twenty-six.
    scoping.dimensions.forEach(function (dimension) {
      const pool = items.filter(function (i) {
        return i.dimension === dimension.name && survivors.has(i.id);
      });
      const surplus = pool.length - dimension.targetItemCount;
      if (surplus <= 0) {
        return;
      }

      // Ranked on three measured criteria in order. Fewest outstanding flags
      // first, because quality is the point. Then least similar to the rest of
      // the dimension, because an item that sits close to everything else adds
      // the least coverage. Then by identifier, so the result is reproducible
      // and not dependent on iteration order.
      const rank = function (a, b) {
        const flagsA = (assessmentById.get(a.id) || { flags: [] }).flags.length;
        const flagsB = (assessmentById.get(b.id) || { flags: [] }).flags.length;
        if (flagsA !== flagsB) {
          return flagsA - flagsB;
        }
        const simA = meanSimilarity.get(a.id) || 0;
        const simB = meanSimilarity.get(b.id) || 0;
        if (simA !== simB) {
          return simA - simB;
        }
        return a.id < b.id ? -1 : 1;
      };

      // Selection is done within keying direction, not across the whole
      // pool. Ranking on quality alone reliably strips the reverse keyed items,
      // because they are the harder ones to write and therefore the ones
      // carrying more flags, and a dimension with no reverse items is exposed
      // to acquiescence bias no matter how good the survivors read.
      const positives = pool.filter(function (i) { return i.direction === 'positive'; }).sort(rank);
      const reverses = pool.filter(function (i) { return i.direction === 'reverse'; }).sort(rank);

      const wantedReverse = Math.min(
        reverses.length,
        Math.max(1, Math.round(dimension.targetItemCount * REVERSE_TARGET))
      );
      const wantedPositive = dimension.targetItemCount - wantedReverse;

      const kept = new Set(
        positives.slice(0, wantedPositive).concat(reverses.slice(0, wantedReverse))
          .map(function (i) { return i.id; })
      );

      // Any shortfall in one direction is made up from the other, so the target
      // count is met even when a dimension produced no usable reverse items.
      if (kept.size < dimension.targetItemCount) {
        pool.slice().sort(rank).forEach(function (item) {
          if (kept.size < dimension.targetItemCount) {
            kept.add(item.id);
          }
        });
      }

      pool.forEach(function (item) {
        if (kept.has(item.id)) {
          return;
        }
        survivors.delete(item.id);
        trimmed.push({ id: item.id, dimension: dimension.name, text: item.text });
        trail.recordItemEvent(item.id, { event: 'not-selected', dimension: dimension.name });
      });

      trail.recordDecision(entry, {
        code: 'narrowed_to_target',
        description: dimension.name + ' held ' + pool.length + ' usable items against a target of ' +
          dimension.targetItemCount + '. The ' + surplus + ' adding least were set aside, ranked by ' +
          'outstanding flags, then by how much each overlapped the rest of the dimension.',
        evidence: pool.length + ' to ' + dimension.targetItemCount,
        provenance: PROVENANCE.MEASURED
      });
    });

    return {
      finalItems: items.filter(function (i) { return survivors.has(i.id); }),
      removedDuplicates,
      crossDimensionAlerts,
      distributions,
      trimmed
    };
  }

  return {
    finalItems: items,
    removedDuplicates: [],
    crossDimensionAlerts: [],
    distributions: [],
    trimmed: []
  };
}

function describe(output) {
  const parts = [output.finalItems.length + ' items retained'];
  if (output.removedDuplicates.length > 0) {
    parts.push(output.removedDuplicates.length + ' near-duplicates removed');
  }
  if (output.trimmed && output.trimmed.length > 0) {
    parts.push(output.trimmed.length + ' set aside to meet the target count');
  }
  if (output.crossDimensionAlerts.length > 0) {
    parts.push(output.crossDimensionAlerts.length + ' cross-dimension overlaps flagged for review');
  }
  return parts.join(', ') + '.';
}

function recordInput({ results }) {
  return {
    incoming: results.revision.items.length,
    absoluteFloor: ABSOLUTE_FLOOR,
    deviationMultiplier: DEVIATION_MULTIPLIER
  };
}

module.exports = {
  number: 7,
  name: 'coverage',
  run,
  describe,
  recordInput,
  cosine,
  median,
  medianAbsoluteDeviation,
  ABSOLUTE_FLOOR
};
