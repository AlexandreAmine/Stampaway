/**
 * Asks Home to open its notifications sheet — what tapping a push
 * notification does. A request made before Home is on screen (the tap
 * that launched the app) waits until Home picks it up.
 */
let pending = false;
const listeners = new Set<() => void>();

export function requestNotificationsSheet(): void {
  pending = true;
  listeners.forEach((listener) => listener());
}

/** Calls `open` for a waiting request and every later one, until unsubscribed. */
export function onNotificationsRequest(open: () => void): () => void {
  const handle = () => {
    if (!pending) return;
    pending = false;
    open();
  };
  listeners.add(handle);
  handle();
  return () => {
    listeners.delete(handle);
  };
}
