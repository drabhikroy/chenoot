// The single point of contact between pipeline code and any model.
//
// Every step calls this interface and nothing else. That constraint is what
// makes the two backends interchangeable: no step may reach for a provider
// detail such as a header, a token budget, or an endpoint path, because none of
// those appear here. If a step ever needs one, the interface is wrong rather
// than the step.
//
// Both methods are permitted to throw. Retry policy, schema repair, and fallback
// live in the implementations, so a step sees either a valid result or a
// failure it can report to the audit trail.

class AIBackend {
  // Produce a completion. When a schema is supplied the return value is a
  // parsed object matching it; without one the return value is raw text.
  //
  // The schema is passed through to the provider's structured output mechanism
  // never described in the prompt. Asking a seven billion parameter model
  // to please return valid JSON is the least reliable part of any local
  // pipeline, and constrained decoding removes the problem instead of managing
  // it.
  async complete(_prompt, _schema, _options) {
    throw new Error('complete is not implemented on this backend');
  }

  // Produce an embedding vector, used by the redundancy check in Step 6.
  async embed(_text) {
    throw new Error('embed is not implemented on this backend');
  }

  // Return a second backend of the same kind bound to a different model.
  //
  // This exists so that Step 4 can critique with a model other than the one
  // Step 3 wrote with. A model reviewing its own output shares its own priors
  // and passes work it should catch, and swapping the reviewer is the cheapest
  // available correction: one extra pull and not any change to the pipeline.
  withModel(_model) {
    throw new Error('withModel is not implemented on this backend');
  }

  // Declare what this backend can do beyond the required methods above.
  //
  // Optional capabilities cannot be required methods, because they genuinely
  // differ: Ollama pulls models and no remote provider does, and Anthropic
  // publishes no embeddings endpoint while OpenAI does. Guarding each call site
  // with a typeof check was the earlier approach, and it turned a method
  // renamed by accident into a silent refusal, not a failure.
  //
  // Declaring instead means the interface states what it offers, the interface
  // can hide controls for what a backend lacks, and a contract test can check
  // that every declared capability is actually implemented.
  capabilities() {
    return { pull: false, embed: false, remove: false };
  }

  // Report whether the backend can currently be reached and is ready to serve
  // requests. The settings screen renders this directly, so the shape is fixed:
  // ready is a boolean, and detail is a sentence a person can act on.
  async status() {
    throw new Error('status is not implemented on this backend');
  }
}

// Descriptive label shown wherever the interface has to say which backend is
// active. The API mode is called out explicitly because that mode sends text off
// the machine, which is the one thing a person choosing this app most likely
// wanted to avoid.
const BACKEND_LABELS = {
  ollama: 'Local model via Ollama',
  api: 'Remote API, text leaves this machine'
};

function createBackend(settings) {
  // Required lazily so that loading this module does not pull in an HTTP client
  // for a backend the person is not using.
  if (settings.backend === 'api') {
    const { ApiBackend } = require('./api');
    return new ApiBackend(settings);
  }
  const { OllamaBackend } = require('./ollama');
  return new OllamaBackend(settings);
}

module.exports = { AIBackend, BACKEND_LABELS, createBackend };
