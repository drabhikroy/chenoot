// Reading the machine's specifications, only when asked.
//
// The application needs memory and processor information to say which models
// will actually run, and that is the sort of thing software reads without
// asking often enough that people are right to be wary of it.
//
// So it is opt in, it is narrow, and it is reversible. Nothing is read until
// consent is given. What is read is the total memory, the processor
// description, the core count, and the architecture, which is what the model
// catalog needs and nothing beyond it. No identifiers, no serial numbers, no
// disk contents, no network configuration. It stays on this machine, as
// everything in this application does, and revoking discards the stored
// reading and not merely stopping future ones.

const os = require('node:os');

const BYTES_PER_GB = 1024 * 1024 * 1024;

// Exactly what is read, in the words the consent screen uses. Kept beside the
// code that does the reading so the promise and the behavior cannot drift.
const DISCLOSURE = [
  'Total system memory',
  'Processor name and core count',
  'Processor architecture, such as arm64 or x64',
  'Operating system name and version'
];

function read() {
  const cpus = os.cpus();
  const first = cpus && cpus.length > 0 ? cpus[0] : null;

  return {
    memoryGb: Math.round((os.totalmem() / BYTES_PER_GB) * 10) / 10,
    cores: cpus ? cpus.length : null,
    processor: first ? String(first.model).trim() : null,
    architecture: os.arch(),
    platform: os.platform(),
    release: os.release(),
    readAt: new Date().toISOString()
  };
}

// Apple Silicon shares memory between processor and graphics, so a model's
// working set competes with everything else in a way it does not on a machine
// with a discrete card and its own memory. Worth stating, not leaving
// someone to wonder why a model that should fit does not.
function notesFor(machine) {
  const notes = [];
  if (machine.platform === 'darwin' && machine.architecture === 'arm64') {
    notes.push(
      'This is an Apple Silicon machine, so memory is shared between the processor and the ' +
      'graphics hardware. A model has to fit alongside everything else running, not in ' +
      'memory of its own.'
    );
  }
  if (machine.memoryGb && machine.memoryGb <= 8) {
    notes.push(
      'With eight gigabytes or less, a seven billion parameter model will run but will leave ' +
      'little room for anything else. A three billion parameter model is the comfortable choice.'
    );
  }
  return notes;
}

module.exports = { read, notesFor, DISCLOSURE };
