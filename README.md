# Chenoot

Named for ṯnwt, the ancient Egyptian word for a census or a reckoning of
people. The application counts nothing itself, but it builds the instrument
that does, and it keeps a record of how.

A desktop application that builds psychometric survey instruments through a
nine-step pipeline and documents every decision it made along the way.

![The Chenoot landing page](docs/images/landing-dark.png)

Give it a construct name, who will answer it, what the results are for, and a
target length. It scopes the construct into dimensions, drafts an oversized item
pool, critiques every item against a fixed rubric, rewrites what fails, removes
near-duplicates, selects a response scale, and assembles a finished instrument
with a full audit trail. It runs unattended once started.

Everything runs on your machine against a local model. No account, no API key,
and no network connection are required.

## What the audit trail is for

The point of this application is not that a model can write survey items. It is
that every decision behind the finished instrument is recorded, attributable,
and checkable afterwards. Each entry in the trail carries its basis:

- **Measured** comes from something computed off the text itself, such as a
  Flesch-Kincaid grade or a cosine similarity. It is reproducible.
- **Model judgment** comes from an assessment against a stated criterion, such
  as whether an item leads the respondent. It is not reproducible, but it is
  grounded in text the model was shown.
- **Unverified recall** comes from the model's own memory with no source
  available to check it. Scale names, authors, and years in this category are
  frequently invented, and they are marked everywhere they appear.

That third category is why literature grounding is off by default.

## Dependencies

Two, and both are deliberate. Electron provides the desktop shell. The `docx`
library, MIT licensed, produces Word documents; the format is open enough to
write by hand, but doing so would mean maintaining a ZIP writer and a
schema-conformant XML generator to produce a file a well maintained library
already produces correctly.

Nothing else is pulled in at runtime. The renderer bundles React and nothing
more, and no asset is fetched from a network at any point.

## Requirements

