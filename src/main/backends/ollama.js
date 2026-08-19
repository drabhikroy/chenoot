// Ollama implementation of the backend interface. This is the default path and
// the one the pipeline is tuned against.

const { AIBackend } = require('./index');

const DEFAULT_HOST = 'http://localhost:11434';

// Two attempts at constrained decoding, then one repair attempt that shows the
// model its own malformed output. Beyond that the step fails and says so. A
// pipeline that silently retries forever on a model that cannot satisfy the
// schema turns a two minute failure into a twenty minute one.
const DECODE_ATTEMPTS = 2;

// Local models on consumer hardware are slow, not broken. Ninety seconds
// per call is generous enough for an eight billion parameter model generating a
// full item pool on a laptop without a discrete card.
const REQUEST_TIMEOUT_MS = 90000;

class OllamaBackend extends AIBackend {
  constructor(settings) {
    super();
    this.host = settings.host || DEFAULT_HOST;
    this.model = settings.model || 'llama3.1:8b';
    this.embeddingModel = settings.embeddingModel || 'nomic-embed-text';
  }

  capabilities() {
    return { pull: true, embed: true, remove: true };
  }

  withModel(model) {
    return new OllamaBackend({
      host: this.host,
      model: model || this.model,
      embeddingModel: this.embeddingModel
    });
  }

  async request(pathname, body, timeoutMs) {
    // AbortController and not a racing timer, so a hung request is actually
    // torn down instead of left running while the promise resolves elsewhere.
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs || REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.host + pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error('Ollama returned HTTP ' + response.status);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async complete(prompt, schema, options) {
    if (!schema) {
      const result = await this.request('/api/generate', {
        model: this.model,
        prompt,
        stream: false
      });
      return result.response;
    }

    // The schema goes to the format parameter, which constrains decoding at the
    // sampler. The model cannot emit a token that would break the structure, so
    // the usual failure of a stray preamble or a trailing code fence cannot
    // occur in the first place.
    let lastError = null;
    for (let attempt = 0; attempt < DECODE_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.request('/api/generate', {
          model: this.model,
          prompt,
          format: schema,
          stream: false,
          options: {
            // Structured steps run cool. Item wording benefits from variation,
            // so Step 3 passes a higher value. Either way the retry drops the
            // temperature, on the reasoning that a first attempt which failed
            // to satisfy the schema was probably sampling too freely.
            temperature: attempt === 0
              ? ((options && options.temperature) || 0.7)
              : 0.2
          }
        });
        return JSON.parse(result.response);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      'Model did not produce output matching the schema after ' +
      DECODE_ATTEMPTS + ' attempts: ' + lastError.message
    );
  }

  // Pull a model, reporting progress as it goes.
  //
  // Deleting a model, which frees the disk it occupies.
  //
  // A single request with a single answer, unlike the pull, because there is no
  // progress to report: Ollama unlinks the blobs and returns. The weights are
  // shared with anything else on the machine using Ollama, so this removes the
  // model from that shared store, not from this application alone, which
  // is why the interface asks before calling it.
  async remove(model) {
    const response = await fetch(this.host + '/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    });
    if (response.status === 404) {
      // Already absent. The caller wanted it gone and it is gone, so this is
      // the outcome they asked for instead of a failure to report.
      return { ok: true, alreadyAbsent: true };
    }
    if (!response.ok) {
      throw new Error('Ollama returned HTTP ' + response.status + ' for the delete request.');
    }
    return { ok: true };
  }

  // The endpoint answers with newline-delimited JSON and not a single
  // response, one object per state change, and a four gigabyte model produces
  // thousands of them. The stream is read incrementally, not buffered,
  // because holding the whole thing to parse it at the end would defeat the
  // purpose of a progress report.
  //
  // No timeout is applied. A pull is legitimately a twenty minute operation on
  // a slow connection, and the abort signal is how it gets stopped.
  async pull(model, onProgress, signal) {
    const response = await fetch(this.host + '/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || this.model, stream: true }),
      signal
    });
    if (!response.ok) {
      throw new Error('Ollama returned HTTP ' + response.status + ' for the pull request.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let last = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // A chunk boundary can fall mid-line, so the trailing fragment is kept
      // and prefixed onto the next chunk, not parsed.
      const lines = buffer.split('\n');
      buffer = lines.pop();

      lines.forEach(function (line) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          return;
        }
        let update;
        try {
          update = JSON.parse(trimmed);
        } catch (error) {
          return;
        }
        last = update;
        if (update.error) {
          throw new Error(update.error);
        }
        if (onProgress) {
          onProgress(describePull(update));
        }
      });
    }

    if (last && last.error) {
      throw new Error(last.error);
    }
    return { ok: true, model: model || this.model };
  }

