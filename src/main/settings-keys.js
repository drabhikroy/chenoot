// The keys the renderer is permitted to write, and the defaults behind them.
//
// Separated from settings.js so they can be read without pulling in Electron.
// The store needs app and safeStorage to resolve a path and reach the keychain;
// the list of keys needs neither, and a contract test that had to boot Electron
// to check a list of strings would not be run.

const DEFAULTS = {
  backend: 'ollama',
  host: 'http://localhost:11434',
  model: 'llama3.1:8b',
  embeddingModel: 'nomic-embed-text',
  // Empty by default. Setting this to a second model is the independent critic
  // recommendation, and it costs one extra pull.
  critiqueModel: '',
  apiProvider: 'anthropic',
  apiBaseUrl: '',
  apiKeyEncrypted: null,
  // Off by default. Step 2 recall is unverifiable, so it is opted into.
  allowModelRecall: false,
  readabilityMeasure: 'flesch-kincaid',
  maximumGrade: 8,
  maximumWords: 20,
  // Set once the walkthrough has been completed or dismissed, so it runs on
  // first launch and never again unless someone asks for it from Help.
  walkthroughSeen: false,
  // Consent for reading this machine's specifications, and the last reading
  // taken. Both are cleared together when consent is revoked, so revoking
  // discards what was read and not only stopping further reads.
  hardwareConsent: false,
  // Whether the application may check public release feeds for newer versions.
  // Off by default: it is the only outbound request that is not a model call.
  updateChecks: false,
  // Whether the managed runtime and its models survive quitting. Keeping them
  // is the ordinary choice; removing them is for someone who tried this once.
  keepRuntimeOnQuit: true,
  machine: null,
  // How the finished instrument is laid out. Persisted because it is a reading
  // preference and not a property of any one run.
  resultsLayout: 'grouped',
  theme: 'dark',
  palette: 'standard'
};

// A settings object arriving over IPC is filtered against this, not
// merged wholesale, so a field the interface never shows cannot be introduced
// from that side. apiKey is absent deliberately: it takes a separate path
// through the system keychain.
const WRITABLE = [
  'backend', 'host', 'model', 'embeddingModel', 'critiqueModel',
  'apiProvider', 'apiBaseUrl', 'allowModelRecall', 'readabilityMeasure', 'maximumGrade', 'maximumWords',
  'theme', 'palette', 'walkthroughSeen', 'hardwareConsent', 'resultsLayout', 'updateChecks', 'keepRuntimeOnQuit'
];

module.exports = { DEFAULTS, WRITABLE };
