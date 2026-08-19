// The remote API backend.
//
// This is the opt-in path, and it is the one where the promise the application
// otherwise makes stops holding. In this mode the construct, the population,
// the purpose, and every generated item are sent to a third party. The settings
// screen says so in the error color, not as a hint, and it is off by
// default.
//
// Two providers are supported through one adapter. They differ in how
// structured output is requested, which is the only part of the interface that
// is not shared, and the difference is confined to two small functions below.
//
// Embeddings are a real asymmetry instead of an oversight. Anthropic publishes
// no embeddings endpoint, so in that mode Step 6 loses its redundancy check
// and keeps its coverage check. The step already degrades correctly when
// embeddings are unavailable, so nothing special is needed here beyond a clear
// message.

const { AIBackend } = require('./index');

const ENDPOINTS = {
  anthropic: {
    completions: 'https://api.anthropic.com/v1/messages',
    embeddings: null
  },
  openai: {
    completions: 'https://api.openai.com/v1/chat/completions',
    embeddings: 'https://api.openai.com/v1/embeddings'
  }
};

// Remote models answer far faster than local ones, so the budget is tighter.
// A request that has not returned in a minute has gone wrong, not being
// slow.
const REQUEST_TIMEOUT_MS = 60000;

// Rate limits are the failure mode that distinguishes this backend from the
// local one. A 429 is not an error to report, it is an instruction to wait, so
// it is retried with a widening delay before anything is surfaced.
const RATE_LIMIT_ATTEMPTS = 4;
const RATE_LIMIT_BASE_DELAY_MS = 1500;

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

class ApiBackend extends AIBackend {
  constructor(settings) {
    super();
    this.provider = settings.apiProvider === 'openai' ? 'openai' : 'anthropic';
    this.apiKey = settings.apiKey || null;
    this.model = settings.model || (this.provider === 'anthropic'
      ? 'claude-sonnet-4-5'
      : 'gpt-4o-mini');
    this.embeddingModel = settings.embeddingModel || 'text-embedding-3-small';
    // A base URL override lets this reach any endpoint that speaks the OpenAI
    // chat completions shape, which is most self-hosted gateways.
    this.baseUrl = settings.apiBaseUrl || null;
  }

  capabilities() {
    // No remote provider exposes model pulling, and by the same token none of
    // them holds a copy anyone could delete. Embedding depends on the provider,
    // and Anthropic publishes no endpoint for it.
    return { pull: false, embed: this.provider === 'openai', remove: false };
  }

  withModel(model) {
    return new ApiBackend({
      apiProvider: this.provider,
      apiKey: this.apiKey,
      model: model || this.model,
      embeddingModel: this.embeddingModel,
      apiBaseUrl: this.baseUrl
    });
  }

  endpoint(kind) {
    if (this.baseUrl) {
      return this.baseUrl.replace(/\/$/, '') +
        (kind === 'embeddings' ? '/embeddings' : '/chat/completions');
    }
    return ENDPOINTS[this.provider][kind];
  }

  headers() {
    if (this.provider === 'anthropic') {
      return {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      };
    }
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + this.apiKey
    };
  }

  async request(url, body) {
    if (!this.apiKey) {
      throw new Error('No API key is saved. Add one in Settings, or switch back to Ollama.');
    }

    let lastError = null;
    for (let attempt = 0; attempt < RATE_LIMIT_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: controller.signal
        });

        if (response.status === 429 || response.status >= 500) {
          // The provider's own guidance takes precedence over the backoff
          // schedule when it supplies one.
          const retryAfter = Number(response.headers.get('retry-after'));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
          lastError = new Error('Provider returned HTTP ' + response.status + '.');
          await wait(delay);
          continue;
        }

        if (!response.ok) {
          const detail = await response.text();
          // Authentication failures are worth naming, because the remedy is
          // specific and nothing else in the application can supply it.
          if (response.status === 401 || response.status === 403) {
            throw new Error('The API key was rejected. Check it in Settings.');
          }
          throw new Error('Provider returned HTTP ' + response.status + ': ' + detail.slice(0, 200));
        }

        return await response.json();
      } catch (error) {
        if (error.name === 'AbortError') {
          lastError = new Error('The request timed out.');
        } else {
          throw error;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error('The provider could not be reached.');
  }

  // Anthropic has no JSON mode, so a schema is requested by declaring a single
  // tool whose input matches it and forcing that tool. The model then has to
  // produce arguments conforming to the schema, which is the same assurance
  // Ollama's format parameter gives by constraining the sampler.
  async completeAnthropic(prompt, schema, options) {
    const body = {
      model: this.model,
      max_tokens: 4096,
      temperature: (options && options.temperature) || 0.7,
      messages: [{ role: 'user', content: prompt }]
    };

    if (schema) {
      body.tools = [{
        name: 'record',
        description: 'Record the structured result.',
        input_schema: schema
      }];
      body.tool_choice = { type: 'tool', name: 'record' };
    }

    const data = await this.request(this.endpoint('completions'), body);

    if (schema) {
      const block = (data.content || []).find(function (item) {
        return item.type === 'tool_use';
      });
      if (!block) {
        throw new Error('The provider returned no structured output.');
      }
      return block.input;
    }
    const text = (data.content || []).find(function (item) { return item.type === 'text'; });
    return text ? text.text : '';
  }

  async completeOpenAi(prompt, schema, options) {
    const body = {
      model: this.model,
      temperature: (options && options.temperature) || 0.7,
      messages: [{ role: 'user', content: prompt }]
    };

    if (schema) {
      // Strict mode refuses any output not matching the schema. It requires
      // additionalProperties to be false and every property listed as required,
      // neither of which the pipeline schemas promise, so the looser form is
      // used and the result is validated by parsing.
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: 'result', schema: schema, strict: false }
      };
    }

    const data = await this.request(this.endpoint('completions'), body);
    const message = data.choices && data.choices[0] && data.choices[0].message;
    if (!message) {
      throw new Error('The provider returned no message.');
    }
    if (!schema) {
      return message.content;
    }
    try {
      return JSON.parse(message.content);
    } catch (error) {
      throw new Error('The provider returned output that is not valid JSON.');
    }
  }

  async complete(prompt, schema, options) {
    return this.provider === 'anthropic'
      ? this.completeAnthropic(prompt, schema, options)
      : this.completeOpenAi(prompt, schema, options);
  }

  async embed(text) {
    const url = this.endpoint('embeddings');
    if (!url) {
      throw new Error(
        'Anthropic publishes no embeddings endpoint, so the redundancy check cannot run in this mode. ' +
        'Coverage checking still runs.'
      );
    }
    const data = await this.request(url, { model: this.embeddingModel, input: text });
    return data.data[0].embedding;
  }

  // No request is made. A key is either saved or it is not, and spending a
  // billable call to confirm something the settings file already knows would be
  // a poor trade for the person paying for it.
  async status() {
    if (!this.apiKey) {
      return {
        ready: false,
        state: 'no-key',
        // Named models, not downloaded ones in this mode, so the list is
        // empty by definition. It is present so that a caller reading it does
        // not have to know which backend answered.
        installed: [],
        detail: 'No API key is saved. Add one in Settings, or switch back to Ollama.'
      };
    }
    const embedNote = this.provider === 'anthropic'
      ? ' Redundancy checking is unavailable in this mode, since Anthropic publishes no embeddings endpoint.'
      : '';
    return {
      ready: true,
      state: 'ready',
      installed: [],
      detail: 'Using ' + this.model + ' through the ' + this.provider +
        ' API. Text leaves this machine in this mode.' + embedNote
    };
  }
}

module.exports = { ApiBackend };
