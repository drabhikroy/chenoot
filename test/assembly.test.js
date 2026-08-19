// Tests for Steps 7 and 8, plus an end-to-end run of all eight steps against
// a stub backend. The end-to-end case is the one that would catch a contract
// break between two steps, which no unit test can see.

const test = require('node:test');
const assert = require('node:assert');

const step8 = require('../src/main/pipeline/step8-scale');
const step9 = require('../src/main/pipeline/step9-assembly');
const { steps } = require('../src/main/pipeline');
const { Orchestrator } = require('../src/main/pipeline/orchestrator');
const { AuditTrail } = require('../src/main/pipeline/audit');

const SETTINGS = { backend: 'ollama', model: 'llama3.1:8b', embeddingModel: 'nomic-embed-text' };

// Every required field stated, so the specification gate lets the run through
// and the rest of the pipeline is what is under test.
const COMPLETE_SPECIFICATION = {
  purpose: 'Understand engagement among ward nursing staff.',
  researchQuestions: 'How does engagement differ across wards?\nWhat predicts low engagement?',
  intendedUse: 'Internal staffing review.',
  targetPopulation: 'Hospital nurses',
  mode: 'web'
};

function fresh(number, name) {
  const trail = new AuditTrail({}, SETTINGS);
  return { trail, entry: trail.beginStep(number, name) };
}

function scaleResults(itemTexts) {
  return {
    scoping: {
      construct: 'Work engagement',
      dimensions: [{ name: 'Vigor', definition: 'Energy at work.', targetItemCount: 2 }]
    },
    coverage: {
      finalItems: itemTexts.map(function (text, i) {
        return { id: 'v-0' + (i + 1), dimension: 'Vigor', direction: 'positive', text };
      })
    }
  };
}

test('anchor labels come from the catalog, not from the model', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['I feel strong at work.', 'I have energy to spare.']),
    backend: {
      complete: async function () {
        return {
          scale_type: 'agreement-7',
          polarity: 'bipolar',
          justification: 'Respondents can discriminate finely here.',
          // A model attempting to supply its own labels is ignored entirely.
          scale_labels: ['Nope', 'Wrong', 'Count']
        };
      }
    },
    trail,
    entry
  });
  assert.strictEqual(output.points, 7);
  assert.strictEqual(output.scaleLabels[0], 'Strongly disagree');
  assert.strictEqual(output.hasMidpoint, true);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'scale_labels_from_catalog'; }));
});

test('an unrecognized scale type falls back and says so', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['I feel strong at work.']),
    backend: {
      complete: async function () {
        return { polarity: 'bipolar', scale_type: 'likert-11', justification: 'x' };
      }
    },
    trail,
    entry
  });
  assert.strictEqual(output.scaleType, step8.FALLBACK);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'scale_type_unrecognized'; }));
});

test('a failed scale call still produces a usable scale', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['I feel strong at work.']),
    backend: { complete: async function () { throw new Error('offline'); } },
    trail,
    entry
  });
  assert.strictEqual(output.scaleType, step8.FALLBACK);
  assert.strictEqual(output.scaleLabels.length, 5);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'scale_selection_failed'; }));
});

test('a relative frequency scale over countable behavior is flagged', async function () {
  const { trail, entry } = fresh(8, 'scale');
  await step8.run({
    results: scaleResults([
      'I attend the weekly session.',
      'I submit my work before the deadline.',
      'I email my supervisor with questions.'
    ]),
    backend: {
      complete: async function () {
        return { polarity: 'unipolar', scale_type: 'frequency-vague-5', justification: 'x' };
      }
    },
    trail,
    entry
  });
  // Countable behavior rated with words like "often" carries variance that has
  // nothing to do with the construct, because respondents read those words as
  // different rates. The step says so and not silently substituting.
  assert.ok(entry.decisions.some(function (d) { return d.code === 'frequency_could_be_specific'; }));
});

