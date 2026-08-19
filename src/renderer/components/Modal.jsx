import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A modal, used for settings.
//
// Settings became a modal because it is a place someone goes, changes one
// thing, and leaves. As a screen it had to be navigated to and away from, which
// meant losing whatever was on screen and finding the way back afterwards. A
// layer over the top keeps the context and makes leaving a single gesture.
//
// Four things a modal has to get right and most do not. Escape closes it. Focus
// moves into it on open and returns to whatever opened it on close. Clicking
// the backdrop closes it, because a layer with no visible way out traps people
// who did not mean to open it. And a drag that starts inside the panel is never
// a dismissal, however far outside it ends, which is what made resizing close
// the dialog being resized.

// The class name is accepted so a dialog can carry its own body styling
// without a second panel implementation to attach it to.
export function Modal({ title, className, onClose, children, footer }) {
  const panel = useRef(null);
  const opener = useRef(null);
  // Where the pointer went down. A resize drag ends with the pointer outside
  // the panel, and a plain click handler on the backdrop reads that release as
  // a click on the backdrop and closes the dialog someone was resizing.
  const startedOnBackdrop = useRef(false);

  useEffect(function () {
    opener.current = document.activeElement;
    if (panel.current) {
      panel.current.focus();
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);

    return function () {
      document.removeEventListener('keydown', onKey);
      // Focus goes back where it came from. Without this it lands on the
      // document and the next tab starts from the top of the page.
      if (opener.current && opener.current.focus) {
        opener.current.focus();
      }
    };
  }, [onClose]);

  // Resizing from any edge or corner,, not the single bottom-right grip the
  // CSS resize property gives. The edge dragged has to be the edge that moves,
  // and that is what was wrong before. The panel is centered by the backdrop,
  // so setting only its width and height grew it from the middle: dragging the
  // left edge moved both edges, half as far each, in opposite directions. On
  // the first drag the panel is pinned where it already sits, in fixed
  // coordinates, and centering stops applying. From then on an edge drag moves
  // that edge alone, which is how every other window on the machine behaves.
  const MINIMUM_WIDTH = 420;
  const MINIMUM_HEIGHT = 320;

  // Positioned against the backdrop and not against the window.
  //
  // Fixed positioning was the obvious choice and it was wrong. The backdrop
  // fades in with an animation that ends on a transform, and an element with
  // any transform at all, including an identity one left behind by a finished
  // animation, becomes the containing block for fixed descendants. So a panel
  // pinned at its own measured coordinates landed at those coordinates measured
  // from the backdrop's corner instead of the window's, which threw it across
  // the screen on the first drag. Absolute positioning inside the backdrop is
  // measured against the backdrop either way, so the question does not arise.
  function localBox(node) {
    const box = node.getBoundingClientRect();
    const frame = node.parentElement.getBoundingClientRect();
    return {
      left: box.left - frame.left,
      top: box.top - frame.top,
      right: box.right - frame.left,
      bottom: box.bottom - frame.top,
      width: box.width,
      height: box.height
    };
  }

  function pin(node) {
    if (node.dataset.pinned === 'true') {
      return;
    }
    const box = localBox(node);
    node.style.position = 'absolute';
    node.style.margin = '0';
    node.style.left = box.left + 'px';
    node.style.top = box.top + 'px';
    node.style.width = box.width + 'px';
    node.style.height = box.height + 'px';
    // The stylesheet caps the panel against the viewport, which is right for a
    // dialog that has just opened and wrong for one being dragged larger by
    // hand. Once pinned, the person decides.
    node.style.maxWidth = 'none';
    node.style.maxHeight = 'none';
    node.dataset.pinned = 'true';
  }

  function beginResize(edges) {
    return function (event) {
      event.preventDefault();
      event.stopPropagation();
      const node = panel.current;
      if (!node) {
        return;
      }
      pin(node);
      // Measured in the same coordinates the pin writes, so the two cannot
      // disagree about where the panel is.
      const start = localBox(node);
      const originX = event.clientX;
      const originY = event.clientY;
      // The pointer is captured so the drag survives the cursor leaving the
      // handle, which it does immediately on any quick movement. Without this a
      // fast drag stops the moment the pointer outruns an eight pixel strip.
      if (event.target.setPointerCapture) {
        event.target.setPointerCapture(event.pointerId);
      }

      // The room available, which is the backdrop the panel sits in. A dialog
      // dragged past the window made the whole document scroll, and a scrolling
      // document is narrower by the width of its scrollbar, so the centered
      // layout shifted underneath the drag and the opposite edge appeared to
      // move on its own. Growing without limit is the defect; the drifting edge
      // was only how it showed up.
      const frame = {
        width: node.parentElement.clientWidth,
        height: node.parentElement.clientHeight
      };

      function move(pointer) {
        const dx = pointer.clientX - originX;
        const dy = pointer.clientY - originY;

        // Each edge adjusts its own coordinate and stops at the window. A west
        // drag changes the left position and the width together, so the east
        // edge stays where it is.
        if (edges.right) {
          const room = frame.width - start.left;
          node.style.width =
            Math.min(room, Math.max(MINIMUM_WIDTH, start.width + dx)) + 'px';
        }
        if (edges.left) {
          const width = Math.min(start.right, Math.max(MINIMUM_WIDTH, start.width - dx));
          node.style.width = width + 'px';
          node.style.left = (start.right - width) + 'px';
        }
        if (edges.bottom) {
          const room = frame.height - start.top;
          node.style.height =
            Math.min(room, Math.max(MINIMUM_HEIGHT, start.height + dy)) + 'px';
        }
        if (edges.top) {
          const height = Math.min(start.bottom, Math.max(MINIMUM_HEIGHT, start.height - dy));
          node.style.height = height + 'px';
          node.style.top = (start.bottom - height) + 'px';
        }
      }
      function release() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', release);
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', release);
    };
  }

  const HANDLES = [
    ['n', { top: true }], ['s', { bottom: true }],
    ['e', { right: true }], ['w', { left: true }],
    ['ne', { top: true, right: true }], ['nw', { top: true, left: true }],
    ['se', { bottom: true, right: true }], ['sw', { bottom: true, left: true }]
  ];

  // Rendered into the document body, outside whatever screen opened it. The
  // backdrop is fixed and inset to zero, which should make it the size of the
  // window. It was not: the screen it sat inside carries an entry animation
  // whose final keyframe is a transform, and an element with a transform
  // becomes the containing block for every fixed descendant it has. So the
  // backdrop was fixed to the screen, and a panel clamped to the backdrop
  // could only be dragged as large as the content area behind it. Enlarging
  // the window changed nothing, because the window was never what it was
  // measured against. A portal steps outside the subtree entirely, so no
  // ancestor's animation can redefine what fixed means.
  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={function (event) {
        startedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerUp={function (event) {
        // Closed only when the gesture both started and ended on the backdrop.
        // Anything that began inside the panel is a drag, not a dismissal.
        if (startedOnBackdrop.current && event.target === event.currentTarget) {
          onClose();
        }
        startedOnBackdrop.current = false;
      }}
    >
      <div
        className={'modal' + (className ? ' ' + className : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        {HANDLES.map(function ([name, edges]) {
          return (
            <span
              key={name}
              className={'modal-grip modal-grip-' + name}
              onPointerDown={beginResize(edges)}
              aria-hidden="true"
            />
          );
        })}

        <header className="modal-head">
          <h1>{title}</h1>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            {'\u2715'}
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}
