// A stacked bar showing how much of a run was measured against how much was
// judged or recalled.
//
// This is the single most useful thing a reader can learn about an audit trail
// before opening it. Forty-two decisions tells you nothing. Thirty-eight
// measured, four judged, none recalled tells you the instrument rests mostly on
// arithmetic, and that is a different document from one where the proportions
// are reversed.
//
// The bar sits on the collapsed summary so the proportion is visible without
// expanding anything, which is the whole point of putting it there.

const ORDER = [
  { key: 'measured', label: 'Measured' },
  { key: 'judged', label: 'Model judgment' },
  { key: 'recalled-unverified', label: 'Unverified recall' },
  { key: 'user-supplied', label: 'Supplied' }
];

export function ProvenanceBar({ steps }) {
  const counts = {};
  let total = 0;
  steps.forEach(function (step) {
    step.decisions.forEach(function (decision) {
      counts[decision.provenance] = (counts[decision.provenance] || 0) + 1;
      total += 1;
    });
  });

  if (total === 0) {
    return null;
  }

  const present = ORDER.filter(function (band) { return counts[band.key] > 0; });

  return (
    <div className="provenance">
      <div
        className="provenance-bar"
        role="img"
        aria-label={present.map(function (band) {
          return counts[band.key] + ' ' + band.label.toLowerCase();
        }).join(', ')}
      >
        {present.map(function (band) {
          return (
            <span
              key={band.key}
              className={'provenance-band provenance-' + band.key}
              style={{ width: ((counts[band.key] / total) * 100) + '%' }}
            />
          );
        })}
      </div>
      <ul className="provenance-key">
        {present.map(function (band) {
          return (
            <li key={band.key}>
              <span className={'provenance-swatch provenance-' + band.key} aria-hidden="true" />
              <span className="value">{counts[band.key]}</span> {band.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
