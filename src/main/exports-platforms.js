// Exports targeting survey platforms.
//
// What each of these is, because they are not equivalent and pretending they
// are would waste people's time.
//
// QUALTRICS has a documented plain-text import called Advanced Format. It
// carries blocks, question types, and choice lists, so a finished instrument
// arrives with its dimensions as blocks and its anchors attached. This is a
// real import path, not a convenience.
//
// REDCAP has a data dictionary CSV that defines an instrument completely, and
// it is the most complete of the formats here: field names, types, and coded
// choice values all travel. For evaluation work that ends up in REDCap this is
// the export that saves the most work.
//
// GOOGLE FORMS has no import format at all. What it has is Apps Script, so the
// export is a script that builds the form when run. That is a heavier ask of
// the person than a file upload and it is the only route that exists.
//
// SURVEYMONKEY and most other platforms accept pasted question text in a bulk
// entry box and nothing more structured. The plain export is written for that:
// one question per block, choices beneath, no markup that would arrive as
// literal characters.
//
// None of these carry the audit trail. They carry the instrument, because that
// is what a survey platform can hold, and the trail travels in the JSON, Word,
// and text exports instead.

const { CATALOG } = require('./pipeline/scales/catalog');
const direction = require('./pipeline/scales/direction');

// The anchors an item is answered on. An item carrying its own format uses that
// format's anchors; everything else uses the instrument's.
// The anchors for one item, in the order they are printed.
//
// Three sources, most specific first: options written for this item, the
// catalog entry for a format this item overrides to, or the instrument scale.
// Whichever it is, the presentation order is applied last, so a reversed
// instrument reverses every item that has not chosen its own direction.
function anchorsFor(item, instrument) {
  const stored = item.responseOptions && item.responseOptions.length > 0
    ? item.responseOptions
    : (item.format && CATALOG[item.format])
      ? CATALOG[item.format].labels
      : instrument.scale.scaleLabels;
  return direction.presentedAnchors(stored, direction.orderFor(item, instrument));
}

// Whether an item is answered on a scale at all. Open text, numeric, and date
// items have no choice list and have to be emitted as a different question type.
function isOpen(item) {
  return Boolean(item.format) && !CATALOG[item.format] && !item.responseOptions;
}

function safeName(construct) {
  return String(construct)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'instrument';
}

// ---- Qualtrics ------------------------------------------------------------
// Two writers, because Qualtrics takes two different things and people ask for
// them by different names.
//
// Advanced Format is a text file pasted into the survey importer. It is the
// path Qualtrics documents, it is stable, and it is what this exported first.
//
// A .qsf is the survey file Qualtrics writes when you export a survey, and it
// is what most people mean when they say they want to import into Qualtrics.
// The format is not published: the structure below was built from the shape of
// files Qualtrics itself produces. It carries the questions, their choices, and
// one block per dimension, and it deliberately leaves out the survey options,
// themes, and flow logic that a real export contains, because inventing values
// for fields whose meaning is not documented is how an import fails with no
// explanation. Qualtrics fills those in on import.

function qualtricsSurveyId() {
  // Qualtrics identifiers are a fixed prefix and sixteen hexadecimal digits.
  // The value only has to be unique within the file, so it is derived from the
  // clock rather than from a random source, which keeps a rebuilt export of the
  // same instrument comparable to the one before it.
  const stamp = Date.now().toString(16).padStart(16, '0').slice(-16).toUpperCase();
  return 'SV_' + stamp;
}

function questionElement(item, choices, questionId, points) {
  const open = choices === null;
  const payload = {
    QuestionText: item.text,
    QuestionID: questionId,
    QuestionType: open ? 'TE' : 'MC',
    Selector: open ? 'ML' : 'SAVR',
    SubSelector: open ? undefined : 'TX',
    // The label Qualtrics shows in its own editor rather than to a respondent.
    // Using the item identifier means a question found in Qualtrics can be
    // traced back to the audit trail for this run.
    DataExportTag: item.id,
    QuestionDescription: item.text.slice(0, 100),
    Validation: { Settings: { ForceResponse: 'OFF', Type: 'None' } },
    Language: []
  };

  if (!open) {
    // The key Qualtrics stores against a response is the choice identifier, and
    // ChoiceOrder decides what a respondent sees first. Keeping the identifier
    // on the ascending point and putting the presentation in ChoiceOrder means
    // a reversed scale reads the new way and still scores the old way.
    const choiceMap = {};
    const order = [];
    choices.forEach(function (label, index) {
      const key = String(points[index]);
      choiceMap[key] = { Display: label };
      order.push(key);
    });
    payload.Choices = choiceMap;
    payload.ChoiceOrder = order;
  }

  return {
    SurveyID: null,
    Element: 'SQ',
    PrimaryAttribute: questionId,
    SecondaryAttribute: item.text.slice(0, 100),
    TertiaryAttribute: null,
    Payload: payload
  };
}

