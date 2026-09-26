# Changelog

Entries are written as changes land. Dates are the day the version was tagged.

## [1.1.0] - 2026-09-26

### Changed

- Narrowing a dimension to its target count now keeps the items that best
  match the dimension definition while overlapping least with the items
  already kept (maximal marginal relevance, Carbonell and Goldstein, 1998). It
  used to keep the items least similar to the rest of the pool, which favored
  items that had drifted away from the construct.
- Syllables are counted with rules for the patterns survey wording leans on,
  such as a consonant y in "your", a sounded le in "able", and a silent e in
  "sometimes". Against the CMU Pronouncing Dictionary, Flesch-Kincaid grade on
  typical items moves from an average error of 1.3 grades to 0.2. Items that
  were flagged for reading level only because of miscounted syllables are no
  longer flagged.
- A pair of items from different dimensions is reported as overlapping when it
  clears the duplicate cutoff of both dimensions, and not at a fixed cosine of
  0.9, so the alert follows the embedding model in use.
- Runtime estimates use only past runs of the chosen model when there are any,
  and fit the fixed and per item costs with a Theil and Sen line, so one stalled
  run no longer bends the estimate.

### Added

- A check on whole dimensions. When items in two dimensions are as similar to
  each other as items within one of them, the audit trail says the wording does
  not yet separate the two (after Campbell and Fiske, 1959).
- An American spelling check in the standards gate, which reads identifiers as
  well as prose.

### Fixed

- Without embeddings, as with the API backend or an embedding model that is not
  installed, the finished instrument held the whole draft pool, three times the
  number of items requested. It is now narrowed to the target on flags and
  keying balance, and the audit trail says similarity played no part.
- Choosing Flesch Reading Ease flagged nearly every item, because its score was
  compared against the grade target as though it were a grade. The target is
  now converted to a Reading Ease floor through Flesch's published table.
- Changing an item's format checked the rewrite with Flesch-Kincaid whatever
  measure was chosen in settings.
- Reverse keyed items negated with a contraction, such as "do not" written
  short, were not flagged as double negations. Absolutes followed by
  punctuation were missed, and only the first "and" or "or" in an item was
  tested for a second proposition.
- The frequency advisory counted words like "attention", "ready", and "recall"
  as countable behavior because they contain "attend", "read", and "call".
- Two sentences in the scale step of the audit trail were ungrammatical.
- British spellings in interface text and code, including one in the model
  catalog descriptions, are now American.
- Release builds for macOS are signed and notarized. The release workflow
  never passed the signing credentials to the macOS build, which would have
  produced DMGs that Gatekeeper refuses.

## [1.0.5] - 2026-09-11

### Changed

- macOS builds are signed with a Developer ID certificate and notarized by
  Apple, and the DMG itself is notarized and stapled as well as the application
  inside it. Opening Chenoot on macOS no longer needs the quarantine workaround,
  and the README no longer describes one.
- The README follows the structure shared across these applications, and the
  repository now carries a Code of Conduct, a contributing guide, and a security
  policy.

### Fixed

- The README said Windows and Linux builds were not yet available, directly
  above installation steps for both.

## [1.0.4] - 2026-08-28

### Fixed

- The downloaded Ollama runtime is checked against the checksum Ollama
  publishes beside it before anything is unpacked or made executable. It was
  checked only for being larger than twenty megabytes, which catches a
  truncated transfer and nothing else. A file that does not match is discarded.
- On Windows the unpacking command built its arguments by joining text, so a
  path containing a quote could have ended the quoting early. The paths are
  passed as parameters now.
- The consent panel said revoking a machine reading discards it "never only
  stopping further ones", which was garbled and said the opposite of what
  happens.

### Changed

- The build tooling moves to electron-builder 26.15.3. Earlier versions
  produced AppImages that could search the current directory for libraries.
  This affects the Linux AppImage from previous releases.

## [1.0.3] - 2026-08-28

### Fixed

- Setup and Help said the application could download and manage Ollama without
  saying where that is true. It is offered on macOS and Windows only, and both
  screens now say so and point at the download page instead.
- The message shown where Ollama cannot be managed named the platform by its
  build identifier, so a Linux user read something like "linux-arm64", and the
  download address it gave was not a link.
- Setup said both the runtime and the models are stored inside the application.
  Models are kept where Ollama keeps them, which the same screen already said
  further down.

## [1.0.1] - 2026-08-26

### Fixed

- The verification gate no longer stops on macOS and Windows. The smoke and
  screen checks called xvfb-run unconditionally, which exists only on Linux, so
  the gate could not finish on a development machine and the two checks that
  need a window server never ran outside the release runner.

### Changed

- A version bump now runs the full verification gate first, so a tag cannot be
  cut from a tree that fails its own checks.

### Added

- Windows and Linux artifacts are published alongside macOS. Version 1.0.0 was
  released with the macOS build only.
- Linux archives are published for Intel, AMD, and ARM. The AppImage is offered
  for x86_64 only, since the ARM AppImage runtime links against a library that
  is not present on an ordinary desktop and cannot start there. The archives
  need no runtime and work on either architecture.

## 1.0.0

Analysis of collected responses is planned and not in this release. See the
release notes for what that is expected to cover.

Response scales print the most positive anchor first by default. Any single item
or the whole instrument can be turned around from the results screen. The point
numbers stay on the ascending scale whichever way the anchors read, so reversing
the presentation never changes what a response is worth.

The pipeline's nine stages are called steps throughout, in the interface, in the
code, and in the saved record of a run.


First public release. Release notes are in `docs/RELEASE-NOTES-1.0.0.md`.

### Added

- A landing page, shown when the application opens and reachable afterwards from
  the wordmark. It shows one item being written and the five properties decided
  about it, and a specimen sheet of nine response formats as miniature items.
- Response formats reference, with what each format measures well, what to watch
  for, and citations to the question-design literature.
- Item types reference covering the taxonomy from Dillman, Smyth, and Christian,
  grouped by the seven properties an item is classified on.
- This run, a destination for the instrument built in the current session, so
  reaching it no longer means opening Past runs and picking the top row.
- Removing an installed model from Setup, including the one in use, which moves
  the setting to another installed model or clears it.
- Setting every item in a finished instrument to one response format in a single
  pass.
- Deleting every stored run, and resetting the application to its defaults
  without touching the run history unless asked.
- A Qualtrics survey file export alongside the existing advanced format text.
  The .qsf structure is derived from files Qualtrics produces and has not been
  confirmed against a Qualtrics import.
- `brand/`, an SVG icon set generated from the same geometry the interface
  renders.

### Fixed

- Downloaded models and settings appeared to reset between launches. The
  application resolved two different storage folders depending on whether it was
  started from source or from a packaged build. Existing data is carried across
  once on first launch.
- A run could finish with no items and present the result as a completed
  instrument. Generation and assembly now stop with an explanation naming the
  step that emptied the pool.
- A request for five items produced nine. The three items per dimension floor
  was raising the total instead of limiting the number of dimensions.
- A model named in settings but not installed showed as in use and offered no
  way to download it.
- Dialogs could only be resized within the bounds of the screen behind them, and
  dragging one edge moved the opposite edge.
- The Setup download notice could not be resized or scrolled.
- Backend failures all reported the same message. A refused connection, an
  address that does not resolve, a timeout, and a server answering with an error
  are now distinguished.
- Light appearance: native controls, dropdowns, and scrollbars followed the
  system scheme instead of the application, and four elements fell below the
  contrast threshold.
- Navigation overflowed the window at narrow widths, putting a horizontal
  scrollbar under every screen.
