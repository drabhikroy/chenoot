// Which way a response scale reads, for the interface.
//
// The same rules the main process applies when it exports. They are stated
// twice because the renderer cannot require from the main process, and the
// alternative is a call across the bridge every time a row of anchors appears.
// The two files are small, and a test holds them to the same answers.
//
// The catalog stores every scale ascending, from the least of the attribute to
// the most. That order is what scoring uses. The order a respondent sees is a
// separate thing, and by default it puts the most positive anchor first, which
// is what most published instruments do.
//
// This is not reverse keying. A reverse-keyed item is worded against the
// construct and its score is inverted. This is the order the same anchors are
// printed in, and it never changes a score.

export const DESCENDING = 'positive-first';
export const ASCENDING = 'negative-first';

// Most specific setting wins. An item may override the instrument, and the
// instrument may override the default.
export function orderFor(item, scale) {
  if (item && typeof item.scaleOrder === 'string') {
    return item.scaleOrder;
  }
  if (scale && typeof scale.order === 'string') {
    return scale.order;
  }
  return DESCENDING;
}

// A copy in the order the anchors are printed. The stored array is left as it
// is, because scoring needs the ascending order whichever way they were shown.
export function presentedAnchors(labels, order) {
  if (!Array.isArray(labels)) {
    return [];
  }
  return order === ASCENDING ? labels.slice() : labels.slice().reverse();
}

// The number printed beside each anchor. Scoring runs on the ascending scale
// regardless of presentation, so a descending five point scale prints 5 4 3 2 1
// and a completed questionnaire stays scorable without knowing the layout.
export function pointsFor(count, order) {
  const ascending = Array.from({ length: count }, function (_, index) { return index + 1; });
  return order === ASCENDING ? ascending : ascending.reverse();
}
