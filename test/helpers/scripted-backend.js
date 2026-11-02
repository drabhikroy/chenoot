// A scripted stand-in for the language model, for tests that run the whole
// pipeline. It answers each step from the schema it is handed and the item ids
// it finds in the prompt, so the real steps, the real audit trail, and the real
// exporters all run without a model. Every answer is deterministic.

const crypto = require('node:crypto');

const STEMS = [
  'I can choose which shifts I work each month',
  'I decide how to organize care for my patients',
  'My manager asks for my view before changing my schedule',
  'I can swap a shift with a colleague when I need to',
  'I set the order in which I complete my tasks',
  'I have a say in how my unit plans its week',
  'I can take a break when the work allows it',
  'I choose the methods I use to finish my work',
  'My ideas are used when my unit changes its routines',
  'I control how much overtime I accept',
  'I plan my own workload for the day',
  'I can turn down an extra shift without trouble'
];
const REVERSE = [
  'My unit decides my breaks without asking me',
  'My schedule changes without my input',
  'Others decide how I do my work',
  'I have to follow routines I had no part in setting'
];
const DIMENSION_NAMES = ['Scheduling control', 'Method control', 'Decision input', 'Break control'];

function idsIn(prompt) {
  return Array.from(prompt.matchAll(/\[([a-z0-9-]+)\]/g)).map(function (m) { return m[1]; });
}

class ScriptedBackend {
  constructor(options) {
    this.options = Object.assign({ embed: true, dimensions: 3 }, options || {});
    this.model = 'scripted';
    this.embeddingModel = 'scripted-embed';
    this.counter = 0;
  }

  capabilities() {
    return { pull: false, embed: this.options.embed, remove: false };
  }

  withModel() {
    return this;
  }

  async status() {
    return { ready: true, state: 'ready', installed: [] };
  }

  async complete(prompt, schema) {
    const keys = Object.keys((schema && schema.properties) || {});
    if (keys.indexOf('gaps') !== -1) {
      return { gaps: [], undeclared_sensitive_topics: [] };
    }
    if (keys.indexOf('dimensions') !== -1) {
      const total = Number((prompt.match(/(\d+) items/) || [])[1]) || 12;
      const n = this.options.dimensions;
      const base = Math.floor(total / n);
      return {
        construct: 'Workplace autonomy',
        operationalizable: true,
        clarification_question: null,
        dimensions: DIMENSION_NAMES.slice(0, n).map(function (name, i) {
          return {
            name,
            definition: 'How much say a nurse has over ' + name.toLowerCase() + '.',
            target_item_count: base + (i < total - base * n ? 1 : 0)
          };
        })
      };
    }
    if (keys.indexOf('reference_scales') !== -1) {
      return { reference_scales: [] };
    }
    if (keys.length === 1 && keys[0] === 'items') {
      const match = prompt.match(/Write (\d+) items for this dimension, of which (\d+) are reverse/);
      const requested = match ? Number(match[1]) : 6;
      const reverse = match ? Number(match[2]) : 2;
      const items = [];
      for (let i = 0; i < requested; i += 1) {
        this.counter += 1;
        const isReverse = i < reverse;
        const pool = isReverse ? REVERSE : STEMS;
        // Every fifth item breaks two rules, so the critique and revision
        // steps have something to do.
        const text = this.counter % 5 === 0
          ? 'I always get my breaks and my shifts approved.'
          : pool[(this.counter * 7) % pool.length] + ' (' + this.counter + ').';
        items.push({ text, direction: isReverse ? 'reverse' : 'positive' });
      }
      return { items };
    }
    if (keys.indexOf('judgments') !== -1) {
      return {
        judgments: idsIn(prompt).map(function (id) {
          return { item_id: id, leading: false, socially_desirable: false };
        })
      };
    }
    if (keys.indexOf('revisions') !== -1) {
      const self = this;
      return {
        revisions: idsIn(prompt).map(function (id) {
          self.counter += 1;
          return { item_id: id, text: 'I can arrange my day to suit my patients (' + self.counter + ').' };
        })
      };
    }
    if (keys.indexOf('scale_type') !== -1) {
      return {
        polarity: 'bipolar',
        scale_type: '0',
        construct_word: 'autonomous',
        justification: 'Attitude statements suit an agreement scale.'
      };
    }
    if (keys.indexOf('text') !== -1) {
      return { text: 'How much say do you have over your schedule?' };
    }
    throw new Error('The scripted backend has no answer for a schema with ' + keys.join(', '));
  }

  // A stable vector built from the words, so near-identical wording lands close
  // together and unrelated wording does not.
  async embed(text) {
    if (!this.options.embed) {
      throw new Error('No embeddings.');
    }
    const vector = new Array(64).fill(0);
    String(text).toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean).forEach(function (word) {
      const hash = crypto.createHash('sha1').update(word).digest();
      vector[hash[0] % 64] += 1;
      vector[hash[1] % 64] += 0.5;
    });
    return vector;
  }
}

module.exports = { ScriptedBackend };
