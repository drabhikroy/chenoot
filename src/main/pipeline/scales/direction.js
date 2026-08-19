// Which way a response scale reads, and the anchors that result.
//
// The catalog stores every scale in ascending order, from the least of the
// thing to the most, because that is the order the psychometric literature
// writes them in and the order the scoring assumes. What a respondent sees is a
// separate question, and the two are separated here.
//
// The default presentation puts the most positive anchor first. That is what
// most published instruments do, and reading a scale that opens with the
// strongest agreement is easier than one that opens with the strongest
// disagreement. Anything can be turned around: a single item, or every item in
// the instrument at once.
//
// Reversing presentation is not reverse keying. A reverse-keyed item is one
// whose wording runs against the construct, and its scoring is inverted. This
// is the order the same anchors are printed in. An instrument can use both, and
// confusing them silently inverts a score, so they are kept in separate fields
// with separate names.

const DESCENDING = 'positive-first';
const ASCENDING = 'negative-first';

// The order an item is presented in, working outward from the most specific
// setting to the least. An item may override the instrument, and the instrument
// may override the default.
function orderFor(item, instrument) {
  if (item && typeof item.scaleOrder === 'string') {
    return item.scaleOrder;
  }
  if (instrument && instrument.scale && typeof instrument.scale.order === 'string') {
    return instrument.scale.order;
  }
  return DESCENDING;
}

// The anchors as printed, in the order they will appear.
//
// The stored labels are never modified. Reversing a copy means the ascending
// order stays available for scoring, which needs it whichever way the anchors
// were shown.
function presentedAnchors(labels, order) {
  if (!Array.isArray(labels)) {
    return [];
  }
  return order === ASCENDING ? labels.slice() : labels.slice().reverse();
}

// The number printed beside an anchor.
//
// Scoring runs on the ascending scale regardless of presentation, so an anchor
// shown first on a descending five point scale is still point five. Printing
// 5 4 3 2 1 down the page is what tells a reader which end is which, and it is
// what keeps a completed questionnaire scorable without knowing how it was laid
// out.
function pointsFor(count, order) {
  const ascending = Array.from({ length: count }, function (_, index) { return index + 1; });
  return order === ASCENDING ? ascending : ascending.reverse();
}

// A description of the order, for the record kept with each run.
function describeOrder(order) {
  return order === ASCENDING
    ? 'Anchors printed from the least of the attribute to the most.'
    : 'Anchors printed from the most of the attribute to the least.';
}

module.exports = {
  DESCENDING, ASCENDING, orderFor, presentedAnchors, pointsFor, describeOrder
};
