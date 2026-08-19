// Word export.
//
// This is the one export written for someone other than the person who ran the
// pipeline. JSON carries everything for a machine, CSV carries items for survey
// software, and the text trail carries the reasoning for whoever is checking
// it. A Word document is what gets handed to a client, so it is laid out as a
// document and not as a dump: the instrument first, in the order it would
// be read, and the audit trail behind it as an appendix.
//
// The docx library is the one runtime dependency this application has beyond
// Electron itself. Word documents are zipped OOXML, and while the format is
// open enough to write by hand, doing so would mean maintaining a ZIP writer
// and a schema-conformant XML generator to produce a file that a well
// maintained MIT library already produces correctly.

const docx = require('docx');

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle
} = docx;

// A quiet single rule under table headings and between rows. Word defaults to
// a full grid, which turns an audit table into a spreadsheet and buries the
// text inside it.
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const RULE = { style: BorderStyle.SINGLE, size: 4, color: 'BFC8D2' };
const HEADING_RULE = { style: BorderStyle.SINGLE, size: 8, color: '55606C' };

// Three small helpers, because the docx API is constructor-heavy and building
// a paragraph inline three dozen times would bury the document structure under
// the objects expressing it.
function text(value, options) {
  return new TextRun(Object.assign({ text: String(value === undefined ? '' : value) }, options || {}));
}

function para(children, options) {
  return new Paragraph(Object.assign({
    children: Array.isArray(children) ? children : [children]
  }, options || {}));
}

function cell(children, options) {
  return new TableCell(Object.assign({
    children: Array.isArray(children) ? children : [children],
    margins: { top: 80, bottom: 80, right: 160 }
  }, options || {}));
}

