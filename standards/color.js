// Color science supporting the automated accessibility audit.
//
// Two separate questions are answered here, and they are often confused. WCAG
// contrast asks whether text is legible against its background, which is a
// luminance question. Color-vision safety asks whether two status colors remain
// tellable apart from each other, which is a chromatic separation question. A
// palette can pass the first and fail the second, so both are measured.

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255
  ];
}

// The sRGB transfer function. WCAG defines contrast on linearized channels,
// not on the gamma-encoded values that appear in a stylesheet.
function toLinear(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function toGamma(channel) {
  const clamped = Math.min(1, Math.max(0, channel));
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// Vienot, Brettel, and Mollon (1999) dichromat simulation matrices, applied to
// linear RGB. These are an approximation, not a clinical model, but they
// are the standard basis for automated palette checking and they catch the
// failure that matters most here, which is two status colors collapsing onto
// the same perceived hue.
const CVD_MATRICES = {
  protanopia: [
    [0.11238, 0.88762, 0],
    [0.11238, 0.88762, 0],
    [0.00401, -0.00401, 1]
  ],
  deuteranopia: [
    [0.29275, 0.70725, 0],
    [0.29275, 0.70725, 0],
    [-0.02234, 0.02234, 1]
  ],
  tritanopia: [
    [1, 0.14461, -0.14461],
    [0, 1, 0],
    [0, 0.85164, 0.14836]
  ]
};

function simulate(hex, type) {
  if (type === 'none') {
    return hex;
  }
  // Achromatopsia is total absence of color vision instead of a confusion
  // between two axes, so it is not a matrix projection. Every color collapses
  // to its own luminance, which means a palette for it has to separate on
  // lightness alone and hue can carry nothing at all.
  if (type === 'achromatopsia') {
    const gray = toGamma(relativeLuminance(hex));
    const byte = Math.round(gray * 255).toString(16).padStart(2, '0');
    return '#' + byte + byte + byte;
  }
  const matrix = CVD_MATRICES[type];
  const linear = hexToRgb(hex).map(toLinear);
  const converted = matrix.map(function (row) {
    return row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2];
  });
  return '#' + converted
    .map(function (value) {
      const byte = Math.round(toGamma(value) * 255);
      return byte.toString(16).padStart(2, '0');
    })
    .join('');
}

// CIELAB conversion, used only to measure how far apart two colors sit
// perceptually. D65 white point, matching sRGB.
function toLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = function (t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  };
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// Plain CIE76 distance. It overstates differences in saturated blues, but for
// a pass or fail threshold on a six-color status set it is adequate and it is
// easy to reason about when a check fails.
function deltaE(hexA, hexB) {
  const a = toLab(hexA);
  const b = toLab(hexB);
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

module.exports = { contrastRatio, relativeLuminance, simulate, deltaE };