test('an agreement scale carries the acquiescence advisory', async function () {
  const { trail, entry } = fresh(8, 'scale');
  await step8.run({
    results: scaleResults(['I feel strong at work.']),
    backend: {
      complete: async function () {
        return { polarity: 'bipolar', scale_type: 'agreement-5', justification: 'x' };
      }
    },
    trail,
    entry
  });
  assert.ok(entry.decisions.some(function (d) { return d.code === 'agreement_scale_advisory'; }));
});

test('a unipolar construct can take a unipolar scale', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['Following the instructions takes effort.']),
    backend: {
      complete: async function () {
        return {
          polarity: 'unipolar',
          scale_type: 'difficulty-5',
          justification: 'Items report how demanding the work is.'
        };
      }
    },
    trail,
    entry
  });
  assert.strictEqual(output.polarity, 'unipolar');
  assert.strictEqual(output.scaleLabels[0], 'Not at all difficult');
  assert.strictEqual(output.points, 5);
  // No agreement scale, so no acquiescence advisory.
  assert.ok(!entry.decisions.some(function (d) { return d.code === 'agreement_scale_advisory'; }));
});

test('declared polarity disagreeing with the chosen scale is recorded', async function () {
  const { trail, entry } = fresh(8, 'scale');
  await step8.run({
    results: scaleResults(['I feel strong at work.']),
    backend: {
      complete: async function () {
        return { polarity: 'unipolar', scale_type: 'agreement-5', justification: 'x' };
      }
    },
    trail,
    entry
  });
  assert.ok(entry.decisions.some(function (d) { return d.code === 'polarity_mismatch'; }));
});

test('construct-specific anchors name the construct when it reads as an adjective', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['The material holds my attention.']),
    backend: {
      complete: async function () {
        return {
          polarity: 'unipolar',
          scale_type: 'intensity-5',
          construct_word: 'engaging',
          justification: 'x'
        };
      }
    },
    trail,
    entry
  });
  assert.strictEqual(output.scaleLabels[0], 'Not at all engaging');
  assert.strictEqual(output.scaleLabels[4], 'Extremely engaging');
});

test('a construct word that is not an adjective falls back to generic anchors', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['The material holds my attention.']),
    backend: {
      complete: async function () {
        return {
          polarity: 'unipolar',
          scale_type: 'intensity-5',
          construct_word: 'student engagement',
          justification: 'x'
        };
      }
    },
    trail,
    entry
  });
  assert.ok(!output.scaleLabels[0].includes('student engagement'));
  assert.ok(entry.decisions.some(function (d) { return d.code === 'construct_word_unusable'; }));
});

test('a specific frequency scale asks for a reference period', async function () {
  const { trail, entry } = fresh(8, 'scale');
  const output = await step8.run({
    results: scaleResults(['I attend the weekly session.']),
    backend: {
      complete: async function () {
        return { polarity: 'unipolar', scale_type: 'frequency-specific-6', justification: 'x' };
      }
    },
    trail,
    entry
  });
  assert.strictEqual(output.requiresTimeFrame, true);
  assert.ok(entry.decisions.some(function (d) { return d.code === 'time_frame_required'; }));
});

test('administration order interleaves dimensions, not blocking them', function () {
  const ordered = step9.interleave([
    { name: 'A', items: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] },
    { name: 'B', items: [{ id: 'b1' }, { id: 'b2' }] }
  ]);
  assert.deepStrictEqual(ordered.map(function (i) { return i.id; }), ['a1', 'b1', 'a2', 'b2', 'a3']);
});

test('the pipeline registry is numbered consistently', function () {
  assert.strictEqual(steps.length, 9);
  steps.forEach(function (step, index) {
    assert.strictEqual(step.number, index + 1);
  });
});

