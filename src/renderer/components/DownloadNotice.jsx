import { Modal } from './Modal.jsx';

// Shown before anything is fetched from outside this application.
//
// Built on the shared modal and not on its own backdrop and panel, which is
// what it had. That made it the one dialog in the application that could not be
// resized, did not close on Escape, and did not return focus to whatever opened
// it: three behaviors every other dialog has, absent here for no reason other
// than that this one was written first.
//
// The point is to be clear and not to be forbidding. Someone about to
// download several gigabytes of model weights should know where they come
// from, what they will do, what they cost, and what this application does and
// does not stand behind. None of that needs to be alarming, and writing it in
// the register of a warranty disclaimer would make an ordinary and safe action
// look like a risk.
//
// It appears once per target, not once per session, and the choice is
// remembered, because a notice that reappears on every download stops being
// read on the second one.

export function DownloadNotice({ target, onAccept, onCancel }) {
  return (
    <Modal
      title="Before downloading"
      className="notice"
      onClose={onCancel}
      footer={
        <>
          <button className="primary" onClick={onAccept}>Download {target.label}</button>
          <button onClick={onCancel}>Not now</button>
          <span className="field-hint">You will not be asked again for this.</span>
        </>
      }
    >
      <div className="notice-body">
          <h2>What this is</h2>
          <p className="help-para">{target.what}</p>

          <h2>Where it comes from</h2>
          <p className="help-para">
            {target.source} This application does not host it, modify it, or add anything to it.
          </p>
          {/* Linked, not named, so the claim about where this comes from
              can be checked, not taken on trust. */}
          {target.url ? (
            <p className="help-para">
              <a href={target.url} target="_blank" rel="noreferrer">{target.url}</a>
            </p>
          ) : null}

          <h2>What it will use</h2>
          <ul className="notice-list">
            <li>About {target.size} of disk space.</li>
            <li>{target.memory}</li>
            <li>An internet connection for the download itself. Nothing about you is sent.</li>
          </ul>

          <h2>What to know</h2>
          {/* Stated plainly and without hedging in either direction. The
              software is widely used and that is worth saying; it is also
              third-party software and this application cannot stand behind it,
              and that is worth saying too. */}
          <p className="help-para">{target.standing}</p>
          <p className="help-para">
            Language models produce text that can be wrong, and the pipeline is built on that
            assumption: every item is checked, and the audit trail records which findings were
            measured and which were a model judgment. Nothing a model produces here should be
            treated as validated without human review and testing.
          </p>
          <p className="help-para notice-liability">
            This software is provided without warranty, and its author is not liable for what
            third-party software you install does on your machine. That is the standard position
            and it is stated in the license.
          </p>
      </div>
    </Modal>
  );
}
