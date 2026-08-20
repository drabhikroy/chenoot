import { useEffect, useState } from 'react';
import { HeroSketch } from '../components/HeroSketch.jsx';

// Landing tab.
//
// Written using the same visual language as the rest of the app, but presented
// as the entry point rather than another screen. It uses the same display style
// for headings, the same data style for measured information, and one accent
// color per area based on what the user provides.
//
// The page is built to demonstrate rather than simply claim. A survey generator
// can say it follows survey methodology, but examples show it more clearly.
// Showing one item classified across six properties and nine response formats
// as real examples rather than icons with labels demonstrates the approach.
// There are no statistics, logos, testimonials, or unnecessary descriptive text.
//
// The preview builds itself once when the page opens. It uses four steps because
// those are the distinct decisions made about an item. Stopping there keeps the
// sequence under two seconds.
const ASSEMBLY = [
  { at: 260, key: 'stem' },
  { at: 900, key: 'scale' },
  { at: 1500, key: 'properties' },
  { at: 2100, key: 'settled' }
];

// The five properties the application decides, shown in the order they are
// determined. This is the main idea of the page: the output is not just text,
// but a set of survey-design choices that appear as a question.
const PREVIEW_PROPERTIES = [
  ['Response format', 'Closed-ended ordinal'],
  ['Subtype', 'Vague-quantifier scale'],
  ['Direction', 'Bipolar, with a midpoint'],
  ['Information type', 'Attitude or opinion'],
  ['Response control', 'Radio buttons']
];

// Five points with a labeled midpoint, matching what the app would choose for a
// satisfaction item. The preview should show the same thing the product creates,
// not an example that differs from the actual output.
const PREVIEW_ANCHORS = [
  'Very satisfied',
  'Somewhat satisfied',
  'Neither satisfied nor dissatisfied',
  'Somewhat dissatisfied',
  'Very dissatisfied'
];

// Nine formats, each shown as a small version of the item itself. An icon next
// to the words "ordinal scale" adds little information, while a displayed
// five-point scale shows what someone would actually receive.
const SPECIMENS = [
  {
    id: 'ordinal',
    label: 'Ordinal scale',
    stem: 'How clear were the instructions?',
    render: 'scale',
    anchors: ['Extremely', 'Very', 'Moderately', 'Slightly', 'Not at all']
  },
  {
    id: 'binary',
    label: 'Binary',
    stem: 'Did you attend the session?',
    render: 'choices',
    options: ['Yes', 'No']
  },
  {
    id: 'nominal',
    label: 'Single-answer nominal',
    stem: 'Which format did you use most?',
    render: 'choices',
    options: ['In person', 'Online', 'Recorded']
  },
  {
    id: 'forced',
    label: 'Forced choice',
    stem: 'Did you use each of these?',
    render: 'forced',
    rows: ['Handbook', 'Office hours', 'Discussion board']
  },
  {
    id: 'ranking',
    label: 'Ranking',
    stem: 'Order these by usefulness.',
    render: 'ranking',
    rows: ['Worked examples', 'Reading list', 'Feedback']
  },
  {
    id: 'metric',
    label: 'Natural-metric scale',
    stem: 'How many sessions did you attend?',
    render: 'choices',
    options: ['None', '1 to 2', '3 to 5', '6 or more']
  },
  {
    id: 'numeric',
    label: 'Numerical',
    stem: 'How many hours did you spend preparing?',
    render: 'numeric',
    unit: 'hours'
  },
  {
    id: 'partial',
    label: 'Partially closed',
    stem: 'Where did you hear about the program?',
    render: 'choices',
    options: ['A colleague', 'The department', 'Other, please say'],
    openLast: true
  },
  {
    id: 'open',
    label: 'Open-ended',
    stem: 'What would you change about the program?',
    render: 'open'
  }
];

