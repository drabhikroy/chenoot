// Tests for the export writers.
//
// The settings module is not tested here because it requires the Electron app
// and safeStorage modules, which do not load outside a running Electron
// process. Its behavior is covered by the writable-key list being a literal
// array, not logic, and by the keychain path failing loudly.

const test = require('node:test');
const assert = require('node:assert');

const exporters = require('../src/main/exports');
const platforms = require('../src/main/exports-platforms');

const INSTRUMENT = {
  construct: 'Work engagement',
  dimensions: [
    {
      name: 'Vigor',
      definition: 'Energy brought to the work.',
      items: [
        { id: 'vigor-01', text: 'I feel strong at work.', direction: 'positive' },
        { id: 'vigor-02', text: 'I run out of steam, quickly.', direction: 'reverse' }
      ]
    },
    {
      name: 'Absorption',
      definition: 'Being caught up in the work.',
      items: [
        { id: 'absorption-01', text: 'Time passes quickly for me here.', direction: 'positive' }
      ]
    }
  ],
  scale: {
    scaleType: 'agreement-5',
    scaleLabel: 'Five-point agreement',
    scaleLabels: ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'],
    points: 5,
    justification: 'Declarative statements.'
  },
  itemCount: 3,
  reverseKeyedCount: 1,
  administrationOrder: ['vigor-01', 'absorption-01', 'vigor-02']
};

const RUN = {
  instrument: INSTRUMENT,
  document: 'AUDIT TRAIL\nInstrument: Work engagement\n',
  trail: {
    toJSON: function () {
      return {
        runId: 'run-test',
        input: { population: 'hospital nurses', purpose: 'Annual staff survey.' },
        steps: [{
          number: 1,
          decisions: [{ description: 'Scoped into two dimensions.', evidence: '2', provenance: 'measured' }]
        }]
      };
    }
  }
};

test('a field containing a comma is quoted', function () {
  assert.strictEqual(exporters.csvField('I run out of steam, quickly.'), '"I run out of steam, quickly."');
});

test('an embedded quote is doubled', function () {
  assert.strictEqual(exporters.csvField('She said "yes"'), '"She said ""yes"""');
});

test('a plain field is left alone', function () {
  assert.strictEqual(exporters.csvField('I feel strong at work.'), 'I feel strong at work.');
});

test('csv rows follow administration order, not grouped order', function () {
  const { contents } = exporters.toCsv(RUN);
  const rows = contents.trim().split('\n');
  assert.strictEqual(rows.length, 4);
  assert.ok(rows[1].startsWith('1,vigor-01'));
  assert.ok(rows[2].startsWith('2,absorption-01'));
  assert.ok(rows[3].startsWith('3,vigor-02'));
});

test('csv ends with a newline', function () {
  assert.ok(exporters.toCsv(RUN).contents.endsWith('\n'));
});

test('json export carries the instrument and the trail together', function () {
  const parsed = JSON.parse(exporters.toJson(RUN).contents);
  assert.strictEqual(parsed.instrument.construct, 'Work engagement');
  assert.strictEqual(parsed.auditTrail.runId, 'run-test');
});

test('file names are derived from the construct and are filesystem safe', function () {
  assert.strictEqual(exporters.safeName('Work engagement'), 'work-engagement');
  assert.strictEqual(exporters.safeName('Burnout / Exhaustion!'), 'burnout-exhaustion');
  assert.strictEqual(exporters.safeName('!!!'), 'instrument');
});

test('formats that are not plain text say which kind they are', function () {
  // Three different reasons a format has no text writer, and each says which.
  assert.throws(function () { exporters.write('pdf', RUN); }, /produced by printing/);
  assert.throws(function () { exporters.write('docx', RUN); }, /binary/);
  assert.throws(function () { exporters.write('rtf', RUN); }, /Unknown export format/);
});

test('word export produces a valid package', async function () {
  const payload = await exporters.writeBinary('docx', RUN);
  assert.ok(Buffer.isBuffer(payload.contents));
  assert.strictEqual(payload.fileName, 'work-engagement.docx');
  // A docx is a zip, and every zip starts with these two bytes. Checking the
  // signature catches a truncated or empty write, which is the failure mode
  // that would otherwise reach someone as a file Word refuses to open.
  assert.strictEqual(payload.contents.slice(0, 2).toString(), 'PK');
  assert.ok(payload.contents.length > 4000);
});

test('an unknown binary format is refused by name', async function () {
  await assert.rejects(
    exporters.writeBinary('pages', RUN),
    /Unknown binary export format/
  );
});

