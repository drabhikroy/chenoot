# Changelog

Entries are written as changes land. Dates are the day the version was tagged.

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
