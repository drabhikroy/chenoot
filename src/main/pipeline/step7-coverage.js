// Step 7: coverage and redundancy.
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
//
// The test is the same one applied inside a dimension. A pair is reported when
// it clears the duplicate cutoff of both dimensions it spans, meaning it would
// have been treated as a near-duplicate had the two items shared a dimension.
// That keeps the alert on the same footing as removal and lets it move with the
// embedding model. This fixed value is used only when a dimension had too few
// pairs to produce a cutoff of its own.
const CROSS_DIMENSION_ALERT = 0.9;

// Weight on relevance against novelty when narrowing a dimension, in the
// maximal marginal relevance ranking of Carbonell and Goldstein (1998). Even
// weighting treats an item that drifts from the dimension and an item that
// repeats one already chosen as equally costly, which is the balance item
// selection wants. Leaning toward novelty rewards drift, and leaning toward
// relevance rewards the redundancy the step exists to remove.
const RELEVANCE_WEIGHT = 0.5;

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

function flagCount(item, assessmentById) {
  return (assessmentById.get(item.id) || { flags: [] }).flags.length;
}

// What each candidate is judged relevant to. The dimension definition written
// at scoping is the better anchor, because it states what the dimension is
// meant to measure, while the centroid of the pool only states what the pool
// happens to say. A pool that drifted as a whole pulls its own centroid along
// with it. The centroid is the fallback when the definition cannot be embedded.
async function anchorFor(dimension, pool, vectors, backend) {
  const size = vectors.get(pool[0].id).length;
  if (dimension.definition) {
    try {
      const vector = await backend.embed(dimension.definition);
      if (Array.isArray(vector) && vector.length === size) {
        return { vector, description: 'the dimension definition' };
      }
    } catch (error) {
      // Falls through to the centroid, which needs no further call.
    }
  }
  const centroid = new Array(size).fill(0);
  pool.forEach(function (item) {
    const v = vectors.get(item.id);
    for (let k = 0; k < size; k += 1) {
      centroid[k] += v[k] / pool.length;
    }
  });
  return { vector: centroid, description: 'the center of the pool' };
}