// ---- Qualtrics survey file -----------------------------------------------
//
// The export was named for Qualtrics and produced Advanced Format text. That is
// a real Qualtrics import path and the one Qualtrics documents, but a file
// called qualtrics.txt is not what somebody means when they ask for a Qualtrics
// export: they mean the .qsf that Qualtrics itself writes and reads.
//
// The qsf structure is not published. These tests hold the parts that were
// derived from files Qualtrics produces, so a later change to the writer cannot
// quietly drop one of them. They do not establish that Qualtrics accepts the
// file, which needs a Qualtrics account to find out.

const QUALTRICS_FIXTURE = {
  construct: 'Work attitudes',
  scale: {
    scaleType: 'agreement-5',
    scaleLabels: ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree']
  },
  dimensions: [
    {
      name: 'Autonomy',
      items: [
        { id: 'aut-01', text: 'I decide how to do my work.', direction: 'positive' },
        { id: 'aut-02', text: 'Describe a recent decision.', format: 'open-text' }
      ]
    },
    { name: 'Empty', items: [] }
  ]
};

test('the qualtrics export is a parseable qsf', function () {
  const out = platforms.toQualtricsSurveyFile({ instrument: QUALTRICS_FIXTURE });
  assert.match(out.fileName, /\.qsf$/);
  const parsed = JSON.parse(out.contents);
  assert.strictEqual(parsed.SurveyEntry.SurveyName, 'Work attitudes');
  // Qualtrics identifiers carry a fixed prefix, and the same one has to appear
  // on every element or the file describes two different surveys.
  assert.match(parsed.SurveyEntry.SurveyID, /^SV_[0-9A-F]{16}$/);
  parsed.SurveyElements.forEach(function (element) {
    assert.strictEqual(element.SurveyID, parsed.SurveyEntry.SurveyID);
  });
});

test('each dimension becomes a block and empty dimensions are left out', function () {
  const parsed = JSON.parse(platforms.toQualtricsSurveyFile({ instrument: QUALTRICS_FIXTURE }).contents);
  const blocks = parsed.SurveyElements.find(function (e) { return e.Element === 'BL'; }).Payload;
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].Description, 'Autonomy');
  assert.strictEqual(blocks[0].BlockElements.length, 2);
  // A block in the file that no flow entry reaches is a block Qualtrics does
  // not show.
  const flow = parsed.SurveyElements.find(function (e) { return e.Element === 'FL'; }).Payload;
  assert.deepStrictEqual(flow.Flow.map(function (f) { return f.ID; }), [blocks[0].ID]);
});

test('scale items carry their anchors and open items carry none', function () {
  const parsed = JSON.parse(platforms.toQualtricsSurveyFile({ instrument: QUALTRICS_FIXTURE }).contents);
  const questions = parsed.SurveyElements.filter(function (e) { return e.Element === 'SQ'; });
  assert.strictEqual(questions[0].Payload.QuestionType, 'MC');
  assert.strictEqual(Object.keys(questions[0].Payload.Choices).length, 5);
  assert.strictEqual(questions[0].Payload.Choices['1'].Display, 'Strongly disagree');
  // Text entry takes no choices at all; an empty choice map is not the same
  // thing and Qualtrics renders it as a broken multiple choice.
  assert.strictEqual(questions[1].Payload.QuestionType, 'TE');
  assert.strictEqual(questions[1].Payload.Choices, undefined);
});

test('the item identifier travels as the export tag', function () {
  // Which is what lets a question found in Qualtrics be traced back to the
  // audit trail for the run that produced it.
  const parsed = JSON.parse(platforms.toQualtricsSurveyFile({ instrument: QUALTRICS_FIXTURE }).contents);
  const tags = parsed.SurveyElements
    .filter(function (e) { return e.Element === 'SQ'; })
    .map(function (e) { return e.Payload.DataExportTag; });
  assert.deepStrictEqual(tags, ['aut-01', 'aut-02']);
});

test('the advanced format writer is still available under its own name', function () {
  // It is the documented import path and it did not stop working because a
  // second one was added.
  assert.ok(platforms.PLATFORMS['qualtrics-txt']);
  const out = platforms.PLATFORMS['qualtrics-txt'].write({ instrument: QUALTRICS_FIXTURE });
  assert.match(out.fileName, /\.txt$/);
  assert.match(out.contents, /\[\[AdvancedFormat\]\]/);
});
