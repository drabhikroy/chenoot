// The application shell. Every screen renders inside it. Settings, history,
// and results each ended in a button at the bottom of a long scroll, which
// meant leaving a screen required first reaching the end of it. The bar also
// carries the window drag region on macOS, which hides its title bar and takes
// the drag area with it. Navigation stays available during a run. The pipeline
// continues in the main process regardless of what the renderer is showing, so
// looking at settings while a run works is harmless, and the running step is
// offered as a destination so there is always a way back to it.

import { Mark } from './Mark.jsx';
import { BUILD_NUMBER } from '../build-number.js';

// Ordered by when a person meets them, not by category. Build something,
// set up what building needs, look at what was built before. A run in progress
// slots in after Setup, which is where it belongs in that sequence and also
// where the eye is already going once a run has started.
const ITEMS = [
  // Setup first, because nothing can be built until it is done and a first
  // launch has to start there. Once it is finished it stays as the place the
  // model is changed, which is a rarer visit than New but still the step that
  // comes before one.
  { id: 'setup', label: 'Setup' },
  { id: 'input', label: 'New' },
  { id: 'history', label: 'Past runs' }
];

// This run sits where a person looks for it, between starting one and browsing
// the finished ones. It joins the bar only once there is a run to show. A
// permanent destination that opens on an empty page is one more equally
// weighted choice in a bar that already had nine, and the time to choose among
// options grows with how many are offered (Hick, 1952).
const THIS_RUN = { id: 'results', label: 'This run' };

// Configuration and reference, kept apart from the destinations above. The
// first two open as layers instead of replacing the screen, and a rule between
// the groups says so without a label.
//
// Help sits at the end and not among the destinations. It is the thing
// reached when something else has not worked, which is a different kind of
// visit from the three on the left, and the far end of the bar is where an
// application's reference material is looked for.
const CONFIGURATION = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'settings', label: 'Settings' },
  // Reference material, next to Help because that is what it is. Response
  // formats and item types answer different questions, which scale to put on
  // an item and what kind of item to write, so they stay two pages. They share
  // one destination with tabs across the top, because two neighboring entries
  // for one kind of visit cost the bar a place without saving anyone a click.
  { id: 'formats', label: 'Reference', covers: ['formats', 'itemtypes'] },
  { id: 'help', label: 'Help' }
];

export function Shell({
  screen, onNavigate, running, settingsOpen, appearanceOpen, hasResult, setupReady, children
}) {
  // The results screen is reachable only by finishing or opening a run, so it
  // is shown as a destination once one exists, not sitting in the bar
  // permanently as something that might do nothing.
  // Inserted after Setup, not at the front. A live tab appearing to the
  // left of everything pushed the whole bar sideways the moment a run started,
  // so every other destination moved out from under the pointer at exactly the
  // moment somebody might reach for one.
  const items = ITEMS.slice();
  if (hasResult) {
    const beforeHistory = items.findIndex(function (item) { return item.id === 'history'; });
    items.splice(beforeHistory, 0, THIS_RUN);
  }
  if (running) {
    const afterNew = items.findIndex(function (item) { return item.id === 'input'; }) + 1;
    items.splice(afterNew, 0, { id: 'pipeline', label: 'Building', live: true });
  }

  const render = function (item) {
    let current = item.covers ? item.covers.indexOf(screen) !== -1 : screen === item.id;
    // Setup carries a marker until the application can run, so the one thing
    // standing between a person and their first instrument is visible from any
    // screen and not only from the form that it blocks.
    const needsAttention = item.id === 'setup' && setupReady === false;
    if (item.id === 'settings') {
      current = Boolean(settingsOpen);
    } else if (item.id === 'appearance') {
      current = Boolean(appearanceOpen);
    }
    return (
      <button
        key={item.id}
        className={'bar-item' + (current ? ' current' : '') + (item.live ? ' live' : '')}
        onClick={function () { onNavigate(item.id); }}
        aria-current={current ? 'page' : undefined}
      >
        {item.live ? <span className="bar-pip" aria-hidden="true" /> : null}
        {item.label}
        {needsAttention ? (
          <span className="bar-attention" role="img" aria-label="not finished" />
        ) : null}
      </button>
    );
  };

  return (
    <div className="shell">
      <header className="bar">
        {/* The build stamp that used to sit here has moved into Help. It
            answered a question only asked when something looks wrong, and
            beside the name it read as part of the name. */}
        {/* The wordmark returns to the landing page, which keeps that page
            reachable without giving it a place in the navigation beside the
            working destinations. */}
        <button
          className="bar-mark"
          onClick={function () { onNavigate('landing'); }}
          title="Chenoot"
        >
          <Mark />
          <span className="bar-wordmark">Chenoot</span>
          {/* The version sits with the name, set smaller and quieter so it reads
              as a detail of the wordmark and not as a second word in it. */}
          <span className="bar-version value">{BUILD_NUMBER}</span>
        </button>
        <nav className="bar-nav">
          {items.map(render)}
          <span className="bar-divider" aria-hidden="true" />
          {CONFIGURATION.map(render)}
        </nav>
      </header>
      <main className="shell-body">{children}</main>
    </div>
  );
}