// One miniature item. Each response format has its own renderer because scales,
// forced-choice tables, and text boxes have different layouts. Separate branches
// keep the code easier to read than one renderer with many conditions.
function Specimen({ item }) {
  return (
    <article className="specimen">
      <p className="specimen-label">{item.label}</p>
      <p className="specimen-stem">{item.stem}</p>

      {item.render === 'scale' ? (
        <ol className="specimen-scale">
          {item.anchors.map(function (anchor, index) {
            return (
              <li key={anchor}>
                <span className={'specimen-dot' + (index === 1 ? ' chosen' : '')} aria-hidden="true" />
                <span className="specimen-anchor">{anchor}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {item.render === 'choices' ? (
        <ul className="specimen-choices">
          {item.options.map(function (option, index) {
            const last = item.openLast && index === item.options.length - 1;
            return (
              <li key={option}>
                <span className={'specimen-dot' + (index === 0 && !item.openLast ? ' chosen' : '')} aria-hidden="true" />
                <span>{option}</span>
                {last ? <span className="specimen-rule" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* This uses a real table so screen readers can identify the row and column
          headings correctly. */}
      {item.render === 'forced' ? (
        <table className="specimen-forced">
          <thead>
            <tr><td /><th scope="col">Yes</th><th scope="col">No</th></tr>
          </thead>
          <tbody>
            {item.rows.map(function (row, index) {
              return (
                <tr key={row}>
                  <th scope="row">{row}</th>
                  <td><span className={'specimen-dot' + (index !== 1 ? ' chosen' : '')} aria-hidden="true" /></td>
                  <td><span className={'specimen-dot' + (index === 1 ? ' chosen' : '')} aria-hidden="true" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {item.render === 'ranking' ? (
        <ol className="specimen-ranking">
          {item.rows.map(function (row, index) {
            return (
              <li key={row}>
                <span className="specimen-rank value">{index + 1}</span>
                <span>{row}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {item.render === 'numeric' ? (
        <p className="specimen-numeric">
          <span className="specimen-field" aria-hidden="true" />
          <span className="specimen-unit value">{item.unit}</span>
        </p>
      ) : null}

      {/* These lines represent a text box and are marked as decorative. The label
          above already identifies the response format, so screen readers do not
          need to announce the lines. */}
      {item.render === 'open' ? (
        <p className="specimen-open" aria-hidden="true">
          <span /><span /><span />
        </p>
      ) : null}
    </article>
  );
}

// Both actions are passed in. The page does not know how the application
// navigates, only which two places it offers to send someone.
export function LandingScreen({ onEnter, onFormats }) {
  const [step, setStep] = useState({});

  // The sequence runs once. Anyone who prefers reduced motion sees the completed
  // state immediately, with the same information shown without the animation.
  useEffect(function () {
    const reduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStep({ stem: true, scale: true, properties: true, settled: true });
      return undefined;
    }
    const timers = ASSEMBLY.map(function (step) {
      return setTimeout(function () {
        setStep(function (current) {
          return Object.assign({}, current, { [step.key]: true });
        });
      }, step.at);
    });
    return function () {
      timers.forEach(clearTimeout);
    };
  }, []);

  // The page uses a single column with sections separated by rules. Sections are
  // not placed in cards, which keeps the page reading as one continuous flow.
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-hero-text">
        <p className="eyebrow">Auditable survey instrument construction</p>
        <h1 className="landing-headline">
          Questions designed the way a seasoned survey expert would
        </h1>
        <p className="landing-lede">
            Tell the app what you want to measure, and it turns that into a questionnaire. Each item
            gets a response format with an explanation of why it fits, along with a complete record
            you can review. Everything runs directly on your computer.
        </p>
        <div className="landing-actions">
          <button className="primary landing-primary" onClick={onEnter}>
            Build an instrument
          </button>
          <button className="link-button" onClick={onFormats}>
            See the response formats
          </button>
        </div>
        </div>

        {/* The artifact appears beside the text describing it. The page still makes
            sense without the image, but it gives people a direct look at what the
            product creates. */}
        <div className="landing-hero-figure" aria-hidden="false">
          <HeroSketch />
        </div>
      </section>

      {/* The product demonstrates what the page describes. This is not a
          screenshot. It uses the same components as the app to build one item
          and show the choices made about it. */}
      <section className="landing-preview">
        <div className="preview-prompt">
          <p className="preview-label">You write</p>
          <p className="preview-brief">
            Measure how satisfied participants were with a program they finished last term.
          </p>
        </div>

        <div className={'preview-item' + (step.settled ? ' settled' : '')}>
          <p className="preview-label">It writes</p>

          <p className={'preview-stem' + (step.stem ? ' shown' : '')}>
            <span className="preview-number value">1</span>
            Overall, how satisfied or dissatisfied were you with the program?
          </p>

          <ol className={'preview-scale' + (step.scale ? ' shown' : '')}>
            {PREVIEW_ANCHORS.map(function (anchor, index) {
              return (
                <li key={anchor} style={{ transitionDelay: (index * 60) + 'ms' }}>
                  <span className="specimen-dot" aria-hidden="true" />
                  <span className="specimen-anchor">{anchor}</span>
                </li>
              );
            })}
          </ol>

          <dl className={'preview-properties' + (step.properties ? ' shown' : '')}>
            {PREVIEW_PROPERTIES.map(function (pair, index) {
              return (
                <div key={pair[0]} style={{ transitionDelay: (index * 50) + 'ms' }}>
                  <dt>{pair[0]}</dt>
                  <dd className="value">{pair[1]}</dd>
                </div>
              );
            })}
          </dl>

          <p className="preview-note">
            Those five properties are decisions, not labels added afterward. Each choice
            is recorded along with why it was made, and you can change it at any time.
          </p>
        </div>
      </section>

      {/* Nine response formats are shown as miniature items. Seeing an actual
          scale communicates far more than an icon labeled "Ordinal Scale." */}
      <section className="landing-specimens">
        <div className="landing-section-head">
          <h2>Nine ways to ask</h2>
          <p>
            The response format depends on what you are measuring. An attitude uses a scale,
            a count uses a number, and an open-ended question uses a text box.
          </p>
        </div>
        <div className="specimen-sheet">
          {SPECIMENS.map(function (item) {
            return <Specimen item={item} key={item.id} />;
          })}
        </div>
      </section>

      {/* This section is intentionally restrained. It explains that the app follows
          established survey-design practices while making clear that the resulting
          questionnaire still requires testing. Calling a generated instrument
          validated would overstate what the app can establish. */}
      <section className="landing-method">
        <div className="landing-section-head">
          <h2>Where the rules come from</h2>
        </div>
        <div className="method-columns">
          <p>
            The item standards are based on survey design research. They favor item-specific
            response options over agree/disagree scales when appropriate, include reverse-keyed
            items to check for agreement bias, set a maximum reading level, and require at least
            three items for each dimension so reliability can be estimated.
          </p>
          <p>
            Running the app does not validate the questionnaire. What it produces is a first draft
            based on established best practices, and it still needs to be piloted and tested.
            A complete record is kept so reviewers can see which practices were applied and where the
            model had to make a judgment call.
          </p>
        </div>
        <button className="link-button" onClick={onFormats}>
          See the references
        </button>
      </section>

      {/* The closing action repeats the one at the top. Someone who reaches the
          bottom should be able to continue without scrolling back up. */}
      {/* The last section on the page, and the shortest. */}
      <section className="landing-close">
        <h2>Start with a construct.</h2>
        <p>
          Provide what you are measuring, who you are asking, and why. The app
          handles the rest.
        </p>
        <button className="primary landing-primary" onClick={onEnter}>
          Build an instrument
        </button>
      </section>
    </div>
  );
}
