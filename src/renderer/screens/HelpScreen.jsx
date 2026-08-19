import { useState } from 'react';
import { BUILD_STAMP } from '../build-stamp.js';
import { BUILD_NUMBER } from '../build-number.js';

// 'Help' tab.
//
// Written around the questions someone is likely to have while using the app:
// what needs to be filled in, what the optional fields are for, what happens
// after Start is pressed, and what the app produces.
//
// Help opens as its own screen rather than covering the app. This lets someone
// read the guidance while still seeing the part of the app they are asking about.

// The three required fields are explained by what they affect later in the
// process rather than by their labels alone. Help should explain why each field
// matters, not simply repeat its name.
const REQUIRED = [
  {
    name: 'Construct',
    body: 'The attribute being measured, named as you would name it in a report. Every ' +
      'dimension, item, and audit entry is written against this name.'
  },
  {
    name: 'Target population',
    body: 'Who the findings describe. This sets vocabulary and reading level, and decides ' +
      'which concepts are meaningful to ask about at all.'
  },
  {
    name: 'Survey purpose',
    body: 'What the survey is for, in a sentence or two. Purpose decides which concepts belong ' +
      'in the instrument, so without it every later decision about what to include is arbitrary.'
  }
];

// The process is shown in order. Each line explains what that step decides
// rather than repeating the step name already visible on the progress screen.
const STEPS = [
  ['Specification', 'Reads what you supplied, records what is absent, and stops only if something missing would change what gets measured.'],
  ['Scoping', 'Breaks the construct into dimensions and gives each one a share of the target item count.'],
  ['Grounding', 'Optional. Recalls comparable published scales for phrasing conventions. Off by default, because a local model asked to recall scales will invent them.'],
  ['Generation', 'Drafts roughly three times the target count, per dimension, so later steps have something to discard.'],
  ['Critique', 'Checks every item. Reading grade, length, double-barreled items, absolutes, and negation are all measured in code. Leading and socially desirable wording are judged by the model.'],
  ['Revision', 'Rewrites what failed, up to three rounds per item, then drops what will not converge and records why.'],
  ['Coverage', 'Removes near-duplicates using embeddings, restores items if a dimension would fall below target, and narrows to the requested count.'],
  ['Response scale', 'Decides whether the construct is unipolar or bipolar, picks a scale from a catalog of twenty, and takes the anchor labels from that catalog, not generating them.'],
  ['Assembly', 'Compiles the instrument, works out an administration order that does not present dimensions as blocks, and renders the audit trail.']
];

// Help topics open one at a time. This keeps the page manageable as more topics
// are added and lets someone choose what they need instead of scrolling through
// every section.
const TOPICS = [
  { id: 'start', label: 'What you have to fill in', hint: 'The three fields that gate a run' },
  { id: 'optional', label: 'What is optional', hint: 'The fourteen that sharpen it' },
  { id: 'models', label: 'Getting a model running', hint: 'Setup, and doing it yourself' },
  { id: 'pipeline', label: 'What happens when you start', hint: 'The nine steps in order' },
  { id: 'output', label: 'What you get', hint: 'Instrument, audit trail, exports' },
  { id: 'paused', label: 'If it stops and asks', hint: 'Why, and what to do' },
  { id: 'license', label: 'License and credits', hint: 'Terms, fonts, and the name' }
];