- [Ollama](https://ollama.com) installed and running
- Roughly 8 GB of free memory for a 7 to 8 billion parameter model
- Node.js 20 or later, to build from source

## Setup

Install Ollama, then pull a generation model and an embedding model:

```
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

`qwen2.5:7b-instruct` also works and can be set in Settings.

If a model is missing, Settings offers to pull it with a progress bar, so the
terminal commands above are a convenience, not a requirement.

### Optional but worth doing

Pull a second model and name it as the critique model in Settings:

```
ollama pull qwen2.5:7b-instruct
```

A model reviewing its own writing shares the assumptions that produced it and
passes work it should catch. Using a different model for the critique and
revision steps costs one extra pull and measurably improves what gets flagged.

## Running from source

```
npm install
npm start
```

`npm start` builds the renderer bundle and launches Electron.

For iterative work on the interface, run the bundler in watch mode in one
terminal and Electron in another:

```
npm run watch:renderer
npx electron .
```

## Tests and the standards gate

```
npm test
```

This runs the standards gate first and the unit tests after it. The gate is not
a linter. It checks the project's writing standards across every source file:
the banned lexicon including every lexeme variation, em and en dashes,
contractions, and a comment density floor. It also audits all four color-vision
palettes against WCAG 2.2 AA contrast thresholds and against a perceptual
separation floor under the matching dichromat simulation.

Both gates run again before any packaging command. A build cannot be produced
from source that does not pass them.

```
npm run standards
```

### Contract tests

`test/contracts.test.js` checks that what the interface offers is backed by code
that exists. It compares the channels the preload invokes against the handlers
registered for them, the backends the settings screen lists against the modules
behind them, the export formats the results screen offers against the writers
that produce them, the capabilities each backend declares against the methods
implementing them, and the step labels the renderer holds against the pipeline
registry.

It exists because three bugs reached a working build during development and all
three were the same shape: the interface offering something the code did not do.
A settings option for a backend whose module was never written. A pull button
calling a method that did not exist. A Word export that threw by design. Each
was found by reading instead of by failing, which is the least reliable way to
find anything.

```
npm run contracts
```

### Launch and screen checks

Two checks run the assembled application instead of reading it.

`npm run smoke` starts Electron, watches everything it prints for twelve
seconds, and fails on anything that looks like a renderer fault. It exists
because a build once shipped that rendered nothing at all: the check in use at
the time filtered output for a handful of phrases, and a renderer exception
arrives as a CONSOLE line, which was not one of them. A blank window and a
healthy one produced identical output.

`npm run screens` goes further and drives the interface. It attaches over the
DevTools protocol, clicks through every destination in the shell, opens each
dialog, and asserts that something legible arrived in each. It then drags all
eight resize handles on two different dialogs and measures which edges moved.

The second check exists because the first one cannot see most of the
application. Nearly everything here is behind a click, and a screen that throws
only when it is opened is invisible to a check that opens nothing. Each of the
two dialogs it exercises had a defect that survived a passing smoke run.

The resize measurement is there for a related reason. That bug was not in the
resize handler at all: the panel is centered by its backdrop, so setting a width
grew it from the middle and every drag moved two edges in opposite directions.
Nothing in the code looked wrong. A measurement catches that and an inspection
does not.

```
npm run smoke
npm run screens
npm run verify    # standards, tests, and both of the above
```

`npm run screens` sets `CHENOOT_FORCE_SUPPORTED`, which is the only environment
hook in the application. The managed Ollama install exists on macOS and Windows
and not on Linux, and the download notice sits behind it, so without the hook
that dialog could not be reached by a check at all. It changes which button
appears and nothing else.

### The application icon

`npm run build:icon` regenerates `build/icon.png` from `scripts/build-icon.js`.
The icon is the same graduated rule the interface uses as its mark, described in
coordinates and is not kept as a binary, so the two cannot drift apart and the
shape can be adjusted by editing numbers. It is rebuilt automatically before any
packaging command.

## Downloading a build

Take the `.dmg` on macOS, the `.exe` on Windows, or the `.AppImage` on Linux.
None of them need Node or a checkout of this repository.

**[Download the latest release](https://github.com/drabhikroy/chenoot/releases/latest)**

These links always point at the newest build, so they keep working after the
next release without being edited:

- [macOS, Apple silicon](https://github.com/drabhikroy/chenoot/releases/latest/download/Chenoot-arm64.dmg)
- [macOS, Intel](https://github.com/drabhikroy/chenoot/releases/latest/download/Chenoot-x64.dmg)
- [Windows](https://github.com/drabhikroy/chenoot/releases/latest/download/Chenoot-Setup.exe)
- [Linux](https://github.com/drabhikroy/chenoot/releases/latest/download/Chenoot.AppImage)

For those links to resolve, the artifacts have to carry those exact names, which
is what the `artifactName` settings in the build configuration are for. Rename a
target and the link in this file dies quietly.

Nothing is signed, so the first launch needs one extra step.

- **macOS**: right-click the application, choose Open, then Open again.
- **Windows**: More info, then Run anyway, at the SmartScreen warning.
- **Linux**: `chmod +x Chenoot-*.AppImage` before running it.

Building and tagging a release is described in `RELEASING.md`.

## Building distributable packages

```
npm run dist:linux    # .AppImage
npm run dist:win      # .exe, NSIS installer
npm run dist:mac      # .dmg and .zip, arm64 and x64. Needs macOS.
npm run dist:mac:zip  # .zip only. Builds from any host.
npm run dist          # all three
```

Output lands in `dist/`.

Cross-compilation has real limits, and they are worth knowing before planning a
release.

A `.dmg` can only be produced on macOS, because it depends on `hdiutil`. From
any other host the macOS target has to be a `.zip` of the application bundle
instead, which is what `dist:mac:zip` produces. That is a legitimate
distributable, but see the signing note below, because a bundle built off-Mac
carries no signature at all.

A `.exe` can be built on Linux or macOS only with Wine installed. An `.AppImage`
builds on Linux without additional tooling.

One machine producing all three signed and installer-wrapped in practice means
building on macOS with Wine present.

### Unsigned builds

These packages are not code signed, because signing requires an Apple Developer
account and a Windows code signing certificate.

**macOS.** Two separate things go wrong, and only one of them is the familiar
one.

Quarantine produces the "cannot be opened because the developer cannot be
verified" dialog. That is the well-known step and it is not sufficient on its
own.

The signature requirement is the one that catches people. Since Big Sur, arm64
executables on Apple Silicon must carry a valid code signature or the kernel
refuses to run them. There is no dialog. The application appears to launch and
immediately dies, which reads as a crash, not a permissions problem. An
ad-hoc signature satisfies the requirement, proves nothing about origin, and
costs no developer account. It also cannot be applied from Linux, so it has to
happen on the Mac.

Unzip, then run the bundled script from the same folder:

```
./prepare-macos.sh Chenoot.app
```

Do not use `codesign --deep` by hand. Apple discourages it, and on a bundle with
four frameworks and four helper applications it usually produces a signature
that fails validation. macOS reports a broken signature far more harshly than a
missing one, with wording about malware that alarms people much more than the
situation deserves. The script signs from the inside out instead: libraries,
then frameworks, then helpers, then the application.

**On macOS Sequoia and later**, the right-click and Open bypass no longer
exists. Even correctly ad-hoc signed, the first launch is refused. After it is
blocked, open System Settings, then Privacy and Security, and scroll to the
bottom. A message naming Chenoot will be there with an Open Anyway button.
That message only appears after a blocked attempt, so try to open the
application first. This is required once.

Intel Macs do not enforce the signature requirement, so on those the quarantine
step alone is enough. Running the script is harmless either way.

### If it is blocked anyway

Running from source sidesteps Gatekeeper entirely, because the Electron binary
that npm installs is already signed and notarized by its publisher:

```
npm install
npm start
```

This needs Node.js but no developer account, and it is the most reliable way to
get the application running on a Mac today.

**Windows.** SmartScreen will show a blue "Windows protected your PC" panel.
Choose More info, then Run anyway.

**Linux.** Mark the AppImage executable and run it:

```
chmod +x Chenoot-0.1.0.AppImage
./Chenoot-0.1.0.AppImage
```

To sign properly, add `mac.identity` and `win.certificateFile` to the `build`
block in `package.json`.

## What is implemented

All eight pipeline steps, the orchestrator, the audit trail, the Ollama
backend, the Electron shell, and the input, pipeline, results, and settings
screens. Export to PDF, JSON, CSV, and plain text.

Word is the export written for someone other than the person who ran the
pipeline. It lays the instrument out as a document, in reading order, with the
audit trail as an appendix on a fresh page. Reverse keyed items are marked, and
the note about administration order being different from reading order is
carried on the page and never left implicit.

PDF is produced by printing the results view instead of composing a document
separately, so the layout on paper is the layout that was reviewed on screen and
there is no second implementation to drift away from the first. The audit panel
is opened before capture, so the printed document is the whole trail and not
a picture of a collapsed panel.

## Past runs

Every finished run is written to the per-user application data directory
automatically, and the archive is reachable from Past runs on the first screen.
Opening one restores the full results view, including the audit trail and every
export, so a run can be revisited or exported again months later.

Runs that failed partway are kept too. A run that died at Step 5 still
documents Steps 1 through 4, and that partial trail is usually what explains
the failure.

The runtime estimate on the input screen is measured from these records rather
than modeled. How long a run takes depends on the model, the hardware, how many
dimensions Step 1 produces, and how many items fail critique, none of which can
be known in advance. After the first completed run the estimate uses the median
rate this machine has actually achieved, and it says which basis it is using.

## The remote API backend

Off by default, and the one mode where the application stops being local. In it
the construct, the population, the purpose, and every generated item are sent to
the chosen provider. The settings screen states that in the error color rather
than as a hint.

Anthropic and OpenAI are supported, along with any gateway that speaks the
OpenAI chat completions format through the endpoint override. Structured output
is requested as a forced tool call on Anthropic and through response format on
OpenAI, so the schema is enforced by the provider instead of asked for in
prose.

Rate limits are retried with a widening delay and the provider's own
`retry-after` header is honoured when it sends one.

One asymmetry is worth knowing before choosing a provider. Anthropic publishes
no embeddings endpoint, so in that mode the Step 6 redundancy check does not
run. Coverage checking still does, and the audit trail records that redundancy
was skipped.

## What is not

Everything the build specification asked for is implemented. What follows is
what a second version would address, not what is missing from this one.

- **The pipeline is tuned against llama3.1:8b.** Other models of a similar size
  work, but the prompts have not been compared systematically across them, and
  the item quality a given model produces is the largest uncontrolled variable
  in the whole application.
- **No instrument is validated by running it.** The pipeline produces a
  defensible draft. Reliability and factor structure are empirical questions
  that need respondents, and nothing here substitutes for piloting.
- **Semantic differential is documented, not offered**, since it needs a
  bipolar adjective pair per item instead of one shared anchor set.
- **Builds are unsigned.** See the note above on what that costs.

## Project layout

```
src/main/            Main process. No renderer code reaches any of this.
  backends/          The AIBackend interface and its implementations.
  pipeline/          The eight steps, the orchestrator, and the audit trail.
    rubric/          The measured half of the Step 4 rubric.
  prompts/           One prompt template per step, kept apart from step logic.
src/renderer/        Sandboxed interface. No Node access.
  tokens/            Palettes and the spacing, type, and motion scales.
standards/           The lexicon and the checkers that enforce it.
test/                Unit tests, the standards gate, and the palette audit.
design/              Visual direction sketches. Not part of the build.
```

## A note on the response scale

The model chooses which kind of scale suits the construct and says why. It does
not write the anchor labels. Those come from a balanced catalog, because a local
model asked for seven balanced anchors will routinely return six, or place the
midpoint off center. That is a lookup problem, not a judgment call.

## License

PolyForm Noncommercial License 1.0.0. Copyright Abhik Roy. See `LICENSE`.

Lexend, Fraunces, and Spline Sans Mono are used under the SIL Open Font License. See
`src/renderer/fonts/OFL.txt`.