// The appendix table. Word's default is a full grid, which turns an audit
// trail into a spreadsheet and makes the descriptions hard to read, so rows are
// separated by a single hairline and the outer borders are removed entirely.
function auditAppendix(trail) {
  const rows = [
    new TableRow({
      children: [
        cell(para(text('Step', { bold: true, size: 18 })), {
          borders: { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: HEADING_RULE }
        }),
        cell(para(text('Decision', { bold: true, size: 18 })), {
          borders: { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: HEADING_RULE }
        }),
        cell(para(text('Evidence', { bold: true, size: 18 })), {
          borders: { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: HEADING_RULE }
        }),
        cell(para(text('Basis', { bold: true, size: 18 })), {
          borders: { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: HEADING_RULE }
        })
      ],
      tableHeader: true
    })
  ];

  const LABEL = {
    measured: 'Measured',
    judged: 'Model judgment',
    'recalled-unverified': 'Unverified recall',
    'user-supplied': 'Supplied'
  };

  (trail.steps || []).forEach(function (step) {
    step.decisions.forEach(function (decision) {
      const border = { top: NO_BORDER, left: NO_BORDER, right: NO_BORDER, bottom: RULE };
      rows.push(new TableRow({
        children: [
          cell(para(text(step.number, { size: 18, color: '55606C' })), { borders: border }),
          cell(para(text(decision.description, { size: 18 })), { borders: border }),
          cell(para(text(decision.evidence || '', { size: 18, color: '55606C' })), { borders: border }),
          // Unverified recall is the one basis that gets color, matching how
          // it is treated everywhere else in the application.
          cell(para(text(LABEL[decision.provenance] || decision.provenance, {
            size: 18,
            color: decision.provenance === 'recalled-unverified' ? '8A5B00' : '55606C'
          })), { borders: border })
        ]
      }));
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [700, 6200, 1600, 1800]
  });
}

function build({ instrument, trail, input }) {
  const scale = instrument.scale;
  const children = [];

  children.push(para(text(instrument.construct), { heading: HeadingLevel.TITLE }));

  const context = [];
  if (input && input.population) {
    context.push('For ' + input.population + '.');
  }
  if (input && input.purpose) {
    context.push(input.purpose);
  }
  context.push(
    instrument.itemCount + ' items across ' + instrument.dimensions.length +
    ' dimensions, ' + instrument.reverseKeyedCount + ' reverse keyed.'
  );
  children.push(para(text(context.join(' '), { color: '4C5B6B' }), { spacing: { after: 320 } }));

  // The scale comes before the items, because it is what makes them readable.
  // The scale is placed before the items and not after them. It is the
  // shorter block and it is what makes everything below it interpretable.
  children.push(para(text('Response scale'), { heading: HeadingLevel.HEADING_1 }));
  children.push(para(text(scale.scaleLabel + ', ' + scale.polarity + '.', { bold: true })));
  scale.scaleLabels.forEach(function (label, index) {
    children.push(para([
      text((index + 1) + '   ', { color: '4C5B6B' }),
      text(label)
    ], { spacing: { after: 40 } }));
  });
  if (scale.justification) {
    children.push(para(text(scale.justification, { italics: true, color: '4C5B6B' }), {
      spacing: { before: 160, after: 320 }
    }));
  }
  if (scale.requiresTimeFrame) {
    children.push(para(text(
      'This scale reports rates. Each item needs a reference period stating over what span the ' +
      'respondent should answer, and one has not been added automatically.',
      { color: '8A5B00' }
    ), { spacing: { after: 320 } }));
  }

  // Items are grouped by dimension for reading. The administration order is
  // different and deliberately so, and it is stated, not left implicit
  // because someone typing this into survey software needs to know.
  instrument.dimensions.forEach(function (dimension) {
    children.push(para(text(dimension.name), { heading: HeadingLevel.HEADING_1 }));
    children.push(para(text(dimension.definition, { italics: true, color: '4C5B6B' }), {
      spacing: { after: 160 }
    }));

    if (dimension.items.length === 0) {
      children.push(para(text('No items survived for this dimension.', { color: '8A5B00' })));
      return;
    }

    dimension.items.forEach(function (item, index) {
      children.push(para([
        text((index + 1) + '.   ', { color: '4C5B6B' }),
        text(item.text),
        item.direction === 'reverse'
          ? text('   [R]', { color: '8A5B00', size: 18 })
          : text('')
      ], { spacing: { after: 100 } }));
    });
  });

  children.push(para(text(
    'Items are grouped by dimension above for review. For administration they should be ' +
    'presented in mixed order so that respondents do not answer a dimension as a block, ' +
    'which inflates internal consistency without improving the instrument. The CSV export ' +
    'carries that order.',
    { italics: true, color: '4C5B6B' }
  ), { spacing: { before: 320, after: 160 } }));

  children.push(para(text('[R] marks a reverse keyed item, to be recoded before scoring.', {
    italics: true, color: '4C5B6B'
  })));

  // The appendix starts a new page. It is reference material, not
  // something anyone reads straight through from the instrument.
  children.push(para(text('Appendix: audit trail'), {
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true
  }));
  children.push(para(text(
    'Every decision behind this instrument, in the order it was made. Measured entries were ' +
    'computed from the item text and are reproducible. Model judgment entries were assessments ' +
    'against a stated criterion. Unverified recall entries came from the model with no source ' +
    'available to check them.',
    { color: '4C5B6B' }
  ), { spacing: { after: 240 } }));
  children.push(auditAppendix(trail));

  // Calibri at eleven point with one inch margins. Unremarkable on purpose:
  // this document will be opened, edited, and pasted into someone else's
  // template, and a distinctive typeface would survive none of that while
  // making the intermediate steps look broken.
  return new Document({
    creator: 'Chenoot',
    title: instrument.construct,
    description: 'Survey instrument with audit trail',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
        title: { run: { size: 44, bold: true, color: '141D27' }, paragraph: { spacing: { after: 120 } } },
        heading1: {
          run: { size: 26, bold: true, color: '141D27' },
          paragraph: { spacing: { before: 360, after: 120 } }
        }
      }
    },
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children
    }]
  });
}

// Returns a Buffer, not a string, which is why the export handler has to
// know whether a format is binary before writing it.
async function toDocx(run) {
  const document = build({
    instrument: run.instrument,
    trail: run.trail.toJSON ? run.trail.toJSON() : run.trail,
    input: run.trail.toJSON ? run.trail.toJSON().input : (run.trail || {}).input
  });
  return Packer.toBuffer(document);
}

module.exports = { toDocx, build };
