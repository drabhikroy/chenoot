// Runs the eight steps in order, records each one to the audit trail, and
// emits events the renderer draws from.
//
// The orchestrator holds no knowledge of what any step does. It knows how to
// run something, time it, write down what happened, and stop when asked. Step
// logic that leaks in here is step logic that cannot be tested on its own.

const { EventEmitter } = require('node:events');

// Every step conforms to this shape:
//
//   { number, name, describe(output) -> string, run(context) -> output }
//
// describe produces the one-line human summary for the pipeline view. It is
// separate from run so that the summary wording can be revised without touching
// the logic that produced the result, and so that a step cannot accidentally
// return its summary in place of its output.
//
// context carries { input, results, backend, trail, entry, signal }, where
// results is a plain object keyed by step name holding everything produced so
// far.

class CancelledError extends Error {
  constructor() {
    super('Run canceled.');
    this.name = 'CancelledError';
  }
}

class Orchestrator extends EventEmitter {
  constructor({ backend, steps, trail }) {
    super();
    this.backend = backend;
    this.steps = steps;
    this.trail = trail;
  }

  async run(input, signal) {
    const results = {};
    const total = this.steps.length;

    this.emit('run:start', { total, runId: this.trail.runId });

    for (let index = 0; index < total; index += 1) {
      const step = this.steps[index];

      // Cancellation is checked between steps, not inside them. A local
      // model call cannot be interrupted partway through in any useful sense, so
      // the honest promise to a person pressing Cancel is that the current step
      // finishes and nothing further starts.
      if (signal && signal.aborted) {
        this.emit('run:canceled', { completedSteps: index });
        throw new CancelledError();
      }

      const entry = this.trail.beginStep(step.number, step.name);
      this.emit('step:start', { number: step.number, name: step.name, index, total });

      const startedAt = Date.now();
      let output;

      // Steps that loop report where they are. Generation, critique, and
      // revision each work through the dimensions one at a time and can run for
      // minutes, and a progress indicator that has not moved is
      // indistinguishable from one that has stopped.
      //
      // The reporter is a function and not an event the step emits
      // directly, so a step still knows nothing about the renderer.
      const self = this;
      const report = function (detail, completed, total) {
        self.emit('step:progress', {
          number: step.number,
          name: step.name,
          detail,
          completed,
          total
        });
      };

      // A running commentary, separate from progress.
      //
      // Progress answers how far through a step is. This answers what it just
      // did, which is the thing that makes a twenty minute run legible rather
      // than merely bounded. A step that says "dropped vigor-04, still
      // double-barrelled after three rounds" is being transparent in a way that
      // a percentage cannot be.
      //
      // Kept to short factual lines and capped in the renderer, because a log
      // that scrolls faster than it can be read is decoration.
      const note = function (text) {
        self.emit('step:note', {
          number: step.number,
          name: step.name,
          text,
          at: Date.now()
        });
      };

      try {
        output = await step.run({
          input,
          results,
          backend: this.backend,
          trail: this.trail,
          entry,
          signal,
          report,
          note
        });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        this.trail.failStep(entry, error, durationMs);
        this.emit('step:error', {
          number: step.number,
          name: step.name,
          message: error.message,
          durationMs
        });
        throw error;
      }

      const durationMs = Date.now() - startedAt;
      const summary = step.describe(output, results);

      this.trail.completeStep(entry, {
        input: step.recordInput ? step.recordInput({ input, results }) : null,
        output,
        summary,
        durationMs
      });

      results[step.name] = output;

      // Emitted immediately after the step resolves and before anything else
      // happens, including the next step starting. The requirement is that a
      // transition becomes visible inside roughly 400 milliseconds of the step
      // actually finishing, and the only way to be certain of that is to leave
      // no work between the two.
      this.emit('step:complete', {
        number: step.number,
        name: step.name,
        summary,
        durationMs,
        index,
        total,
        completed: index + 1
      });

      // Step 1 is the single point where the pipeline may need a person. It
      // reports back, not throwing, because a construct too vague to
      // operationalize is an ordinary outcome instead of a failure.
      if (output && output.needsClarification) {
        this.emit('clarification:needed', {
          number: step.number,
          question: output.clarificationQuestion
        });
        this.trail.finish();
        // The halting output travels with the result. A caller that had to
        // guess which step stopped would break the moment the order changed,
        // which is exactly what happened when a step was inserted first.
        return {
          status: 'awaiting-clarification',
          results,
          trail: this.trail,
          halted: output,
          haltedAt: { number: step.number, name: step.name }
        };
      }
    }

    this.trail.finish();
    this.emit('run:complete', { runId: this.trail.runId, counts: this.trail.counts() });
    return { status: 'complete', results, trail: this.trail };
  }
}

module.exports = { Orchestrator, CancelledError };
