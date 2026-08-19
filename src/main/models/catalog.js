// The model catalog.
//
// What this list is, and what it is not.
//
// Every entry states what the model is generally known for, what it costs to
// run, and where it tends to struggle at the specific job this application
// gives it. That job is narrower than general chat: the pipeline asks for
// structured output against a JSON schema on seven of its nine steps, and it
// asks for short declarative sentences written to a rubric. A model that writes
// beautiful long prose and drifts out of a schema is worse here than a plain
// one that stays inside it.
//
// What this list is not is a benchmark. Nothing here was measured by this
// application on your hardware, and the characterisations come from each
// model's general reputation and published behavior and not from a
// controlled comparison on survey item generation, which as far as anyone knows
// does not exist. They are a starting point for choosing, not evidence.
//
// The sizes are for the default quantization Ollama pulls, which is a four bit
// variant for most of these. Memory figures are the working set including
// context and overhead, not the file size, because the file size is what people
// check and the working set is what actually decides whether a model runs.

const ROLE_GENERATION = 'generation';
const ROLE_EMBEDDING = 'embedding';

const MODELS = [
  {
    id: 'qwen2.5:7b-instruct',
    label: 'Qwen 2.5 7B Instruct',
    role: ROLE_GENERATION,
    parameters: '7B',
    diskGb: 4.7,
    memoryGb: 8,
    recommended: true,
    strengths: 'The most reliable schema adherence of any model this size, which matters more ' +
      'here than anywhere else because seven of the nine steps ask for structured output. ' +
      'Follows a rubric closely and rarely adds commentary around the answer.',
    weaknesses: 'Item wording can be flat and slightly formal. Reverse keyed items sometimes ' +
      'come back as negations, not as statements of the opposite, which the critique ' +
      'step then flags.'
  },
  {
    id: 'llama3.1:8b',
    label: 'Llama 3.1 8B',
    role: ROLE_GENERATION,
    parameters: '8B',
    diskGb: 4.9,
    memoryGb: 8,
    recommended: true,
    strengths: 'Writes the most natural item wording in this size class, which shows up as ' +
      'fewer revision rounds. Broad general knowledge, so construct scoping produces sensible ' +
      'dimensions across a wide range of subjects.',
    weaknesses: 'Looser with schemas than Qwen and more inclined to pad an answer with ' +
      'explanation. Constrained decoding catches this, but the retries cost time.'
  },
  {
    id: 'mistral-nemo:12b',
    label: 'Mistral Nemo 12B',
    role: ROLE_GENERATION,
    parameters: '12B',
    diskGb: 7.1,
    memoryGb: 12,
    strengths: 'A noticeable step up in the judgment steps, particularly critique, where it ' +
      'catches leading and socially desirable wording that smaller models pass. Long context.',
    weaknesses: 'Roughly twice the runtime of a 7B on the same machine, and a full pipeline run ' +
      'moves from twenty minutes to closer to an hour.'
  },
  {
    id: 'qwen2.5:14b-instruct',
    label: 'Qwen 2.5 14B Instruct',
    role: ROLE_GENERATION,
    parameters: '14B',
    diskGb: 9.0,
    memoryGb: 16,
    strengths: 'The best balance of schema reliability and writing quality that still runs on a ' +
      'consumer machine. Scoping in particular produces dimensions that need less correction.',
    weaknesses: 'Needs sixteen gigabytes to run comfortably and will swap badly below that. ' +
      'Slow enough that the revision loop dominates the run.'
  },
  {
    id: 'gemma2:9b',
    label: 'Gemma 2 9B',
    role: ROLE_GENERATION,
    parameters: '9B',
    diskGb: 5.4,
    memoryGb: 10,
    strengths: 'Careful, plain writing that suits survey items well, and a low rate of the ' +
      'flowery phrasing that the critique step has to strip out.',
    weaknesses: 'Short context by current standards, which constrains how much of a pool can be ' +
      'critiqued in one call. More conservative about producing anything it reads as sensitive, ' +
      'which can stall on health or workplace conduct constructs.'
  },
  {
    id: 'llama3.2:3b',
    label: 'Llama 3.2 3B',
    role: ROLE_GENERATION,
    parameters: '3B',
    diskGb: 2.0,
    memoryGb: 4,
    strengths: 'Runs on almost anything, including machines with eight gigabytes total. Fast ' +
      'enough that a full run finishes in a few minutes, not tens of them.',
    weaknesses: 'Item quality drops off noticeably. Expect more revision rounds, more items ' +
      'dropped after three attempts, and dimensions that overlap more than they should. Usable ' +
      'for seeing the pipeline work end to end; not what to build a real instrument with.'
  },
  {
    id: 'phi3.5:3.8b',
    label: 'Phi 3.5 3.8B',
    role: ROLE_GENERATION,
    parameters: '3.8B',
    diskGb: 2.2,
    memoryGb: 4,
    strengths: 'Unusually strong instruction following for its size and better with schemas ' +
      'than most small models, so the structured steps hold up.',
    weaknesses: 'Narrow world knowledge. Construct scoping on a specialised subject produces ' +
      'dimensions that are generic or subtly wrong, and nothing downstream can recover from that.'
  },
  {
    id: 'qwen2.5:32b-instruct',
    label: 'Qwen 2.5 32B Instruct',
    role: ROLE_GENERATION,
    parameters: '32B',
    diskGb: 20,
    memoryGb: 32,
    strengths: 'Approaches the quality of a remote frontier model on this task while staying ' +
      'local. Critique in particular becomes genuinely useful and not merely present.',
    weaknesses: 'Needs a workstation or an Apple Silicon machine with thirty-two gigabytes of ' +
      'unified memory. A full run takes hours on anything less than that.'
  },
  {
    id: 'nomic-embed-text',
    label: 'Nomic Embed Text',
    role: ROLE_EMBEDDING,
    parameters: '137M',
    diskGb: 0.28,
    memoryGb: 1,
    recommended: true,
    strengths: 'The default for the redundancy check. Small, fast, and well behaved on short ' +
      'text, which is what survey items are.',
    weaknesses: 'Similarity between two items in the same dimension sits high by construction, ' +
      'which is why the duplicate cutoff is computed from each dimension and not fixed.'
  },
  {
    id: 'mxbai-embed-large',
    label: 'MxBai Embed Large',
    role: ROLE_EMBEDDING,
    parameters: '335M',
    diskGb: 0.67,
    memoryGb: 2,
    strengths: 'Better separation between near-duplicates than Nomic on short text, so the ' +
      'coverage step makes fewer borderline removals.',
    weaknesses: 'Slower, and the difference only shows on instruments large enough for ' +
      'duplicates to be a real problem.'
  }
];

