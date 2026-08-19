// Tests for the survey platform exports.
//
// Each of these targets a format defined by somebody else, so what is worth
// pinning is conformance to their rules instead of anything about how the
// output reads.

const test = require('node:test');
const assert = require('node:assert');
const platforms = require('../src/main/exports-platforms');

const RUN = {
  instrument: {
    construct: 'Work engagement',
    itemCount: 3,
    dimensions: [{
      name: 'Vigor',
      definition: 'Energy brought to the work.',
      items: [
        { id: 'vigor-01', text: 'I feel strong at work.', direction: 'positive' },
        { id: 'vigor-02', text: 'I run out of steam, quickly.', direction: 'reverse' },
        { id: 'vigor-03', text: 'What gives you energy?', direction: null, format: 'open-text' }
      ]
    }],
    scale: {
      scaleType: 'agreement-5',
      scaleLabels: ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree']
    }
  }
};

test('qualtrics output opens with the advanced format marker', function () {
  const { contents } = platforms.toQualtrics(RUN);
  // Without this first line Qualtrics treats the whole file as plain text.
  assert.ok(contents.startsWith('[[AdvancedFormat]]'));
  assert.ok(contents.includes('[[Block:Vigor]]'));
  assert.ok(contents.includes('[[Choices]]'));
});

test('qualtrics emits open items as text entry, not as choices', function () {
  const { contents } = platforms.toQualtrics(RUN);
  assert.ok(contents.includes('[[Question:TE:Essay]]'));
});

test('redcap field names are legal', function () {
  // Lowercase, digits, and underscores only, and never starting with a digit.
  assert.strictEqual(platforms.redcapName('vigor-01'), 'vigor_01');
  assert.strictEqual(platforms.redcapName('01-item'), 'q_01_item');
  assert.ok(/^[a-z_][a-z0-9_]*$/.test(platforms.redcapName('Work Engagement!')));
});

test('redcap carries the full column header', function () {
  const { contents } = platforms.toRedcap(RUN);
  const header = contents.split('\n')[0];
  // REDCap rejects a dictionary missing any column, even an unused one.
  assert.ok(header.includes('Variable / Field Name'));
  assert.ok(header.includes('Field Annotation'));
  assert.strictEqual(header.split(',').length >= 18, true);
});

test('redcap codes stay on the ascending scale whichever way the anchors read', function () {
  // The default prints the most positive anchor first, so the choice list opens
  // with the top of the scale. The code beside it has to stay the top of the
  // scale too. Numbering the presented list from one instead would read
  // correctly and score backwards, which is the worst of both.
  const { contents } = platforms.toRedcap(RUN);
  assert.ok(contents.includes('5, Strongly agree | 4, Agree'), contents.slice(0, 400));
  assert.ok(contents.includes('1, Strongly disagree'));
});

test('reversing the presentation does not move the codes', function () {
  const reversed = JSON.parse(JSON.stringify(RUN));
  reversed.instrument.scale.order = 'negative-first';
  const { contents } = platforms.toRedcap(reversed);
  // Same pairings, opposite order on the page.
  assert.ok(contents.includes('1, Strongly disagree | 2, Disagree'));
  assert.ok(contents.includes('5, Strongly agree'));
});

test('redcap notes reverse keying, not recoding it', function () {
  // Recoding belongs in analysis. An instrument that silently inverts an item
  // is one nobody can check against the wording they approved.
  const { contents } = platforms.toRedcap(RUN);
  assert.ok(contents.includes('Reverse keyed'));
});

test('redcap escapes fields containing commas', function () {
  const { contents } = platforms.toRedcap(RUN);
  assert.ok(contents.includes('"I run out of steam, quickly."'));
});

test('google forms output is a runnable script with instructions', function () {
  const { contents, fileName } = platforms.toGoogleForms(RUN);
  assert.ok(fileName.endsWith('.gs'));
  assert.ok(contents.includes('function buildForm()'));
  assert.ok(contents.includes('FormApp.create'));
  // Google Forms has no import format, so the file has to explain itself.
  assert.ok(contents.includes('script.google.com'));
});

test('google forms escapes text into valid javascript', function () {
  const tricky = JSON.parse(JSON.stringify(RUN));
  tricky.instrument.dimensions[0].items[0].text = 'He said "yes" to it.';
  const { contents } = platforms.toGoogleForms(tricky);
  assert.ok(contents.includes('\\"yes\\"'));
});

test('plain output carries no markup', function () {
  const { contents } = platforms.toPlain(RUN);
  // Anything a bulk paste box does not understand arrives as literal characters
  // inside a question.
  assert.ok(!contents.includes('[['));
  assert.ok(!contents.includes('**'));
  assert.ok(contents.includes('I feel strong at work.'));
});

test('an item with its own format uses its own anchors', function () {
  const item = { id: 'x', text: 'y', format: 'agreement-7' };
  const anchors = platforms.anchorsFor(item, RUN.instrument);
  assert.strictEqual(anchors.length, 7);
});

test('an unknown platform is refused by name', function () {
  assert.throws(function () { platforms.write('typeform', RUN); }, /Unknown platform/);
});
