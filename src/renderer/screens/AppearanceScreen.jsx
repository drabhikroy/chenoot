import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal.jsx';

// 'Appearance' tab.
//
// This is separate from Settings since nothing here changes the
// questionnaire itself. Settings affect what the app produces. Appearance
// changes only how it looks.
//
// Changes appear immediately rather than waiting to be saved. That lets someone
// judge a display choice as soon as they make it.

// There are two display modes and five color palettes. Each option is described
// by what it is designed for, not only by its technical name. A term such as
// "Tritanopia" may be familiar to some people but not to everyone.
const MODES = [
  { id: 'dark', label: 'Dark', hint: 'Near black, warm, easier for long sessions' },
  { id: 'light', label: 'Light', hint: 'Warm paper' }
];

const PALETTES = [
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Full color vision'
  },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia',
    hint: 'Green-weak. Built on blue against amber'
  },
  {
    id: 'protanopia',
    label: 'Protanopia',
    hint: 'Red-weak. Built on blue against amber'
  },
  {
    id: 'tritanopia',
    label: 'Tritanopia',
    hint: 'Blue-weak. Built on red against green'
  },
  {
    id: 'achromatopsia',
    label: 'Monochromacy',
    hint: 'No hue at all. Separated by lightness'
  }
];

// The six process states are shown together in the selected palette so people
// can judge the colors by seeing them in use.
function Swatches() {
  const states = ['pending', 'running', 'complete', 'flagged', 'error', 'dropped'];
  return (
    <div className="swatches" aria-hidden="true">
      {states.map(function (state) {
        return (
          <span className="swatch" key={state}>
            <span className={'swatch-chip state-bg-' + state} />
            <span className="swatch-label">{state}</span>
          </span>
        );
      })}
    </div>
  );
}

// Keeps track of the palette being previewed so the previous one can be restored.
// A null value means no palette is currently being previewed.
export function AppearanceScreen({ settings, onChange, onClose }) {
  const [preview, setPreview] = useState(null);

  // The preview is restored when someone leaves this screen, regardless of how
  // they leave. Without this, moving away while hovering over a palette could
  // leave the app showing colors that were never selected.
  useEffect(function () {
    return function () {
      document.documentElement.dataset.palette = settings.palette;
    };
  }, [settings.palette]);

  // Hovering over a palette previews it across the whole window, then restores the
  // previous choice when the pointer leaves. Seeing the colors across the interface
  // is more useful than judging them from a few swatches.
  function beginPreview(palette) {
    if (preview === null) {
      setPreview(settings.palette);
    }
    document.documentElement.dataset.palette = palette;
  }
  function endPreview() {
    if (preview !== null) {
      document.documentElement.dataset.palette = preview;
      setPreview(null);
    }
  }

  // Both groups write straight through to settings on click. There is no save
  // step, so the modal footer offers only a way out.
  return (
    <Modal title="Appearance" onClose={onClose} footer={
      <>
        <button onClick={onClose}>Done</button>
        <span className="field-hint">
          Changes apply immediately. Nothing here affects what the questionnaire produces.
        </span>
      </>
    }>
      <div className="appearance">
        <h2>Display mode</h2>
        <div className="choice-row">
          {MODES.map(function (mode) {
            return (
              <button
                key={mode.id}
                className={'choice' + (settings.theme === mode.id ? ' current' : '')}
                onClick={function () { onChange({ theme: mode.id }); }}
                aria-pressed={settings.theme === mode.id}
              >
                <span className="choice-label">{mode.label}</span>
                <span className="choice-hint">{mode.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Five palettes, each previewing on hover and focus so a keyboard
            reaches the same preview a pointer does. */}
        <h2>Color vision</h2>
        <p className="help-para">
          Every color set has enough contrast to meet WCAG 2.2 AA accessibility standards. The different
          states also remain easy to tell apart when tested for color-vision differences. Each one has
          its own shape and label, so meaning never depends on color alone.
        </p>
        <div className="choice-grid">
          {PALETTES.map(function (palette) {
            return (
              <button
                key={palette.id}
                className={'choice' + (settings.palette === palette.id ? ' current' : '')}
                onClick={function () {
                  setPreview(null);
                  onChange({ palette: palette.id });
                }}
                onMouseEnter={function () { beginPreview(palette.id); }}
                onMouseLeave={endPreview}
                onFocus={function () { beginPreview(palette.id); }}
                onBlur={endPreview}
                aria-pressed={settings.palette === palette.id}
              >
                <span className="choice-label">{palette.label}</span>
                <span className="choice-hint">{palette.hint}</span>
              </button>
            );
          })}
        </div>

      </div>
    </Modal>
  );
}