function toQualtricsSurveyFile({ instrument }) {
  const surveyId = qualtricsSurveyId();
  const elements = [];
  const blocks = [];
  const flow = [];
  let questionNumber = 0;
  let blockNumber = 0;

  instrument.dimensions.forEach(function (dimension) {
    if (dimension.items.length === 0) {
      return;
    }
    blockNumber += 1;
    const blockId = 'BL_' + String(blockNumber).padStart(16, '0');
    const elementsInBlock = [];

    dimension.items.forEach(function (item) {
      questionNumber += 1;
      const questionId = 'QID' + questionNumber;
      const choices = isOpen(item) ? null : anchorsFor(item, instrument);
      const points = choices
        ? direction.pointsFor(choices.length, direction.orderFor(item, instrument))
        : [];
      elements.push(questionElement(item, choices, questionId, points));
      elementsInBlock.push({ Type: 'Question', QuestionID: questionId });
    });

    blocks.push({
      Type: 'Standard',
      Description: dimension.name,
      ID: blockId,
      BlockElements: elementsInBlock
    });
    flow.push({ Type: 'Block', ID: blockId, FlowID: 'FL_' + blockNumber, Autofill: [] });
  });

  const survey = {
    SurveyEntry: {
      SurveyID: surveyId,
      SurveyName: instrument.construct,
      SurveyDescription: null,
      SurveyStatus: 'Inactive',
      SurveyLanguage: 'EN',
      SurveyCreationDate: new Date().toISOString(),
      LastModified: new Date().toISOString()
    },
    SurveyElements: [
      {
        SurveyID: surveyId,
        Element: 'BL',
        PrimaryAttribute: 'Survey Blocks',
        SecondaryAttribute: null,
        TertiaryAttribute: null,
        Payload: blocks
      },
      {
        SurveyID: surveyId,
        Element: 'FL',
        PrimaryAttribute: 'Survey Flow',
        SecondaryAttribute: null,
        TertiaryAttribute: null,
        Payload: { Type: 'Root', FlowID: 'FL_1', Flow: flow, Properties: { Count: flow.length } }
      }
    ].concat(elements.map(function (element) {
      return Object.assign({}, element, { SurveyID: surveyId });
    }))
  };

  return {
    fileName: safeName(instrument.construct) + '.qsf',
    contents: JSON.stringify(survey, null, 2)
  };
}


// Advanced Format. Dimensions become blocks, which is what Qualtrics uses for
// randomisation and page breaks, so the structure survives instead of arriving
// as one long list.
function toQualtrics({ instrument }) {
  const lines = ['[[AdvancedFormat]]', ''];

  instrument.dimensions.forEach(function (dimension) {
    if (dimension.items.length === 0) {
      return;
    }
    lines.push('[[Block:' + dimension.name + ']]', '');

    dimension.items.forEach(function (item) {
      if (isOpen(item)) {
        lines.push('[[Question:TE:Essay]]');
        lines.push(item.text);
        lines.push('');
        return;
      }
      lines.push('[[Question:MC:SingleAnswer:Vertical]]');
      lines.push(item.text);
      lines.push('[[Choices]]');
      anchorsFor(item, instrument).forEach(function (label) {
        lines.push(label);
      });
      lines.push('');
    });
  });

  return {
    fileName: safeName(instrument.construct) + '-qualtrics.txt',
    contents: lines.join('\n')
  };
}

// ---- REDCap ---------------------------------------------------------------
// Data dictionary CSV. The column order is fixed by REDCap and every column has
// to be present even when empty, so they are written out in full and not
// only the ones carrying values.
const REDCAP_COLUMNS = [
  'Variable / Field Name', 'Form Name', 'Section Header', 'Field Type', 'Field Label',
  'Choices, Calculations, OR Slider Labels', 'Field Note',
  'Text Validation Type OR Show Slider Number', 'Text Validation Min', 'Text Validation Max',
  'Identifier?', 'Branching Logic (Show field only if...)', 'Required Field?',
  'Custom Alignment', 'Question Number (surveys only)', 'Matrix Group Name', 'Matrix Ranking?',
  'Field Annotation'
];

function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function redcapName(id) {
  // REDCap field names allow lowercase letters, numbers, and underscores only,
  // and must not begin with a number.
  const cleaned = String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[0-9]/.test(cleaned) ? 'q_' + cleaned : cleaned;
}

function toRedcap({ instrument }) {
  const formName = redcapName(instrument.construct) || 'instrument';
  const rows = [REDCAP_COLUMNS.map(csvField).join(',')];

  instrument.dimensions.forEach(function (dimension) {
    let first = true;
    dimension.items.forEach(function (item) {
      const open = isOpen(item);
      // Coded values start at one and run up, which is what REDCap expects and
      // what most analysis assumes. Reverse keying is noted, not applied,
      // since recoding belongs in analysis, not in the instrument.
      // The order is the presented one and the code is the ascending point, so
      // reversing how a scale reads never changes what a response is worth.
      // Numbering the presented list from one instead would silently invert
      // every score in the dataset.
      const anchors = open ? [] : anchorsFor(item, instrument);
      const codes = direction.pointsFor(anchors.length, direction.orderFor(item, instrument));
      const choices = open
        ? ''
        : anchors
          .map(function (label, index) { return codes[index] + ', ' + label; })
          .join(' | ');

      rows.push([
        redcapName(item.id),
        formName,
        // The dimension name is carried as a section header on its first item,
        // which is how REDCap groups fields on a page.
        first ? dimension.name : '',
        open ? 'text' : 'radio',
        item.text,
        choices,
        item.direction === 'reverse' ? 'Reverse keyed. Recode before scoring.' : '',
        '', '', '', '', '', '', '', '', '', '', ''
      ].map(csvField).join(','));
      first = false;
    });
  });

  return {
    fileName: safeName(instrument.construct) + '-redcap-dictionary.csv',
    contents: rows.join('\n') + '\n'
  };
}

