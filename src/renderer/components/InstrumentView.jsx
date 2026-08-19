import { useState } from 'react';
import { ItemFormat } from './ItemFormat.jsx';
import { orderFor, presentedAnchors, ASCENDING } from '../scale-order.js';

// How the finished instrument is presented. Four layouts, each answering a
// different question, because a list of items is read for at least four
// different reasons and one arrangement cannot serve all of them. GROUPED is
// the default. Each dimension becomes a bounded region holding a small number
// of items, which is chunking in the ordinary sense: a set of five items
// inside a labeled container is held in working memory as one thing, where the
// same five in a continuous run are held as five. Gestalt common region does
// the grouping more strongly than the whitespace alone was doing, and it is
// why twenty-six items stopped feeling like twenty-six. CONTINUOUS is the
// previous behavior, kept because sequential reading of the whole instrument
// is a real task and containers interrupt it. COMPACT strips everything but
// position, keying, and text. For checking a draft against notes, where the
// question is what is there, not how it reads. RESPONDENT shows each item with
// the scale beneath it, as the person answering will meet it.

function Anchors({ labels }) {
  return (
    <ol className="preview-anchors">
      {labels.map(function (label, index) {
        return (
          <li key={label + index}>
            <span className="preview-radio" aria-hidden="true" />
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ItemRow({
  item, index, formats, currentFormat, onChangeFormat, onFlipItem, layout, scaleLabels, scale
}) {
  const showControls = layout !== 'compact';

  // An item that carries its own format is answered on that format's anchors,
  // not the instrument's. Falling back to the instrument's was showing a
  // five-point set beneath an item labeled as seven-point.
  const own = item.format
    ? formats.find(function (f) { return f.id === item.format; })
    : null;
  // Printed in the order the instrument records, which is most positive first
  // unless this item or the instrument says otherwise.
  const stored = own && own.labels ? own.labels : scaleLabels;
  const anchors = presentedAnchors(stored, orderFor(item, scale));
  const isScale = own ? own.kind === 'scale' : true;

  return (
    <li className="instrument-item" title={item.id}>
      <span className="value itemid" data-full={item.id}>{index + 1}</span>
      {item.direction === 'reverse'
        ? <span className="keying" title="Reverse keyed">R</span>
        : <span className="keying keying-blank" aria-hidden="true" />}
      <span className="item-body">
        <span className="item-text">{item.text}</span>

        {item.responseOptions ? (
          <span className="item-options">{item.responseOptions.join(' / ')}</span>
        ) : null}

        {/* The scale appears under the item only in respondent view. Elsewhere
            it would repeat identically under every row and become noise. */}
        {layout === 'respondent' && isScale && anchors && !item.responseOptions ? (
          <Anchors labels={anchors} />
        ) : null}

        {showControls && formats.length > 0 ? (
          <span className="item-controls">
            <ItemFormat
              item={item}
              currentFormat={currentFormat}
              formats={formats}
              onChange={onChangeFormat}
            />
            {/* One item turned around on its own, for the case where a single
                question reads better the other way. Items with their own
                written options are left out: those are not a shared scale and
                reversing them is a wording decision. */}
            {isScale && !item.responseOptions && onFlipItem ? (
              <button
                className="link-button item-flip"
                onClick={function () { onFlipItem(item); }}
              >
                {orderFor(item, scale) === ASCENDING
                  ? 'Most positive first'
                  : 'Most negative first'}
              </button>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}

export function InstrumentView({
  instrument, layout, formats, adjusted, onChangeFormat, onFlipItem,
  distributionFor, removedFor, Calibration
}) {
  const scale = instrument.scale;

  return (
    <div className={'instrument instrument-' + layout}>
      {instrument.dimensions.map(function (dimension) {
        const items = dimension.items.map(function (original) {
          return adjusted[original.id] || original;
        });

        return (
          <Dimension
            key={dimension.name}
            dimension={dimension}
            items={items}
            layout={layout}
            scale={scale}
            formats={formats}
            onChangeFormat={onChangeFormat}
            onFlipItem={onFlipItem}
            distributionFor={distributionFor}
            removedFor={removedFor}
            Calibration={Calibration}
          />
        );
      })}
    </div>
  );
}

// One dimension, collapsible in grouped view and always open in the others.
// Collapsing a continuous read or a respondent preview would defeat the reason
// someone chose those layouts.
// Every prop a row needs travels through here. A prop used by ItemRow and not
// declared on this signature resolves to nothing at build time and throws the
// moment a dimension renders, which takes the whole screen with it.
function Dimension({
  dimension, items, layout, scale, formats, onChangeFormat, onFlipItem,
  distributionFor, removedFor, Calibration
}) {
  const collapsible = layout === 'grouped';
  const [open, setOpen] = useState(true);
  const showing = collapsible ? open : true;

  return (
          <section className={'dimension' + (showing ? '' : ' collapsed')}>
            <div className="dimension-head">
              {collapsible ? (
                <button
                  className="dimension-toggle"
                  onClick={function () { setOpen(!open); }}
                  aria-expanded={showing}
                >
                  <span className="disclosure" aria-hidden="true" />
                  <h2>{dimension.name}</h2>
                </button>
              ) : (
                <h2>{dimension.name}</h2>
              )}
              <span className="value dimension-count">
                {items.length} {items.length === 1 ? 'item' : 'items'}
                {dimension.targetItemCount && items.length !== dimension.targetItemCount
                  ? ' of ' + dimension.targetItemCount + ' targeted'
                  : ''}
              </span>
            </div>

            {/* The definition is hidden in compact view. It is context for
                reading the items, and compact exists for checking that they are
                there. */}
            {layout === 'compact' || !showing ? null : (
              <p className="field-hint">{dimension.definition}</p>
            )}

            {!showing ? null : items.length === 0 ? (
              <p className="state-dropped">No items survived for this dimension.</p>
            ) : (
              <ol className="itemlist">
                {items.map(function (item, index) {
                  return (
                    <ItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      layout={layout}
                      formats={formats}
                      currentFormat={scale.scaleType}
                      onChangeFormat={onChangeFormat}
                      scaleLabels={scale.scaleLabels}
                      scale={scale}
                      onFlipItem={onFlipItem}
                    />
                  );
                })}
              </ol>
            )}

            {/* Evidence sits with the items it describes, except in respondent
                view, where nothing a respondent would not see belongs. */}
            {layout === 'respondent' || layout === 'compact' || !showing ? null : (
              <Calibration
                distribution={distributionFor(dimension.name)}
                removed={removedFor(dimension.name)}
              />
            )}
          </section>
  );
}
