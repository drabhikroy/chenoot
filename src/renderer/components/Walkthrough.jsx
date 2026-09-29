import { useState } from 'react';

// The first-run walkthrough.
//
// It runs once and then never again unless someone asks for it from Help. A
// tour that reappears is a tour nobody reads, and one that cannot be recalled
// is one nobody can check something in later.
//
// Deliberately not a spotlight over the interface. Spotlight tours have to
// know where every element sits, which makes them fragile against exactly the
// layout changes they are meant to explain, and a misaligned cutout is worse
// than no tour at all. This sits in a corner, names what is on screen, and
// leaves the interface visible and usable behind it.

// Steps everyone sees, before the branch.
const OPENING = [
  {
    title: 'One workspace',
    body: 'The Workspace holds everything about the instrument you are making. Your brief sits ' +
      'on the left, the instrument fills in on the sheet in the middle as the run goes, and ' +
      'the details of the run sit on the right. Drag the edge of either side column to make ' +
      'it wider or narrower, and double click the edge to put it back.'
  },
  {
    title: 'Three fields to start',
    body: 'Construct, target population, and purpose. Those are the only things the pipeline ' +
      'will not proceed without, because their absence changes what gets measured and not ' +
      'only how well. Put simply, what you are measuring, who you are asking, and why. A ' +
      'field opens in the middle of the window while you type in it, so a long answer is ' +
      'easy to read, and goes back into the column when you click outside it or press Escape.'
  },
  {
    title: 'Everything else is optional',
    body: 'Specification detail holds fourteen further fields. Each one you supply constrains ' +
      'the instrument more tightly, and each one you leave is recorded in the audit trail as ' +
      'something the run did not know. Leaving them all blank is a legitimate way to work.'
  }
];

// The branch. This is the one decision worth asking about during a first run,
// because it is the only one that determines what someone has to do outside
// this application before anything works.
const BRANCH = {
  title: 'Where should the model live',
  body: 'Everything runs on your machine, which means a language model has to be on it. There ' +
    'are two ways to arrange that and neither is better than the other.',
  choices: [
    {
      id: 'in-app',
      label: 'Set it up for me',
      hint: 'Two guided steps, nothing installed system wide'
    },
    {
      id: 'terminal',
      label: 'I already have Ollama',
      hint: 'Use the Ollama and models already on this computer'
    }
  ]
};

// What follows depends on the answer, and only on the answer.
const BRANCHES = {
  'in-app': [
    {
      title: 'Setup does it in two steps',
      body: 'First the program that runs models, fetched into this application\u2019s own ' +
        'folder, not installed system wide. Then the model itself. Each step checks ' +
        'itself before the next opens, and you can remove either later from the same screen.'
    },
    {
      title: 'The second step lists what runs here',
      body: 'Every model the pipeline works with, what each costs in download size and memory, ' +
        'and where each one struggles at this particular job. Downloading one selects it, so ' +
        'there is nothing to configure afterwards.'
    },
    {
      title: 'It can check your machine first',
      body: 'With permission it reads your memory, cores, and architecture to say which models ' +
        'will actually run, not merely fit. That reading stays here and can be revoked, ' +
        'which discards it. Refusing costs the fit guidance and nothing else.'
    }
  ],
  terminal: [
    {
      title: 'Setup looks for it first',
      body: 'The first option in Setup checks for an Ollama already running on this computer, ' +
        'at the usual address or one you type, and lists the models you have already pulled, ' +
        'so nothing is downloaded twice. If you have no models yet, two commands cover it: ' +
        'ollama pull qwen2.5:7b-instruct, then ollama pull nomic-embed-text.'
    },
    {
      title: 'Settings holds the addresses',
      body: 'If Ollama runs somewhere other than the default address, or you want a different ' +
        'model for critique than for writing, Settings has both, and its model fields list ' +
        'whatever Ollama already holds. Setup is still worth opening for the trade-offs even ' +
        'if you install elsewhere.'
    }
  ]
};

