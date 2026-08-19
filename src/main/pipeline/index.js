// The pipeline, in order.
//
// Steps are listed here and nowhere else. The orchestrator takes this array,
// the tests import individual entries, and nothing constructs its own sequence,
// so there is exactly one answer to what the pipeline does and in what order.

const steps = [
  require('./step1-specification'),
  require('./step2-scoping'),
  require('./step3-grounding'),
  require('./step4-generation'),
  require('./step5-critique'),
  require('./step6-revision'),
  require('./step7-coverage'),
  require('./step8-scale'),
  require('./step9-assembly')
];

// Numbering is checked at load, not trusted. A step inserted in the
// wrong position produces output the next step cannot read, and that failure
// is much easier to understand here than four steps later.
steps.forEach(function (step, index) {
  if (step.number !== index + 1) {
    throw new Error(
      'Step "' + step.name + '" declares number ' + step.number +
      ' but sits at position ' + (index + 1) + '.'
    );
  }
  ['run', 'describe'].forEach(function (method) {
    if (typeof step[method] !== 'function') {
      throw new Error('Step "' + step.name + '" has no ' + method + ' function.');
    }
  });
});

module.exports = { steps };
