import React, { Component, Suspense } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import styles from './LazyRoute.module.scss';

// Shown while a page's code downloads. Reserves a full viewport of height
// (like the Gallery's own loading state) so the footer doesn't jump up and
// back down, and keeps #main-content so the skip link still works.
const RouteFallback = () => (
  <main id="main-content" tabIndex={-1} className="subpage-layout">
    <div className={styles.state} role="status">
      <Loader2 size={28} className={styles.spinner} aria-hidden="true" />
      <p>Loading…</p>
    </div>
  </main>
);

// Catches a failed page download (offline, or a page file replaced by a newer
// deployment) so the rest of the site keeps working. Retrying means reloading
// the page: browsers remember a failed module download for the life of the
// page, so retrying in place would fail again — and a reload also picks up a
// newer deployment's files. Only ever reloads when the visitor asks.
class RouteErrorBoundary extends Component {
  state = { failed: false, offline: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  handleRetry = () => {
    // Reloading while offline would only swap this message for the
    // browser's own offline page.
    if (navigator.onLine === false) {
      this.setState({ offline: true });
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main id="main-content" tabIndex={-1} className="subpage-layout">
        <div className={styles.state}>
          <h1 className={styles.heading}>This page didn't load</h1>
          <p role="alert">
            {this.state.offline
              ? "You appear to be offline. Reconnect, then try again."
              : 'Please check your connection and try again.'}
          </p>
          <button type="button" className="btn btn-primary-gold" onClick={this.handleRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      </main>
    );
  }
}

// Route element for a lazy() page: loading fallback and error handling for
// that page only, inside the router and page transition.
const LazyRoute = ({ page: Page, ...props }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <Page {...props} />
    </Suspense>
  </RouteErrorBoundary>
);

export default LazyRoute;