// The two paths are the same length on purpose. An uneven branch reads as one
// choice being the supported route and the other being tolerated, and neither
// is true here.
// Steps everyone sees, after the branch.
const CLOSING = [
  {
    title: 'Nine steps, unattended',
    body: 'Once started the run scopes the construct, drafts an oversized item pool, critiques ' +
      'every item, rewrites what fails, removes near-duplicates, and picks a response scale. ' +
      'It takes minutes, not seconds, and you can leave it.'
  },
  {
    title: 'It may stop and ask',
    body: 'If something is missing that would change what gets measured, the run stops and ' +
      'asks instead of guessing. What you entered stays where it is, so you can fill in the ' +
      'gap and carry on.'
  },
  {
    title: 'Everything is kept',
    body: 'What you build stays in the Workspace until you begin another, and everything from ' +
      'before it is in the Library. Both keep the full record of how the instrument was put ' +
      'together, including whether each decision was measured, judged, or recalled without a ' +
      'source. Edit the brief brings a finished instrument\u2019s brief back into the form, so a ' +
      'change is one edit and another run, and Back to the finished instrument returns to it ' +
      'untouched. Your most recent runs are also listed on the home page.'
  },
  {
    // Added when the two reference screens arrived. A tour that stops before
    // the last two destinations leaves somebody to find them by accident.
    title: 'Two references, always open',
    body: 'Reference has two tabs. Response formats explains every response scale the pipeline ' +
      'can attach to an item, with the research behind each one. Item types covers the wider ' +
      'vocabulary of survey design. Both are there whether or not a run is going.'
  }
];

export function Walkthrough({ onFinish, onGoToModels }) {
  // The branch answer, held for the rest of the tour. Nothing is persisted from
  // it: this decides which three cards someone reads, not how the application
  // behaves afterwards.
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState(null);

  // The sequence is assembled from the answer, not skipped through. A
  // tour that advances past steps someone will never need still shows them the
  // progress cost of steps that do not apply to them.
  const sequence = OPENING
    .concat([BRANCH])
    .concat(choice ? BRANCHES[choice] : [])
    .concat(CLOSING);

  const current = sequence[step];
  const isBranch = Boolean(current.choices);
  const last = step === sequence.length - 1;

  function advance() {
    if (last) {
      onFinish();
      return;
    }
    setStep(step + 1);
  }

  return (
    <aside className="walkthrough" role="dialog" aria-label="Getting started">
      <p className="walkthrough-count value">
        {step + 1} of {choice || isBranch ? sequence.length : sequence.length + 2}
      </p>
      <h3 className="walkthrough-title">{current.title}</h3>
      <p className="walkthrough-body">{current.body}</p>

      {isBranch ? (
        <div className="walkthrough-choices">
          {current.choices.map(function (option) {
            return (
              <button
                key={option.id}
                className="walkthrough-choice"
                onClick={function () {
                  setChoice(option.id);
                  setStep(step + 1);
                }}
              >
                <span className="walkthrough-choice-label">{option.label}</span>
                <span className="walkthrough-choice-hint">{option.hint}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="walkthrough-foot">
        {/* Dots instead of a bar. The count changes once the branch is taken,
            which a bar would render as progress going backwards. */}
        <span className="walkthrough-dots" aria-hidden="true">
          {sequence.map(function (item, index) {
            return (
              <span
                key={item.title}
                className={'walkthrough-dot' + (index === step ? ' current' : '')}
              />
            );
          })}
        </span>
        <span className="walkthrough-actions">
          {/* Back exists because the branch changes what follows, and someone
              who picked the wrong path has no other way to correct it. It also
              clears the choice when stepping back onto the branch, so the
              question is asked again, not answered invisibly. */}
          {step > 0 ? (
            <button className="walkthrough-skip" onClick={function () {
              const previous = step - 1;
              if (sequence[previous] && sequence[previous].choices) {
                setChoice(null);
              }
              setStep(previous);
            }}>
              Back
            </button>
          ) : null}
          <button className="walkthrough-skip" onClick={onFinish}>
            {last ? '' : 'Skip'}
          </button>
          {/* The branch step has no Next: its choices are the way forward, and
              a Next beside them would be a third option that means nothing. */}
          {isBranch ? null : (
            <button className="primary" onClick={function () {
              if (last && choice === 'in-app' && onGoToModels) {
                onGoToModels();
                onFinish();
                return;
              }
              advance();
            }}>
              {last ? (choice === 'in-app' ? 'Take me to Setup' : 'Start using it') : 'Next'}
            </button>
          )}
        </span>
      </div>
    </aside>
  );
}