// A stub backend that answers each step plausibly, so all eight steps run
// against each other's real output shapes.
function endToEndBackend() {
  const backend = {
    complete: async function (prompt) {
      if (prompt.indexOf('reviewing a survey specification') !== -1) {
        return { gaps: [], undeclared_sensitive_topics: [] };
      }
      if (prompt.indexOf('scoping a psychometric construct') !== -1) {
        return {
          construct: 'Work engagement',
          operationalizable: true,
          dimensions: [
            { name: 'Vigor', definition: 'Energy at work.', target_item_count: 3 },
            { name: 'Absorption', definition: 'Caught up in the work.', target_item_count: 3 }
          ]
        };
      }
      if (prompt.indexOf('Write self-report survey items') !== -1) {
        const dimension = prompt.indexOf('Dimension: Vigor') !== -1 ? 'v' : 'a';
        return {
          items: Array.from({ length: 9 }, function (_x, i) {
            return {
              text: 'I notice my ' + dimension + ' level number ' + i + ' at work.',
              direction: i % 3 === 0 ? 'reverse' : 'positive'
            };
          })
        };
      }
      if (prompt.indexOf('reviewing draft survey items') !== -1) {
        return { judgments: [] };
      }
      if (prompt.indexOf('Items to rewrite') !== -1) {
        return { revisions: [] };
      }
      if (prompt.indexOf('Choose the response scale') !== -1) {
        return { scale_type: 'agreement-5', justification: 'Declarative statements.' };
      }
      return {};
    },
    // Distinct vectors, so nothing is treated as a duplicate.
    embed: async function (text) {
      const seed = text.length;
      return [Math.sin(seed), Math.cos(seed), Math.sin(seed * 2)];
    },
    withModel: function () { return backend; }
  };
  return backend;
}

test('all nine steps run end to end and produce an instrument and a document', async function () {
  const input = {
    construct: 'Work engagement',
    population: 'hospital nurses',
    purpose: 'Staffing review.',
    itemCount: 6,
    specification: COMPLETE_SPECIFICATION
  };
  const trail = new AuditTrail(input, SETTINGS);
  const orchestrator = new Orchestrator({ backend: endToEndBackend(), steps, trail });

  const seen = [];
  orchestrator.on('step:complete', function (event) { seen.push(event.number); });

  const result = await orchestrator.run(input, null);

  assert.strictEqual(result.status, 'complete');
  assert.deepStrictEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const assembly = result.results.assembly;
  assert.ok(assembly.instrument.itemCount > 0);
  assert.strictEqual(assembly.instrument.dimensions.length, 2);
  assert.strictEqual(assembly.instrument.scale.scaleLabels.length, 5);
  assert.strictEqual(
    assembly.instrument.administrationOrder.length,
    assembly.instrument.itemCount
  );

  // Every step wrote a summary, which is what the pipeline view renders.
  trail.toJSON().steps.forEach(function (step) {
    assert.strictEqual(step.status, 'complete');
    assert.ok(step.summary && step.summary.length > 0);
  });

  assert.match(assembly.document, /AUDIT TRAIL/);
  assert.match(assembly.document, /FINAL INSTRUMENT/);
  assert.match(assembly.document, /Strongly disagree/);
});

test('the document warns at the top when unverified recall is present', async function () {
  const input = {
    construct: 'Work engagement',
    population: 'nurses',
    purpose: 'x',
    itemCount: 6,
    allowModelRecall: true,
    specification: COMPLETE_SPECIFICATION
  };
  const trail = new AuditTrail(input, SETTINGS);
  const backend = endToEndBackend();
  const inner = backend.complete;
  backend.complete = async function (prompt) {
    if (prompt.indexOf('calibrating the wording') !== -1) {
      return { reference_scales: [{ name: 'Some Scale', source: 'Someone, 2009', phrasing_notes: 'First person.' }] };
    }
    return inner(prompt);
  };

  const result = await new Orchestrator({ backend, steps, trail }).run(input, null);
  const document = result.results.assembly.document;
  assert.match(document, /UNVERIFIED CONTENT/);
  assert.ok(document.indexOf('UNVERIFIED CONTENT') < document.indexOf('STEP 1'));
});
