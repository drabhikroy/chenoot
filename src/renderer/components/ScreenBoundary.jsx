import { Component } from 'react';

// Catches a rendering fault and shows it.
//
// React unmounts the whole tree when a component throws during render. Without
// anything to catch that, the window goes black and stays black: no message, no
// controls, and no way back except quitting. Everything else in the application
// is still fine, which makes the blank window worse than the fault behind it.
//
// What this shows instead is the error, the part of the interface that failed,
// and a way to leave it. The message is the real one rather than an apology,
// because the person reading it is more likely to be able to report a
// TypeError than a sentence saying something went wrong.

export class ScreenBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept where the launch checks can see it. They watch the console for
    // renderer faults, and a boundary that swallows the exception would make a
    // broken screen look like a working one.
    console.error('Screen failed to render', error, info && info.componentStack);
  }

  // A screen that threw once will throw again on the same data, so the reset
  // arrives with the person going somewhere else rather than with a retry
  // button that does nothing.
  componentDidUpdate(previous) {
    if (previous.screen !== this.props.screen && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="screen screen-narrow">
        <p className="eyebrow">Something failed to draw</p>
        <h1>This screen could not be shown</h1>
        <p className="lede">
          The rest of the application is still working. Nothing has been lost, and anything
          already saved is still on disk.
        </p>
        <p className="field-error">{String(this.state.error && this.state.error.message)}</p>
        <div className="actions">
          <button className="primary" onClick={this.props.onLeave}>
            Go to the start
          </button>
        </div>
        <p className="field-hint">
          If this keeps happening on the same run, the run itself may be the cause. Past runs
          can be opened one at a time to find out which.
        </p>
      </div>
    );
  }
}
