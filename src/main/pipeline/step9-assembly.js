// Step 8: final assembly and audit trail.
//
// Composes what the earlier steps produced into two artifacts: the instrument
// itself, and a document a person can read to understand how it came to look
// the way it does.
//
// No model call happens here. Everything this step produces is arrangement and
// arithmetic over structures that already exist, and putting a model between a
// finished pool and a finished document would only introduce a way for the two
// to disagree.

const { PROVENANCE } = require('./audit');
const direction = require('./scales/direction');

// Items are grouped by dimension for reading and interleaved for administration.
// Presenting a dimension as an unbroken block invites respondents to answer the
// block, not the items, which inflates internal consistency without
// improving the instrument. Round-robin interleaving is used instead of a
// shuffle so that two runs of the same pipeline produce the same order.
function interleave(dimensions) {
  const queues = dimensions.map(function (d) { return d.items.slice(); });
  const ordered = [];
  let placed = true;
  while (placed) {
    placed = false;
    queues.forEach(function (queue) {
      if (queue.length > 0) {
        ordered.push(queue.shift());
        placed = true;
      }
    });
  }
  return ordered;
}

// Durations are shown in whichever unit reads naturally at that magnitude. A
// step reported as 0.0s and a step reported as 4ms carry the same information,
// but only one of them looks like a measurement, not a rounding error.
function formatDuration(ms) {
  if (ms === null || ms === undefined) {
    return 'unknown';
  }
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

// The readable document. Structure is fixed so that two trails can be compared
// side by side, and every section appears even when empty, because a missing
// section is indistinguishable from a section nobody wrote.
function renderDocument(trail, instrument) {
  const data = trail.toJSON();
  const counts = trail.counts();
  const lines = [];

  lines.push('AUDIT TRAIL');
  lines.push('Instrument: ' + instrument.construct);
  lines.push('Run: ' + data.runId);
  lines.push('Started: ' + data.startedAt);
  lines.push('Backend: ' + data.settings.backend + ', model ' + data.settings.model);
  lines.push('Items: ' + instrument.itemCount + ' across ' + instrument.dimensions.length + ' dimensions');
  lines.push('Decisions recorded: ' + counts.decisions);
  lines.push('');

  // Placed near the top, not in a footnote. A reader who stops after the
  // first screen should still know if any of this was unverified recall.
  if (counts.unverified > 0) {
    lines.push('UNVERIFIED CONTENT');
    lines.push(counts.unverified + ' entries below came from model recall with no source available');
    lines.push('to check them. Scale names, attributions, and years in those entries may be wrong.');
    lines.push('');
  }

  data.steps.forEach(function (step) {
    lines.push('STEP ' + step.number + ': ' + step.name.toUpperCase());
    lines.push('Status: ' + step.status + ', ' + formatDuration(step.durationMs));
    lines.push(step.summary || '');

    if (step.decisions.length === 0) {
      lines.push('  No decisions recorded.');
    } else {
      // Grouped by provenance so a reader can see at a glance how much of the
      // step was measured and how much was judged.
      [PROVENANCE.MEASURED, PROVENANCE.JUDGED, PROVENANCE.RECALLED, PROVENANCE.USER]
        .forEach(function (provenance) {
          const group = step.decisions.filter(function (d) { return d.provenance === provenance; });
          if (group.length === 0) {
            return;
          }
          lines.push('  ' + provenance + ' (' + group.length + '):');
          group.forEach(function (decision) {
            lines.push('    ' + decision.description);
            if (decision.evidence) {
              lines.push('      evidence: ' + decision.evidence);
            }
          });
        });
    }
    lines.push('');
  });

  lines.push('ITEM HISTORY');
  const history = data.itemHistory;
  const ids = Object.keys(history);
  if (ids.length === 0) {
    lines.push('  No item events recorded.');
  }
  ids.forEach(function (id) {
    const events = history[id];
    // Items that were generated and never touched again do not need a
    // paragraph. Only items with something to explain are written out.
    const notable = events.filter(function (e) {
      return e.event !== 'generated' && !(e.event === 'critiqued' && e.pass === true);
    });
    if (notable.length === 0) {
      return;
    }
    lines.push('  ' + id);
    events.forEach(function (event) {
      if (event.event === 'generated') {
        lines.push('    generated (' + event.direction + '): ' + event.text);
      } else if (event.event === 'revised') {
        lines.push('    revised, round ' + event.iteration + ', addressing ' +
          (event.addressing || []).join(', '));
        lines.push('      from: ' + event.from);
        lines.push('      to:   ' + event.to);
      } else if (event.event === 'dropped') {
        lines.push('    dropped after ' + event.afterIterations + ' rounds: ' +
          (event.reasons || []).join(', '));
      } else if (event.event === 'removed-as-duplicate') {
        lines.push('    removed as near-duplicate of ' + event.of +
          ' at cosine ' + event.similarity.toFixed(3));
      } else if (event.event === 'restored-for-coverage') {
        lines.push('    restored to keep the dimension at target');
      } else if (event.event === 'left-unrevised') {
        lines.push('    left flagged because revision could not run: ' +
          (event.reasons || []).join(', '));
      } else if (event.event === 'cleared') {
        lines.push('    cleared the rubric at round ' + event.iteration);
      }
    });
  });
  lines.push('');

  lines.push('FINAL INSTRUMENT');
  lines.push('Response scale: ' + instrument.scale.scaleLabel);
  lines.push('Anchors: ' + instrument.scale.scaleLabels.join(' / '));
  lines.push('Rationale: ' + instrument.scale.justification);
  lines.push('');
  instrument.dimensions.forEach(function (dimension) {
    lines.push(dimension.name + ' (' + dimension.items.length + ' items)');
    lines.push('  ' + dimension.definition);
    dimension.items.forEach(function (item) {
      lines.push('    ' + item.id + (item.direction === 'reverse' ? ' [R] ' : '     ') + item.text);
    });
    lines.push('');
  });

  return lines.join('\n');
}

async function run({ results, trail, entry }) {
  const scoping = results.scoping;
  const scale = results.scale;
  const items = results.coverage.finalItems;

  // The last place an empty instrument can be caught.
  //
  // Generation refuses to hand on an empty pool, but every step between here
  // and there removes items, so the pool can still arrive empty by attrition:
  // critique rejects, revision drops, coverage narrows. An instrument with no
  // items in it is not a short instrument, and writing one to disk with a
  // serial number and a build date presents a failed run as a delivered one.
  if (items.length === 0) {
    throw new Error(
      'Every item was dropped before assembly. The trail for this run records ' +
      'which step removed them. This usually means the model produced items ' +
      'that could not pass the item standards in Settings, and either a ' +
      'different model or looser standards will get further.'
    );
  }

  const dimensions = scoping.dimensions.map(function (dimension) {
    const owned = items.filter(function (i) { return i.dimension === dimension.name; });
    return {
      name: dimension.name,
      definition: dimension.definition,
      targetItemCount: dimension.targetItemCount,
      items: owned.map(function (item) {
        return { id: item.id, text: item.text, direction: item.direction };
      })
    };
  });

  // A dimension that ended empty is left in the structure, not quietly
  // dropped, so the finished instrument shows what was scoped alongside what
  // survived.
  dimensions.forEach(function (dimension) {
    if (dimension.items.length === 0) {
      trail.recordDecision(entry, {
        code: 'dimension_empty',
        description: dimension.name + ' finished with no items and appears in the instrument as empty.',
        evidence: dimension.name,
        provenance: PROVENANCE.MEASURED
      });
    }
  });

  // Order is stored as identifiers and not as a second copy of the items,
  // so there is one authoritative text per item and no way for the two
  // representations to drift apart during export.
  const administrationOrder = interleave(dimensions).map(function (item) { return item.id; });

  const reverseCount = items.filter(function (i) { return i.direction === 'reverse'; }).length;

  const instrument = {
    construct: scoping.construct,
    dimensions,
    // The scale carries the order it is presented in, so a saved run reproduces
    // the layout it was reviewed with and an export does not have to guess.
    scale: Object.assign({}, scale, { order: direction.DESCENDING }),
    itemCount: items.length,
    reverseKeyedCount: reverseCount,
    administrationOrder,
    generatedAt: new Date().toISOString()
  };

  trail.recordDecision(entry, {
    code: 'administration_order_interleaved',
    description: 'Items are grouped by dimension for reading and interleaved for administration, ' +
      'so respondents do not answer a dimension as a block.',
    evidence: administrationOrder.length + ' positions',
    provenance: PROVENANCE.MEASURED
  });

  // Rendered after the last decision is recorded, so the document includes
  // everything written during this step as well as every earlier one.
  const document = renderDocument(trail, instrument);

  return { instrument, document, counts: trail.counts() };
}

function describe(output) {
  return 'Assembled ' + output.instrument.itemCount + ' items across ' +
    output.instrument.dimensions.length + ' dimensions with ' +
    output.counts.decisions + ' decisions recorded.';
}

function recordInput({ results }) {
  return {
    itemCount: results.coverage.finalItems.length,
    scaleType: results.scale.scaleType
  };
}

module.exports = { number: 9, name: 'assembly', run, describe, recordInput, interleave, renderDocument };