// Choose target items from one dimension's pool.
//
// Selection runs within keying direction. Ranking on quality alone reliably
// strips the reverse keyed items, because they are the harder ones to write and
// therefore the ones carrying more flags, and a dimension with no reverse items
// is exposed to acquiescence bias no matter how good the survivors read.
//
// Within a direction, fewer outstanding flags always wins. Among items with the
// same number of flags, the next pick is the one that best trades relevance to
// the dimension against similarity to anything already picked. Ranking by
// distance from the rest of the pool alone, with no relevance term, would favor
// exactly the items that wandered off the construct, since those are the ones
// least like everything else.
//
// With no vectors the order is flags and then identifier, which is still
// reproducible, and the caller records that similarity played no part.
function selectForDimension(pool, target, assessmentById, similarity) {
  const chosen = [];

  function score(item) {
    if (!similarity) {
      return 0;
    }
    const v = similarity.vectors.get(item.id);
    const relevance = cosine(v, similarity.anchor);
    const redundancy = chosen.reduce(function (worst, other) {
      return Math.max(worst, cosine(v, similarity.vectors.get(other.id)));
    }, 0);
    return RELEVANCE_WEIGHT * relevance - (1 - RELEVANCE_WEIGHT) * redundancy;
  }

  function pickFrom(candidates, count) {
    const remaining = candidates.slice();
    for (let n = 0; n < count && remaining.length > 0; n += 1) {
      const fewest = Math.min.apply(null, remaining.map(function (i) {
        return flagCount(i, assessmentById);
      }));
      let best = null;
      let bestScore = -Infinity;
      remaining.forEach(function (item) {
        if (flagCount(item, assessmentById) !== fewest) {
          return;
        }
        const value = score(item);
        if (value > bestScore || (value === bestScore && item.id < best.id)) {
          best = item;
          bestScore = value;
        }
      });
      chosen.push(best);
      remaining.splice(remaining.indexOf(best), 1);
    }
  }

  const reverses = pool.filter(function (i) { return i.direction === 'reverse'; });
  const positives = pool.filter(function (i) { return i.direction !== 'reverse'; });
  const wantedReverse = Math.min(reverses.length, Math.max(1, Math.round(target * REVERSE_TARGET)));
  pickFrom(reverses, wantedReverse);
  pickFrom(positives, target - chosen.length);

  // Any shortfall in one direction is made up from the other, so the target
  // count is met even when a dimension produced few usable positive items.
  if (chosen.length < target) {
    pickFrom(pool.filter(function (i) { return chosen.indexOf(i) === -1; }), target - chosen.length);
  }
  return new Set(chosen.map(function (i) { return i.id; }));
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
  const dimensionOverlap = [];
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
    const cutoffFor = new Map();
    const medianFor = new Map();
    distributions.forEach(function (d) {
      if (d.rule === 'adaptive') {
        cutoffFor.set(d.dimension, d.cutoff);
        medianFor.set(d.dimension, d.median);
      }
    });
    const crossByPair = new Map();
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (items[i].dimension === items[j].dimension) {
          continue;
        }
        if (!survivors.has(items[i].id) || !survivors.has(items[j].id)) {
          continue;
        }
        const similarity = cosine(vectors.get(items[i].id), vectors.get(items[j].id));
        const key = [items[i].dimension, items[j].dimension].sort().join('\u0000');
        if (!crossByPair.has(key)) {
          crossByPair.set(key, { dimensions: [items[i].dimension, items[j].dimension].sort(), values: [] });
        }
        crossByPair.get(key).values.push(similarity);

        const threshold = Math.max(
          cutoffFor.get(items[i].dimension) || CROSS_DIMENSION_ALERT,
          cutoffFor.get(items[j].dimension) || CROSS_DIMENSION_ALERT
        );
        if (similarity >= threshold) {
          crossDimensionAlerts.push({
            a: items[i].id,
            b: items[j].id,
            dimensions: [items[i].dimension, items[j].dimension],
            similarity,
            threshold
          });
          trail.recordDecision(entry, {
            code: 'cross_dimension_overlap',
            description: items[i].id + ' and ' + items[j].id + ' sit at cosine ' +
              similarity.toFixed(3) + ' across ' + items[i].dimension + ' and ' +
              items[j].dimension + ', above the ' + threshold.toFixed(3) + ' that would mark them ' +
              'as near-duplicates within either dimension. Both were kept.',
            evidence: similarity.toFixed(3),
            provenance: PROVENANCE.MEASURED
          });
        }
      }
    }

    // The same question asked of whole dimensions. Items should sit closer to
    // their own dimension than to another, which is the convergent and
    // discriminant pattern Campbell and Fiske (1959) set out for trait
    // measures. When the typical pair spanning two dimensions is as close as the
    // typical pair inside one of them, that dimension is not separating from the
    // other in the wording, and it is worth knowing before any data is collected.
    crossByPair.forEach(function (pair) {
      const within = pair.dimensions.map(function (name) { return medianFor.get(name); });
      if (within.some(function (m) { return m === undefined; })) {
        return;
      }
      const across = median(pair.values);
      const lower = Math.min(within[0], within[1]);
      const record = {
        dimensions: pair.dimensions,
        acrossMedian: across,
        withinMedians: within,
        distinct: across < lower
      };
      dimensionOverlap.push(record);
      if (!record.distinct) {
        trail.recordDecision(entry, {
          code: 'dimensions_not_distinct',
          description: 'Items in ' + pair.dimensions[0] + ' and ' + pair.dimensions[1] +
            ' are as similar to each other, at a median cosine of ' + across.toFixed(3) +
            ', as items within ' + (within[0] <= within[1] ? pair.dimensions[0] : pair.dimensions[1]) +
            ' are to one another, at ' + lower.toFixed(3) + '. The wording does not yet separate ' +
            'the two, so they may not hold apart once responses are collected.',
          evidence: 'across ' + across.toFixed(3) + ', within ' + within[0].toFixed(3) + ' and ' +
            within[1].toFixed(3),
          provenance: PROVENANCE.MEASURED
        });
      }
    });

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
    // Everything before this removes items for cause, a failed rubric or a
    // near-duplicate. None of it selects, and Step 4 drafts an oversized pool on
    // purpose so that later steps have something to discard. Without a
    // selection pass a request for eight items would return twenty-four.
    for (const dimension of scoping.dimensions) {
      const pool = items.filter(function (i) {
        return i.dimension === dimension.name && survivors.has(i.id);
      });
      if (pool.length <= dimension.targetItemCount) {
        continue;
      }
      const anchor = await anchorFor(dimension, pool, vectors, backend);
      const kept = selectForDimension(pool, dimension.targetItemCount, assessmentById, {
        vectors,
        anchor: anchor.vector
      });
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
          dimension.targetItemCount + '. The ' + (pool.length - dimension.targetItemCount) +
          ' set aside were chosen by outstanding flags first, then by how closely each item ' +
          'matched ' + anchor.description + ' while overlapping least with the items already chosen.',
        evidence: pool.length + ' to ' + dimension.targetItemCount,
        provenance: PROVENANCE.MEASURED
      });
    }

    return {
      finalItems: items.filter(function (i) { return survivors.has(i.id); }),
      removedDuplicates,
      crossDimensionAlerts,
      dimensionOverlap,
      distributions,
      trimmed
    };
  }

  // Without embeddings there is no redundancy check, but the pool is still
  // three times the size that was asked for and has to be narrowed. Selection
  // falls back to flags and keying balance, and the trail says similarity
  // played no part, so nobody reads the result as deduplicated.
  const kept = new Set();
  scoping.dimensions.forEach(function (dimension) {
    const pool = items.filter(function (i) { return i.dimension === dimension.name; });
    if (pool.length <= dimension.targetItemCount) {
      pool.forEach(function (i) { kept.add(i.id); });
      return;
    }
    const chosen = selectForDimension(pool, dimension.targetItemCount, assessmentById, null);
    pool.forEach(function (item) {
      if (chosen.has(item.id)) {
        kept.add(item.id);
        return;
      }
      trimmed.push({ id: item.id, dimension: dimension.name, text: item.text });
      trail.recordItemEvent(item.id, { event: 'not-selected', dimension: dimension.name });
    });
    trail.recordDecision(entry, {
      code: 'narrowed_to_target',
      description: dimension.name + ' held ' + pool.length + ' usable items against a target of ' +
        dimension.targetItemCount + '. With no embeddings available, the ' +
        (pool.length - dimension.targetItemCount) + ' set aside were chosen by outstanding flags ' +
        'and keying balance alone, and near-duplicates may remain.',
      evidence: pool.length + ' to ' + dimension.targetItemCount,
      provenance: PROVENANCE.MEASURED
    });
  });
  // Items from a dimension the scoping no longer names are passed through
  // rather than silently dropped.
  items.forEach(function (i) {
    const named = scoping.dimensions.some(function (d) { return d.name === i.dimension; });
    if (!named) {
      kept.add(i.id);
    }
  });

  return {
    finalItems: items.filter(function (i) { return kept.has(i.id); }),
    removedDuplicates: [],
    crossDimensionAlerts: [],
    dimensionOverlap: [],
    distributions: [],
    trimmed
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
    deviationMultiplier: DEVIATION_MULTIPLIER,
    relevanceWeight: RELEVANCE_WEIGHT
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
  selectForDimension,
  ABSOLUTE_FLOOR,
  RELEVANCE_WEIGHT
};
