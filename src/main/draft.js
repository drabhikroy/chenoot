// The working specification, kept on disk between edits. It was lost when a
// run started, which meant a run that failed at any step took the whole
// specification with it and left nothing to amend. For a form of this size
// that is not an inconvenience, it is a reason not to use the application
// twice. Written to the per-user application data directory and nowhere else.
// It holds what someone typed into a form, so it is treated as recoverable
// working state, not as a record: overwritten freely, and never merged.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const FILE_NAME = 'draft.json';

function draftPath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(draftPath(), 'utf8'));
  } catch (error) {
    // A missing draft is the ordinary first-launch case, not a fault.
    return { construct: '', itemCount: 20, specification: {} };
  }
}

function save(draft) {
  fs.mkdirSync(path.dirname(draftPath()), { recursive: true });
  fs.writeFileSync(draftPath(), JSON.stringify(draft, null, 2), 'utf8');
  return draft;
}

// The saved specification, discarded. Same reasoning as the settings reset:
// removing the file is what an absent draft means everywhere else.
function clear() {
  try {
    fs.unlinkSync(draftPath());
  } catch (error) {
    // Nothing saved yet is the outcome asked for.
  }
}

module.exports = { load, save, clear, draftPath };