  async embed(text) {
    const result = await this.request('/api/embed', {
      model: this.embeddingModel,
      input: text
    }, 30000);
    // The endpoint returns a list even for a single input.
    return result.embeddings ? result.embeddings[0] : result.embedding;
  }

  // Why the address did not answer, in the terms the remedy differs by.
  //
  // Nothing here was distinguished before: a refused connection, a hostname
  // that does not resolve, a server answering with an error, and a server not
  // answering at all all produced the same sentence telling the person to
  // install Ollama. Three of those four are wrong, and the one that suggests
  // installing software to somebody whose address has a typo in it sends them
  // to download a program they already have.
  static describeFailure(error, host) {
    const code = (error && error.cause && error.cause.code) || error.code || '';
    if (error && error.name === 'AbortError') {
      return {
        state: 'timeout',
        detail: 'Ollama did not answer within ten seconds at ' + host +
          '. It may be loading a model. Check again in a moment.'
      };
    }
    if (code === 'ECONNREFUSED') {
      return {
        state: 'unreachable',
        detail: 'Nothing is listening at ' + host +
          '. Install Ollama, or start it if it is already installed.'
      };
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return {
        state: 'bad-address',
        detail: 'The address ' + host + ' does not resolve to anything. ' +
          'Check it in Settings.'
      };
    }
    if (error && error.httpStatus) {
      return {
        state: 'faulted',
        detail: 'Ollama answered at ' + host + ' with HTTP ' + error.httpStatus +
          '. It is running but not working. Restarting it usually clears this.'
      };
    }
    return {
      state: 'unreachable',
      detail: 'Ollama is not responding at ' + host +
        '. Install it, or start it if it is already installed.'
    };
  }

  async status() {
    let tags;
    try {
      // A ceiling on the wait.
      const response = await fetch(this.host + '/api/tags', {
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        throw Object.assign(new Error('HTTP ' + response.status), {
          httpStatus: response.status
        });
      }
      tags = await response.json();
    } catch (error) {
      // Empty, not absent. Every caller of status reads this field, and
      // one branch that omits it turns a missing model list into a crash on the
      // path where nothing is running.
      return Object.assign(
        { ready: false, installed: [] },
        OllamaBackend.describeFailure(error, this.host)
      );
    }

    // Ollama's own answer, treated as input rather than as a promise.
    //
    // This read the model list straight off the parsed body, so a reply that
    // was null, or that carried something other than a list under models,
    // threw out of status and surfaced as a raw JavaScript message in the
    // interface. A proxy, a captive portal, or a different program on the port
    // all produce exactly that.
    const reported = tags && Array.isArray(tags.models) ? tags.models : null;
    if (!reported) {
      return {
        ready: false,
        state: 'faulted',
        installed: [],
        detail: 'Something answered at ' + this.host +
          ' but it does not look like Ollama. Check the address in Settings.'
      };
    }
    const installed = reported
      .map(function (m) { return m && m.name; })
      .filter(Boolean);
    const missing = [this.model, this.embeddingModel].filter(function (name) {
      // Ollama reports tagged names, so a bare model name has to match a
      // prefix, not the whole string.
      return !installed.some(function (present) {
        return present === name || present.split(':')[0] === name.split(':')[0];
      });
    });

    // The installed list travels with every reachable answer, not only the
    // failing one. Settings needs it to offer the models on this machine as
    // choices and not as a name someone has to type correctly, and the
    // catalog needs it to stop offering a download for something already here.
    if (missing.length > 0) {
      return {
        ready: false,
        state: 'model-missing',
        missing,
        installed,
        detail: 'Ollama is running. Pull ' + missing.join(' and ') + ' to start.'
      };
    }
    return {
      ready: true,
      state: 'ready',
      installed,
      detail: 'Ollama is running with ' + this.model + '.'
    };
  }
}

// Turn one raw status object into something a person can read. Ollama reports
// layer digests, which are meaningless outside the tool, so the digest is
// dropped and only the phase and the byte counts are kept.
function describePull(update) {
  const status = String(update.status || '');
  const total = Number(update.total) || 0;
  const completed = Number(update.completed) || 0;

  // Only the download phase has a size. Manifest reads, verification, and the
  // final write report a phase and nothing else, and inventing a percentage for
  // them would make the bar jump backward when the next layer starts.
  const hasSize = total > 0;
  return {
    phase: status.startsWith('pulling ') && hasSize ? 'downloading' : status,
    detail: status,
    completed,
    total,
    fraction: hasSize ? Math.min(1, completed / total) : null,
    done: status === 'success'
  };
}

module.exports = { OllamaBackend, describePull };