// ---- Google Forms ---------------------------------------------------------
// Google Forms accepts no import file, so this is a script that builds the form
// when it is run. The instructions are in the file and not expected of the
// person, because a script with no explanation attached is not a deliverable.
function toGoogleForms({ instrument }) {
  const header = [
    '/**',
    ' * Builds this instrument as a Google Form.',
    ' *',
    ' * Google Forms has no import format, so this creates the form through Apps',
    ' * Script instead. To run it:',
    ' *',
    ' *   1. Go to script.google.com and start a new project.',
    ' *   2. Replace everything in the editor with this file.',
    ' *   3. Press Run. Approve the permission request the first time.',
    ' *   4. The execution log prints the URL of the finished form.',
    ' *',
    ' * Nothing is sent anywhere by this application. The script runs in your own',
    ' * Google account and the form belongs to you.',
    ' */',
    '',
    'function buildForm() {',
    '  var form = FormApp.create(' + JSON.stringify(instrument.construct) + ');',
    '  form.setDescription(' + JSON.stringify(
      instrument.itemCount + ' items across ' + instrument.dimensions.length + ' dimensions.'
    ) + ');',
    ''
  ];

  const body = [];
  instrument.dimensions.forEach(function (dimension) {
    if (dimension.items.length === 0) {
      return;
    }
    body.push('  form.addSectionHeaderItem()');
    body.push('    .setTitle(' + JSON.stringify(dimension.name) + ')');
    body.push('    .setHelpText(' + JSON.stringify(dimension.definition || '') + ');');
    body.push('');

    dimension.items.forEach(function (item) {
      if (isOpen(item)) {
        body.push('  form.addParagraphTextItem()');
        body.push('    .setTitle(' + JSON.stringify(item.text) + ');');
        body.push('');
        return;
      }
      const labels = anchorsFor(item, instrument);
      body.push('  form.addMultipleChoiceItem()');
      body.push('    .setTitle(' + JSON.stringify(item.text) + ')');
      body.push('    .setChoiceValues(' + JSON.stringify(labels) + ');');
      body.push('');
    });
  });

  const footer = [
    '  Logger.log(form.getPublishedUrl());',
    '}',
    ''
  ];

  return {
    fileName: safeName(instrument.construct) + '-google-forms.gs',
    contents: header.concat(body).concat(footer).join('\n')
  };
}

// ---- Plain paste ----------------------------------------------------------
// For SurveyMonkey and everything else with a bulk entry box. No markup, since
// anything the box does not understand arrives as literal characters in a
// question.
function toPlain({ instrument }) {
  const lines = [];

  instrument.dimensions.forEach(function (dimension) {
    if (dimension.items.length === 0) {
      return;
    }
    lines.push(dimension.name.toUpperCase());
    lines.push('');
    dimension.items.forEach(function (item) {
      lines.push(item.text);
      if (!isOpen(item)) {
        anchorsFor(item, instrument).forEach(function (label) {
          lines.push('  ' + label);
        });
      }
      lines.push('');
    });
  });

  return {
    fileName: safeName(instrument.construct) + '-questions.txt',
    contents: lines.join('\n')
  };
}

const PLATFORMS = {
  qualtrics: {
    label: 'Qualtrics survey file',
    hint: 'A .qsf, imported through Projects, New project, From a file',
    write: toQualtricsSurveyFile
  },
  'qualtrics-txt': {
    label: 'Qualtrics advanced format',
    hint: 'Text pasted into the survey importer. The documented path',
    write: toQualtrics
  },
  redcap: {
    label: 'REDCap',
    hint: 'Data dictionary CSV with coded choice values',
    write: toRedcap
  },
  'google-forms': {
    label: 'Google Forms',
    hint: 'Apps Script that builds the form when you run it',
    write: toGoogleForms
  },
  plain: {
    label: 'Plain questions',
    hint: 'For SurveyMonkey and any bulk paste box',
    write: toPlain
  }
};

function write(platform, run) {
  const target = PLATFORMS[platform];
  if (!target) {
    throw new Error('Unknown platform: ' + platform);
  }
  return target.write(run);
}

module.exports = {
  PLATFORMS, write, toQualtrics, toQualtricsSurveyFile, toRedcap, toGoogleForms, toPlain,
  anchorsFor, redcapName
};