// The walkthrough appears above the topic grid because it is an action rather
// than a reference topic. Someone new to the app is also more likely to need it.
export function HelpScreen({ onWalkthrough }) {
  const [topic, setTopic] = useState(null);
  const current = TOPICS.find(function (item) { return item.id === topic; });

  return (
    <div className="screen screen-narrow help">
      <p className="eyebrow">Help</p>
      <h1>How this works</h1>

      <p className="lede">
        You provide a construct and some context. The app creates a questionnaire
        and a record of every decision behind it. Nothing about that process is hidden.
      </p>

      {/* The walkthrough is an action, so it sits above the topics rather than
          among them. */}
      <div className="actions">
        <button className="primary" onClick={onWalkthrough}>Run the walkthrough</button>
      </div>

      {/* The topic grid remains visible while the selected topic opens below it.
           Someone can move directly from one topic to another without going back. */}
      <div className="topic-grid">
        {TOPICS.map(function (item) {
          return (
            <button
              key={item.id}
              className={'topic' + (topic === item.id ? ' current' : '')}
              onClick={function () { setTopic(topic === item.id ? null : item.id); }}
              aria-expanded={topic === item.id}
            >
              <span className="topic-label">{item.label}</span>
              <span className="topic-hint">{item.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Only one topic opens at a time to keep the page from becoming another
          long scroll. Choosing a different topic replaces the current one. */}
      {/* The open topic renders below the grid. Each branch below matches one
          topic id, so adding a topic means adding an entry to TOPICS and a
          branch here. */}
      {current ? (
        <section className="topic-body">
          <h2>{current.label}</h2>
          {topic === 'start' ? (
            <dl className="help-list">
              {REQUIRED.map(function (item) {
                return (
                  <div key={item.name}>
                    <dt>{item.name}</dt>
                    <dd>{item.body}</dd>
                  </div>
                );
              })}
            </dl>
          ) : null}

          {topic === 'optional' ? (
            <>
              <p className="help-para">
                Everything under Specification detail. These fourteen fields describe who will respond,
                how the survey will be delivered, what period it covers, any sensitive topics, what should
                stay consistent with earlier data, and how the results will be analyzed.
              </p>
              <p className="help-para">
                None of this is required. The process will still work if you leave everything blank.
                Each detail you provide helps shape the instrument more closely. Anything you leave
                out is noted in the audit trail as unknown. With no added information, you will still
                get a usable draft. Providing more detail makes the result easier to support and explain.
              </p>
            </>
          ) : null}

          {/* The model section repeats the benchmark limitation here because
               someone reading Help may not have seen the explanation in Setup. */}
          {topic === 'models' ? (
            <>
              <p className="help-para">
                Everything runs on your machine, which needs two things: a program that handles
                processing locally and a model for it to use. Setup does both in order and checks
                each one, and you do not need to know anything about either beforehand.
              </p>
              <p className="help-para">
                If Ollama is already installed, Setup finds it and uses it, not adding a
                second copy. If it is not, the application can fetch one into its own folder and
                start it when needed. Nothing is installed system wide, and removing it later is
                as easy as clicking a button.
              </p>
              <p className="help-para">
                The second step of Setup shows the available options, how much space and memory each one needs,
                and where each may struggle with this task. These are general estimates, not benchmarks from your
                machine. Use them as a guide when choosing what to use.
              </p>

              {/* The manual instructions belong in Help because they are reference
                    material for people already comfortable using a terminal. Setup
                    now handles the guided model installation process, so a separate
                    screen for these instructions is no longer needed. */}
              <h3 className="help-step">Doing it yourself instead</h3>
              <p className="help-para">
                None of Setup is required. If you already manage models from a terminal or prefer
                to do so, this application will use what is available through Ollama.
              </p>
              <p className="help-para">
                Ollama is the program that runs a model on your machine. This application connects to
                it rather than taking its place. Download it from{' '}
                <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                  ollama.com/download
                </a>, or on macOS and Linux install it from a terminal:
              </p>
              <p className="model-command value">curl -fsSL https://ollama.com/install.sh | sh</p>
              <p className="help-para">
                Then pull one writing model, and one embedding model for the duplicate check:
              </p>
              <p className="model-command value">ollama pull qwen2.5:7b-instruct</p>
              <p className="model-command value">ollama pull nomic-embed-text</p>
              <p className="help-para">
                qwen2.5:7b-instruct is one specific model. You can use another in its place.
                They are all stored in the same location and can be used by other programs that
                connect to Ollama. After downloading one, select it in Settings. The writing and
                embedding fields show all Ollama models that can run on your machine.
              </p>
            </>
          ) : null}

          {/* Numbered two digits so the column stays even from one to nine. */}
          {topic === 'pipeline' ? (
            <ol className="help-steps">
              {STEPS.map(function (step, index) {
                return (
                  <li key={step[0]}>
                    <span className="help-step-number value">{String(index + 1).padStart(2, '0')}</span>
                    <span className="help-step-body">
                      <strong>{step[0]}</strong>
                      <span>{step[1]}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {topic === 'output' ? (
            <>
              <p className="help-para">
                The finished instrument is organized into sections and includes a response scale
                with clear labels. It also keeps a record of every decision. Each entry shows whether
                the information came directly from the text, was judged using a clear rule, or was
                based on memory without a source to confirm it.
              </p>
              <p className="help-para">
                Export to Word, PDF, JSON, CSV, or plain text, or straight into Qualtrics,
                REDCap, Google Forms, or any platform with a bulk paste box. The results screen
                offers four layouts, including one showing each item above the scale it will be
                answered on.
              </p>
              <p className="help-para">
                The popups on this screen and elsewhere can be resized from any edge or corner.
              </p>
            </>
          ) : null}

          {topic === 'paused' ? (
            <p className="help-para">
              The process pauses only when it needs missing information that it cannot safely interpret
              on its own. Everything you have already entered stays in place. You can add or correct
              the missing information, then continue from where you left off. The process will not pause
              for optional fields, even when completing them could be helpful.
            </p>
          ) : null}

          {/* This topic appears last because people are most likely to open it
              only when they are specifically looking for that information. */}
          {topic === 'license' ? (
            <>
              <p className="help-para">
                Chenoot is published under the PolyForm Noncommercial License 1.0.0.
                Copyright Abhik Roy.
              </p>
              <p className="help-para">
                Any noncommercial purpose is permitted, including personal study, research,
                teaching, and use by charities, educational institutions, public research bodies,
                and government. The full terms ship with the application in the LICENSE file.
              </p>
              <p className="help-para">
                Lexend, Fraunces, and Spline Sans Mono are used under the SIL Open Font License.
              </p>
              <p className="help-para">
                {/* Kept because it helps someone confirm that the app is using
                    the version they expect, especially after replacing its folder.
                    That information belongs here rather than beside the app name. */}
                Version {BUILD_NUMBER}. This build was made {BUILD_STAMP}.
              </p>
              <p className="help-para colophon">
                Named for <span lang="egy">{'\u1E6F'}nwt</span>, the ancient Egyptian word for a
                census or a reckoning of people.
              </p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
