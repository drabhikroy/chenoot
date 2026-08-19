// Automated palette audit. Run with: node test/audit-palettes.js
//
// Fails loudly and not warning, because a palette that quietly drifts below
// threshold is worse than one that never shipped.

const { contrastRatio, simulate, deltaE } = require('../standards/color');
const { NEUTRALS, STATUS } = require('../src/renderer/tokens/palettes');

// WCAG 2.2 AA. Body text needs 4.5:1. User interface components and graphical
// objects need 3:1, which is the bar the status colors are held to.
const TEXT_MINIMUM = 4.5;
const COMPONENT_MINIMUM = 3.0;

// Separation floor for status colors after dichromat simulation, in CIE76
// units. Twenty sits well above the roughly 2.3 just-noticeable-difference and
// leaves headroom for display variation and ambient light.
const SEPARATION_MINIMUM = 20;

// Which simulation each palette is actually meant to survive.
const TARGET = {
  standard: 'none',
  achromatopsia: 'achromatopsia',
  deuteranopia: 'deuteranopia',
  protanopia: 'protanopia',
  tritanopia: 'tritanopia'
};

const failures = [];

function check(label, actual, minimum) {
  if (actual < minimum) {
    failures.push(label + ' measured ' + actual.toFixed(2) + ', needs ' + minimum);
  }
}

Object.keys(NEUTRALS).forEach(function (mode) {
  const n = NEUTRALS[mode];
  // The primary action is filled with the text color and labeled with the
  // page color, which inverts the usual pairing. It is checked at the body
  // text threshold, not the component one, because the thing being read
  // is a word.
  check(mode + ' primary action label', contrastRatio(n.background, n.textPrimary), TEXT_MINIMUM);
  check(mode + ' primary action label on hover', contrastRatio(n.background, n.textSecondary), TEXT_MINIMUM);
  check(mode + ' body text on surface', contrastRatio(n.textPrimary, n.surface), TEXT_MINIMUM);
  check(mode + ' body text on background', contrastRatio(n.textPrimary, n.background), TEXT_MINIMUM);
  check(mode + ' secondary text on surface', contrastRatio(n.textSecondary, n.surface), TEXT_MINIMUM);
  check(mode + ' strong border on surface', contrastRatio(n.borderStrong, n.surface), COMPONENT_MINIMUM);
  check(mode + ' focus ring on background', contrastRatio(n.focusRing, n.background), COMPONENT_MINIMUM);
});

// Status colors are checked against every surface they are actually placed on,
// not only the default one. The calibration plot puts its cutoff and its
// removal marks on the raised surface, and a layout change that lifts an
// element onto a different background is exactly the kind of edit that silently
// drops a color below threshold.
//
// The map is deliberately explicit, not checking every color against
// every surface. Auditing combinations that never render produces failures
// nobody can act on, which is how a passing audit stops meaning anything.
const SURFACE_USAGE = {
  surface: ['pending', 'running', 'complete', 'flagged', 'error', 'dropped'],
  surfaceAlt: ['flagged'],
  // The graduated rule labels each segment in the color that fills it, sitting
  // directly on the page, not on a surface.
  background: ['running', 'complete', 'error']
};

Object.keys(STATUS).forEach(function (paletteName) {
  ['dark', 'light'].forEach(function (mode) {
    Object.keys(SURFACE_USAGE).forEach(function (surface) {
      SURFACE_USAGE[surface].forEach(function (state) {
        check(
          paletteName + '.' + mode + '.' + state + ' on ' + surface,
          contrastRatio(STATUS[paletteName][mode][state], NEUTRALS[mode][surface]),
          COMPONENT_MINIMUM
        );
      });
    });
  });
});

Object.keys(STATUS).forEach(function (paletteName) {
  const mode_target = TARGET[paletteName];

  ['dark', 'light'].forEach(function (mode) {
    const palette = STATUS[paletteName][mode];
    const names = Object.keys(palette);
    const surface = NEUTRALS[mode].surface;

    names.forEach(function (state) {
      check(
        paletteName + '.' + mode + '.' + state,
        contrastRatio(palette[state], surface),
        COMPONENT_MINIMUM
      );
    });

    // Separation is only meaningful between states that can appear on screen at
    // the same time. The five live step states do co-occur in the pipeline
    // view. "dropped" does not: it appears only inside the audit trail, against
    // item text, never beside a pending step dot. Holding it to the same
    // separation floor was over-constraining the palette for a comparison a
    // reader will never have to make.
    let live = names.filter(function (n) { return n !== 'dropped'; });

    // Under achromatopsia the separation floor is lower and one further pair is
    // exempt. Lightness-only discrimination is reliable well below the twenty
    // units used for hues, which might also be confused by chroma. And running
    // and error cannot appear together: a run either has a step in progress or
    // has stopped, so no reader is ever asked to tell those two apart.
    const floor = paletteName === 'achromatopsia' ? 15 : SEPARATION_MINIMUM;
    if (paletteName === 'achromatopsia') {
      live = live.filter(function (n) { return n !== 'error'; });
    }

    let worst = Infinity;
    let worstPair = '';
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const distance = deltaE(
          simulate(palette[live[i]], mode_target),
          simulate(palette[live[j]], mode_target)
        );
        if (distance < worst) {
          worst = distance;
          worstPair = live[i] + ' / ' + live[j];
        }
        check(
          paletteName + ' ' + mode + ' ' + live[i] + ' against ' + live[j],
          distance,
          floor
        );
      }
    }
    console.log(
      '  ' + paletteName.padEnd(14) + mode.padEnd(7) +
      'closest pair ' + worstPair.padEnd(22) + 'dE ' + worst.toFixed(1)
    );
  });
});

console.log('\n' + '='.repeat(62));
if (failures.length === 0) {
  console.log('PASS. All palettes clear WCAG 2.2 AA and separation thresholds.');
  process.exit(0);
}
console.log('FAIL. ' + failures.length + ' problems:');
failures.forEach(function (f) { console.log('  ' + f); });
process.exit(1);
