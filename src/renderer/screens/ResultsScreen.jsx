import { useEffect, useState } from 'react';
import { GraduatedRule } from '../components/GraduatedRule.jsx';
import { RunParameters } from '../components/RunParameters.jsx';
import { CalibrationScale } from '../components/CalibrationScale.jsx';
import { ProvenanceBar } from '../components/ProvenanceBar.jsx';
import { InstrumentView } from '../components/InstrumentView.jsx';
import { Modal } from '../components/Modal.jsx';
import {
  orderFor, presentedAnchors, pointsFor, DESCENDING, ASCENDING
} from '../scale-order.js';
import { ApplyFormatDialog } from '../components/ApplyFormatDialog.jsx';
import { FormatReference } from '../components/FormatReference.jsx';

// 'This run' tab.
//
// This screen matters because it is the last thing someone sees after
// watching the run progress.
//
// The graduated rule appears again at the top with every step complete. It is
// the only element carried over from the progress screen, which helps make the
// run feel complete rather than simply stopped.
//
// Dates are shown as dates rather than timestamps. This is a document someone
// may save or file, and the exact time it was created is not usually needed.
function formatBuilt(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return '';
  }
  return when.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const PROVENANCE_LABEL = {
  measured: 'Measured',
  judged: 'Model judgment',
  'recalled-unverified': 'Unverified recall',
  'user-supplied': 'Supplied'
};

// Only export formats that are currently available are shown. Word and PDF are
// left out rather than shown as disabled options, since unavailable controls
// add clutter without giving someone anything they can use.
const FORMATS = [
  { id: 'docx', label: 'Word', hint: 'The instrument as a document, with the trail as an appendix' },
  { id: 'pdf', label: 'PDF', hint: 'This page, laid out for paper' },
  { id: 'json', label: 'JSON', hint: 'Instrument and full audit trail' },
  { id: 'csv', label: 'CSV', hint: 'Items in administration order' },
  { id: 'txt', label: 'Text', hint: 'Readable audit trail' }
];

