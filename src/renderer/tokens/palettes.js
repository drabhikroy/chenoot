// Four color-vision palettes for the pipeline status system. One ground in
// dark mode. The page and the reading surface are the same value, so there is
// no frame and no second gray. Two earlier arrangements failed for the same
// reason. A raised panel has to be lighter than the page, which makes the
// largest area on screen the grayest thing on it. Neither problem exists once
// the two are one tone: the eye reads dark everywhere, and structure comes
// from the timeline, the type, and the spacing, not from a rectangle.
// surfaceAlt is the only lifted tone, used sparingly for the running step,
// the form fields, and the modal chrome. Dark mode sits near black without
// reaching it. Pure black against light text produces halation, the smearing
// that makes glyphs bloom for astigmatic and low-vision readers, which is why
// every interface that has looked at this stops a little short of it. These
// values are warm, not neutral, so the ground reads as unlit, not as switched
// off. The neutral ramp is warm graphite in dark mode and warm paper in light.
// That is a deliberate move away from the blue-slate every dark interface
// ships, and it is doing structural work and not decorative: with the neutrals
// carrying the warmth, color belongs entirely to status, and nothing in the
// interface competes with the six hues that actually mean something. There is
// no brand accent for the same reason. Status colors are defined separately
// for dark and light mode. This is not duplication for its own sake. A hue
// light enough to clear 3:1 against a dark surface sits at roughly 1.8:1
// against white, so one shared value cannot satisfy both modes. The first
// audit run failed on exactly this, and splitting the definitions is the only
// correct fix. Two constraints govern every value. Each status color clears
// 3:1 against the surface it sits on, which is the WCAG 2.2 AA threshold for
// user interface components, not the 4.5:1 body text threshold. Each status
// color also stays at least twenty CIE76 units from the other five once the
// relevant dichromat simulation is applied. Color is never the only signal.
// Every status is also carried by an icon shape and a text label, so a reader
// who cannot separate two hues still has two independent channels reporting
// the same state. The palettes make the interface comfortable; they do not
// carry meaning alone.

const NEUTRALS = {
  dark: {
    background: '#100F0E',
    surface: '#100F0E',
    // Named for what it does, not for elevation. Elevation is a dark
    // mode metaphor: a raised plane catches more light and goes lighter. In
    // light mode the page is already near white, so the only direction
    // available is darker, and a token called "raised" would be describing the
    // opposite of what it renders. This one steps away from the page in
    // whichever direction reads as not-the-page, which is true in both.
    surfaceAlt: '#211E1C',
    // Grouping is done with whitespace and common region per the Gestalt
    // requirement, so this border is a quiet seam and is held to a low
    // informational threshold. Controls whose boundary is their only
    // identifying mark use borderStrong instead, which clears 3:1.
    border: '#3B3935',
    borderStrong: '#726E66',
    textPrimary: '#EDE9E1',
    textSecondary: '#A8A398',
    focusRing: '#E5D6AE'
  },
  light: {
    background: '#E3DED2',
    surface: '#FAF8F3',
    surfaceAlt: '#EDE8DC',
    border: '#CFC9BB',
    borderStrong: '#8A8377',
    textPrimary: '#1E1C18',
    textSecondary: '#565149',
    focusRing: '#6B5A2E'
  }
};

// "dropped" is a dim neutral in every palette and not a hue. An item cut
// after three revision attempts is inert, so gray reads correctly and frees one
// slot of chromatic separation for the states that still compete for attention.
const STATUS = {
  // Full color vision. The one palette where hue can do ordinary work.
  standard: {
    dark: {
      pending: '#B3C3D6',
      running: '#45C8E8',
      complete: '#4FD494',
      flagged: '#F5B63F',
      error: '#FF7F6E',
      dropped: '#67727F'
    },
    light: {
      pending: '#4A5A6B',
      running: '#0F7A96',
      complete: '#15784F',
      flagged: '#8A5B00',
      error: '#B2382A',
      dropped: '#79838D'
    }
  },
  // Deuteranopia and protanopia both collapse the red to green axis, so both
  // palettes are built on blue against amber and separated further by lightness.
  deuteranopia: {
    dark: {
      pending: '#8C99A6',
      running: '#3E92E0',
      complete: '#CDEBFF',
      flagged: '#F2C14E',
      error: '#D4622A',
      dropped: '#67727F'
    },
    light: {
      pending: '#4A5A6B',
      running: '#1C6BAF',
      complete: '#0A4374',
      flagged: '#8A6800',
      error: '#6B2A06',
      dropped: '#79838D'
    }
  },
  protanopia: {
    dark: {
      pending: '#8C99A6',
      running: '#4A9BE8',
      complete: '#D2EEFF',
      flagged: '#F6CE5C',
      error: '#D2701F',
      dropped: '#67727F'
    },
    light: {
      pending: '#4A5A6B',
      running: '#1F72B8',
      complete: '#0B4677',
      flagged: '#8E6B07',
      error: '#6E2E06',
      dropped: '#79838D'
    }
  },
  // Achromatopsia is the absence of color vision, so this palette has no hues
  // at all and every distinction is carried by lightness.
  //
  // Lightness alone cannot carry six states. Solving for grays that both clear
  // 3:1 against the surface and stay reliably apart from each other yields four
  // steps, not six, and stretching them further would mean claiming a
  // separation that is not there.
  //
  // So two pairs share a tone, chosen by what can never appear together rather
  // than by what looks acceptable. "pending" and "dropped" are both inert and
  // never render on the same screen. "running" and "error" are mutually
  // exclusive by construction: a run either has a step in progress or has
  // stopped. Within each pair the mark, the word, and in one case the pulse
  // still tell them apart, which is why the interface has never relied on
  // color alone.
  achromatopsia: {
    dark: {
      pending: '#6B6B6B',
      dropped: '#6B6B6B',
      complete: '#929292',
      flagged: '#BBBBBB',
      running: '#E5E5E5',
      error: '#E5E5E5'
    },
    light: {
      pending: '#6C6C6C',
      dropped: '#6C6C6C',
      complete: '#484848',
      flagged: '#262626',
      running: '#000000',
      error: '#000000'
    }
  },

  // Tritanopia collapses the blue to yellow axis, so this palette moves onto the
  // red to green axis that remains available.
  tritanopia: {
    dark: {
      pending: '#B7C1CA',
      running: '#A87EF5',
      complete: '#3FC97A',
      flagged: '#F5A09E',
      error: '#E05752',
      dropped: '#67727F'
    },
    light: {
      pending: '#4A5A6B',
      running: '#6A3BC4',
      complete: '#14804A',
      flagged: '#C0453F',
      error: '#6E1B18',
      dropped: '#79838D'
    }
  }
};

const PALETTE_LABELS = {
  standard: 'Standard',
  achromatopsia: 'Monochromacy',
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia'
};

module.exports = { NEUTRALS, STATUS, PALETTE_LABELS };