// The three bands below and the notice text above are the only two things this
// module produces beyond the list itself. Everything else about a model is
// prose that travels unchanged.
// Memory headroom before a model is called comfortable, not merely
// possible. Running at the exact figure means the operating system starts
// swapping the moment anything else opens.
const HEADROOM_GB = 2;

// Classify a model against a machine. Deliberately three bands instead of a
// yes or no, because the middle case is real: plenty of models run at the
// stated minimum and make the machine unusable while they do.
function fitFor(model, machine) {
  if (!machine || !machine.memoryGb) {
    return { band: 'unknown', note: 'Machine specifications have not been read.' };
  }
  if (machine.memoryGb >= model.memoryGb + HEADROOM_GB) {
    return { band: 'comfortable', note: 'Runs with room for other applications.' };
  }
  if (machine.memoryGb >= model.memoryGb) {
    return {
      band: 'tight',
      note: 'Runs, but close to the limit. Expect the machine to slow while a pipeline is going.'
    };
  }
  return {
    band: 'insufficient',
    note: 'Needs about ' + model.memoryGb + ' GB. This machine reports ' +
      machine.memoryGb + ' GB.'
  };
}

function annotate(machine) {
  return MODELS.map(function (model) {
    return Object.assign({}, model, { fit: fitFor(model, machine) });
  });
}

// What to suggest when a machine's memory is known. The largest recommended
// model that is comfortable,, not the largest that merely fits.
function suggestFor(machine) {
  const generation = annotate(machine)
    .filter(function (m) { return m.role === ROLE_GENERATION && m.fit.band === 'comfortable'; })
    .sort(function (a, b) { return b.memoryGb - a.memoryGb; });
  const embedding = annotate(machine)
    .filter(function (m) { return m.role === ROLE_EMBEDDING && m.fit.band !== 'insufficient'; });
  return {
    generation: generation[0] || null,
    embedding: embedding[0] || null
  };
}

// What the download notice says about a given model. Assembled here so the
// description travels with the entry, not being written twice.
function noticeFor(model) {
  return {
    label: model.label,
    what: model.label + ' is an open weights language model. ' +
      (model.role === ROLE_EMBEDDING
        ? 'It turns text into numbers so the pipeline can find near-duplicate items. It does not generate text.'
        : 'It runs entirely on your machine and does the writing, critique, and revision.'),
    source: 'It is downloaded by Ollama from its public model library, which is where the ' +
      'people who publish the model put it.',
    url: 'https://ollama.com/library/' + model.id.split(':')[0],
    size: model.diskGb + ' GB',
    memory: 'About ' + model.memoryGb + ' GB of memory while it is running, released when it stops.',
    standing: 'This model is published openly and used widely. It is not written or maintained ' +
      'by this application, so what it produces and how it behaves are the publisher\'s work ' +
      'never ours.'
  };
}

// Which job a model identifier does, and therefore which setting it belongs in.
//
// Matching is on the base name and not the full tag, because Ollama reports
// what it holds with a tag appended and a person can type either form. A name
// this catalog does not carry is treated as a writing model, which is the far
// more common case and the one where guessing wrong is recoverable in a click.
function roleOf(identifier) {
  const base = String(identifier || '').split(':')[0];
  const known = MODELS.find(function (model) {
    return model.id === identifier || model.id.split(':')[0] === base;
  });
  if (known) {
    return known.role;
  }
  // Embedding models are named for the job in every published family this
  // application has met, and a writing model with embed in its name would be a
  // first.
  return /embed/i.test(base) ? ROLE_EMBEDDING : ROLE_GENERATION;
}

// The settings field a model of a given identifier is written to. Kept beside
// the role lookup so the two cannot drift apart.
function settingKeyFor(identifier) {
  return roleOf(identifier) === ROLE_EMBEDDING ? 'embeddingModel' : 'model';
}

// Whether an installed list holds a given identifier. Ollama answers with
// tagged names, so a bare name matches on its base and a tagged one has to
// match exactly, which keeps two tags of the same family distinguishable.
function isInstalled(identifier, installed) {
  const wanted = String(identifier || '');
  return (installed || []).some(function (present) {
    if (present === wanted) {
      return true;
    }
    return wanted.indexOf(':') === -1 && present.split(':')[0] === wanted;
  });
}

module.exports = {
  MODELS, annotate, fitFor, suggestFor, noticeFor, roleOf, settingKeyFor, isInstalled,
  ROLE_GENERATION, ROLE_EMBEDDING
};
