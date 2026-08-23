// Tiny pub/sub decoupling the Preloader from Hero's entrance animation.
// Seeded from sessionStorage so the preloader only plays once per browser
// tab session — SPA navigation and reloads within the same tab both see it
// as already complete.
const SEEN_KEY = 'homeDecor_preloader_seen';

let isComplete = typeof window !== 'undefined' && sessionStorage.getItem(SEEN_KEY) === 'true';
const listeners = new Set();

export function shouldShowPreloader() {
  return !isComplete;
}

export function markPreloaderComplete() {
  if (isComplete) return;
  isComplete = true;
  try {
    sessionStorage.setItem(SEEN_KEY, 'true');
  } catch {
    // sessionStorage unavailable (private mode, etc.) — non-fatal, the
    // preloader will just replay on the next mount within this tab.
  }
  listeners.forEach((cb) => cb());
  listeners.clear();
}

// Calls back once, either immediately (already complete) or when
// markPreloaderComplete() next runs. Returns an unsubscribe function.
export function onPreloaderComplete(callback) {
  if (isComplete) {
    callback();
    return () => {};
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}