function AuditTable({ steps }) {
  // Decisions from every step appear in one table, with their basis shown in a
  // separate column. Grouping them by step would make it harder to see which
  // decisions came from measured checks and which required judgment.
  const rows = [];
  steps.forEach(function (step) {
    step.decisions.forEach(function (decision, index) {
      rows.push(
        <tr key={step.number + '-' + index}>
          <td className="num">{step.number}</td>
          <td>{decision.description}</td>
          <td className="num">{decision.evidence || ''}</td>
          <td className={'num provenance-' + decision.provenance}>
            {PROVENANCE_LABEL[decision.provenance] || decision.provenance}
          </td>
        </tr>
      );
    });
  });

  if (rows.length === 0) {
    return <p className="field-hint">No decisions were recorded.</p>;
  }
  return (
    <table className="audit">
      <thead>
        <tr><th>Step</th><th>Decision</th><th>Evidence</th><th>Basis</th></tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

// The completed run arrives as one complete result rather than being requested
// piece by piece. The app already received it when the process finished, so
// asking for the same information again would add unnecessary requests.
const LAYOUTS = [
  { id: 'grouped', label: 'Grouped', hint: 'Dimensions as bounded sets' },
  { id: 'continuous', label: 'Continuous', hint: 'One list, dividers between items' },
  { id: 'compact', label: 'Compact', hint: 'Text only, for checking against notes' },
  { id: 'respondent', label: 'As respondents see it', hint: 'Each item above its scale' }
];

export function ResultsScreen({
  result, input, steps, layout, onLayout, onNewRun, onHistory, onRerun, onReview, onRerender
}) {
  // Rerunning requires confirmation because it takes the same twenty to forty
  // minutes as the original run. A single click should not start something this
  // time-consuming by accident.
  const [confirmingRerun, setConfirmingRerun] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);

  // Turning the whole instrument around. The main process holds the instrument
  // and rewrites it, so the screen reloads rather than keeping a second copy of
  // the answer.
  // One item, turned around on its own. The instrument keeps whatever order it
  // had, and this item stops following it.
  function flipOneScale(item) {
    const next = orderFor(item, scale) === ASCENDING ? DESCENDING : ASCENDING;
    window.chenoot.setScaleOrder({ itemId: item.id, order: next }).then(function (outcome) {
      if (outcome.ok && onRerender) {
        onRerender(outcome);
      }
    });
  }

  function flipEveryScale() {
    const next = orderFor(null, scale) === ASCENDING ? DESCENDING : ASCENDING;
    setFlipping(true);
    window.chenoot.setScaleOrder({ order: next }).then(function (outcome) {
      setFlipping(false);
      if (outcome.ok && onRerender) {
        onRerender(outcome);
      }
    });
  }
  // Response formats are loaded once and shared across all item controls. Loading
  // the same list for every item would repeat an unnecessary request for data that
  // does not change.
  const [formats, setFormats] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  // Once edited, items are kept on this screen so changes appear immediately
  // without sending the entire run back to the main process.
  const [adjusted, setAdjusted] = useState({});

  useEffect(function () {
    window.chenoot.itemFormats().then(function (outcome) {
      setFormats(outcome.formats || []);
    });
    window.chenoot.exportPlatforms().then(function (outcome) {
      setPlatforms(outcome.platforms || []);
    });
  }, []);

  function changeFormat(itemId, format) {
    return window.chenoot.regenerateItem({ itemId, format }).then(function (outcome) {
      if (outcome.ok) {
        setAdjusted(function (previous) {
          return Object.assign({}, previous, { [itemId]: outcome.item });
        });
      }
      return outcome;
    });
  }

  const [exportState, setExportState] = useState(null);
  // Used only while a PDF is being created. The print stylesheet responds to this
  // state, so the screen briefly switches to the paper layout. This gives an
  // accurate preview of the PDF rather than indicating a problem.
  const [printing, setPrinting] = useState(false);
  const instrument = result.instrument;
  const scale = instrument.scale;
  // The numbers printed beside the anchors. They follow the ascending scale
  // whichever way the anchors are ordered, so the most positive anchor on a
  // descending scale is still the top point.
  const scalePoints = pointsFor(
    scale && scale.scaleLabels ? scale.scaleLabels.length : 0,
    orderFor(null, scale)
  );

  // Coverage statistics are optional. If embeddings were unavailable during a run,
  // there are no coverage results, so the charts are simply left out rather than
  // calling attention to information that was never produced.
  const coverage = result.coverage || { distributions: [], removedDuplicates: [] };

  // Items that use a different response format from the questionnaire default.
  // This keeps the scale summary from describing every item as if it used the same format.
  const overridden = Object.keys(adjusted).filter(function (id) {
    return adjusted[id].format && adjusted[id].format !== instrument.scale.scaleType;
  });

  function distributionFor(name) {
    return (coverage.distributions || []).find(function (d) { return d.dimension === name; });
  }
  function removedFor(name) {
    return (coverage.removedDuplicates || []).filter(function (r) { return r.dimension === name; });
  }

  function runExport(format) {
    setExportState({ format, status: 'working' });

    if (format === 'pdf') {
      // The page is printed exactly as shown, so the layout needs to be ready first.
      // The record panel is opened and the print layout is applied, then one frame
      // passes so everything can settle before the page is captured.
      setPrinting(true);
      const panel = document.querySelector('details.audit-panel');
      const wasOpen = panel ? panel.open : false;
      if (panel) {
        panel.open = true;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          window.chenoot.exportPdf().then(function (outcome) {
            setPrinting(false);
            if (panel) {
              panel.open = wasOpen;
            }
            if (outcome.canceled) {
              setExportState(null);
              return;
            }
            setExportState({
              format,
              status: outcome.ok ? 'saved' : 'failed',
              detail: outcome.ok ? outcome.path : outcome.detail
            });
          });
        });
      });
      return;
    }

    window.chenoot.exportRun(format).then(function (outcome) {
      if (outcome.canceled) {
        setExportState(null);
        return;
      }
      setExportState({
        format,
        status: outcome.ok ? 'saved' : 'failed',
        detail: outcome.ok ? outcome.path : outcome.detail
      });
    });
  }

  return (
    <div className={'screen' + (printing ? ' printing' : '')}>
      {/* A calibration certificate starts by stating what was measured, what it
          was compared with, how much variation was allowed, what was used, and
          when it was done. This record follows the same idea by showing how the
          questionnaire was produced before presenting it. */}
      <header className="certificate">
        <p className="eyebrow">Instrument record</p>
        <h1 className="title-display">{instrument.construct}</h1>

        <dl className="certificate-meta">
          <div>
            <dt>Serial</dt>
            <dd className="value">{result.trail.runId}</dd>
          </div>
          <div>
            <dt>Built</dt>
            <dd className="value">{formatBuilt(result.trail.completedAt)}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd className="value">{result.trail.settings ? result.trail.settings.model : ''}</dd>
          </div>
          <div>
            <dt>Decisions</dt>
            <dd className="value">{result.counts.decisions}</dd>
          </div>
        </dl>

        <GraduatedRule steps={steps} currentIndex={steps.length} failedIndex={-1} />

        <p className="lede">
          {instrument.itemCount} items across {instrument.dimensions.length} dimensions,
          {' '}{instrument.reverseKeyedCount} of them reverse keyed.
        </p>
      </header>

      <RunParameters input={input} actualCount={instrument.itemCount} />

      {/* Unverified information is shown on the results screen, not only in the
          record. Someone who exports without opening it still needs to know
          that some details came from model memory and were not verified. */}
      {result.counts.unverified > 0 ? (
        <div className="banner" role="status">
          {result.counts.unverified} entries came from model recall with no source available to
          check them.
          <span className="value">Scale names, attributions, and years may be wrong.</span>
        </div>
      ) : null}

      {/* The scale appears before the items because readers need it to interpret
          the questions that follow. It is also the shorter section, so it works
          naturally as an introduction to the item list. */}
      <h2>Response scale</h2>
      <div className="scale-block">
        <p className="scale-name">{scale.scaleLabel}</p>
        {/* Response options are shown in the same left-to-right order respondents
            will see them. A vertical list would make the overall shape of the
            scale harder to see, including whether the options are balanced. */}
        <ol className="anchor-row" data-points={scale.points}>
          {presentedAnchors(scale.scaleLabels, orderFor(null, scale)).map(function (label, index) {
            return (
              <li key={label + index}>
                <span className="anchor-mark" aria-hidden="true" />
                {/* The scale point, not the position in the row. Printing the
                    position beside a descending scale would number the most
                    positive anchor 1, which is the opposite of what it scores. */}
                <span className="value">{scalePoints[index]}</span>
                <span className="anchor-label">{label}</span>
              </li>
            );
          })}
        </ol>
        <p className="scale-properties value">
          {scale.polarity} &middot; {scale.points} points &middot;
          {' '}{scale.hasMidpoint ? 'midpoint' : 'no midpoint'} &middot;
          {' '}{scale.fullyLabelled === false ? 'endpoints labeled' : 'fully labeled'}
        </p>
        {/* If any item uses a different response format, the block above shows
            the default rather than the format used by every item. Saying so
            keeps the heading accurate. */}
        {overridden.length > 0 ? (
          <p className="field-hint scale-overridden">
            {overridden.length} {overridden.length === 1 ? 'item uses' : 'items use'} a different
            format, shown against {overridden.length === 1 ? 'it' : 'them'} below. This is the
            default for everything else.
          </p>
        ) : null}

        {/* The explanation now sits behind a control instead of appearing in full
            below the response options. It explains why the original format was
            recommended, not what the questionnaire must use. If that format is
            changed later, the explanation may no longer describe what is shown.
            Keeping it behind a control makes it available when needed without
            presenting it as part of the questionnaire itself. */}
        <div className="scale-actions">
          <button className="link-button" onClick={function () { setWhyOpen(true); }}>
            Why this scale
          </button>
          <button className="link-button" onClick={function () { setApplyOpen(true); }}>
            Change every item
          </button>
          {/* One control for the whole instrument. Reversing the presentation
              order changes which end of the scale is printed first and nothing
              else, so it is a toggle rather than a dialog. */}
          <button className="link-button" onClick={flipEveryScale} disabled={flipping}>
            {orderFor(null, scale) === ASCENDING
              ? 'Print scales with the most positive first'
              : 'Print scales with the most negative first'}
          </button>
          {/* This link appears here as well as in Help. Someone considering a
              different response format may need survey-design guidance at this
              point, so the information is available without leaving the choice
              they are making. */}
          <button className="link-button" onClick={function () { setGuideOpen(true); }}>
            Which format should I use
          </button>
        </div>
      </div>

      {whyOpen ? (
        <Modal title="Why this scale" onClose={function () { setWhyOpen(false); }}>
          <div className="notice-body">
            <p className="help-para">{scale.justification}</p>
            <p className="field-hint">
              A recommendation explaining why the response format was chosen is saved with the questionnaire
              so you can review the decision. It reflects the format used when the run finished and will not
              include changes made afterward.
            </p>
          </div>
        </Modal>
      ) : null}

      {guideOpen ? (
        <Modal title="Choosing a response format" onClose={function () { setGuideOpen(false); }}>
          <div className="notice-body">
            <FormatReference initialFamily={scale.family} />
          </div>
        </Modal>
      ) : null}

      {applyOpen ? (
        <ApplyFormatDialog
          formats={formats}
          current={scale.scaleType}
          onClose={function () { setApplyOpen(false); }}
          onApplied={function (outcome) {
            // The main process now holds the updated questionnaire, so the item changes kept
            // on this screen are out of date. Clear them and reload the latest version rather
            // than trying to match two separate copies. This requires only one request.
            setAdjusted({});
            setApplyOpen(false);
            if (onRerender) { onRerender(outcome); }
          }}
        />
      ) : null}

      {/* The layout is a reading preference rather than part of the run, so it
          is saved between visits and appears directly above the content it affects. */}
      <div className="layout-picker" role="group" aria-label="Instrument layout">
        {LAYOUTS.map(function (option) {
          return (
            <button
              key={option.id}
              className={'layout-option' + (layout === option.id ? ' current' : '')}
              onClick={function () { onLayout(option.id); }}
              aria-pressed={layout === option.id}
              title={option.hint}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <InstrumentView
        instrument={instrument}
        layout={layout}
        formats={formats}
        adjusted={adjusted}
        onChangeFormat={changeFormat}
        distributionFor={distributionFor}
        removedFor={removedFor}
        Calibration={CalibrationScale}
      />

      {/* Collapsed by default so the questionnaire remains the main focus of
          the page. The record is still available when someone wants to review it. */}
      <details className="advanced audit-panel">
        <summary>
          <span className="disclosure" aria-hidden="true" />
          Audit trail &middot; {result.counts.decisions} decisions across {result.trail.steps.length} steps
        </summary>
        {/* The share of decisions based on measured checks versus judgment appears
            above the table as a summary. Readers can see that balance at a glance
            without having to count rows themselves. */}
        <ProvenanceBar steps={result.trail.steps} />
        <AuditTable steps={result.trail.steps} />
      </details>

      {/* Keep exports in one section rather than splitting them across several
          blocks. The useful distinction is between files you save and formats
          you send elsewhere, so two rows are enough. */}
      <details className="advanced export-panel" open>
        <summary>
          <span className="disclosure" aria-hidden="true" />
          <span className="spec-section-title">Export</span>
          <span className="spec-section-count">
            {FORMATS.length + platforms.length} formats
          </span>
        </summary>

        <p className="export-row-label">Files to keep</p>
        <div className="actions export-actions">
          {FORMATS.map(function (format) {
            return (
              <button
                key={format.id}
                className={format.id === 'docx' ? 'primary' : ''}
                onClick={function () { runExport(format.id); }}
                disabled={exportState && exportState.status === 'working'}
                title={format.hint}
              >
                {format.label}
              </button>
            );
          })}
        </div>

        {platforms.length > 0 ? (
          <>
            <p className="export-row-label">Send to a survey platform</p>
            <div className="platform-grid">
              {platforms.map(function (platform) {
                return (
                  <button
                    key={platform.id}
                    className="platform"
                    onClick={function () { runExport(platform.id); }}
                    disabled={exportState && exportState.status === 'working'}
                  >
                    <span className="platform-label">{platform.label}</span>
                    <span className="platform-hint">{platform.hint}</span>
                  </button>
                );
              })}
            </div>
            <p className="field-hint">
              Files created for survey platforms contain only the questionnaire. The complete
              record is included with Word, PDF, JSON, and text exports, where there is room
              for the additional information.
            </p>
          </>
        ) : null}
      </details>

      {exportState && exportState.status === 'saved' ? (
        <p className="field-hint state-complete">Saved to {exportState.detail}</p>
      ) : null}
      {exportState && exportState.status === 'failed' ? (
        <p className="field-error">{exportState.detail}</p>
      ) : null}

      <div className="actions">
        {onReview ? (
          <button onClick={onReview}>Review what you entered</button>
        ) : null}
        {onRerun ? (
          confirmingRerun ? (
            <span className="confirm-pair">
              <button className="primary" onClick={function () {
                setConfirmingRerun(false);
                onRerun();
              }}>Run it again</button>
              <button onClick={function () { setConfirmingRerun(false); }}>Keep this one</button>
            </span>
          ) : (
            <button onClick={function () { setConfirmingRerun(true); }}>Run again</button>
          )
        ) : null}
        <button onClick={onNewRun}>Build another</button>
        {onHistory ? <button onClick={onHistory}>Past runs</button> : null}
      </div>
      {confirmingRerun ? (
        <p className="field-hint">
          The same setup will run again from the beginning. It will take about as long as before,
          and the current questionnaire will remain saved in Past runs.
        </p>
      ) : null}
      {/* Stated clearly rather t han making someone discover it after clicking.
          They may have just spent a long time creating the current questionnaire. */}
      <p className="field-hint">
        This run is saved in Past runs, where you can reopen it at any time.
      </p>
    </div>
  );
}
