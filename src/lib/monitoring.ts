/**
 * Crash reporting.
 *
 * Sentry is loaded with a dynamic import so it lands in its own chunk rather
 * than the entry bundle — statically importing it cost ~109 kB of the startup
 * parse, and the entry bundle is the thing startup performance hinges on. It
 * still starts loading immediately, just in parallel instead of in the way.
 *
 * No-ops entirely without a DSN, and stays off outside production builds, so
 * local development never spends the error quota or reports noise from
 * half-finished code.
 */

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const enabled = Boolean(dsn) && import.meta.env.PROD;

type SentryModule = typeof import("@sentry/capacitor");

let sentry: Promise<SentryModule> | null = null;

export function initMonitoring() {
  if (!enabled) return;
  sentry = (async () => {
    const [Sentry, SentryReact] = await Promise.all([
      import("@sentry/capacitor"),
      import("@sentry/react"),
    ]);
    Sentry.init(
      {
        dsn,
        environment: import.meta.env.MODE,
        // Crashes only. Performance tracing and session replay both add
        // runtime cost and burn quota on data we would not act on.
        tracesSampleRate: 0,
      },
      SentryReact.init
    );
    return Sentry;
  })();
  // Monitoring must never be the reason the app fails to start.
  sentry.catch(() => {});
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!sentry) return;
  void sentry
    .then((Sentry) =>
      Sentry.captureException(error, context ? { extra: context } : undefined)
    )
    // Reporting a crash must never itself crash the error path.
    .catch(() => {});
}
