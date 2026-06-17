import * as Sentry from "@sentry/react";

export function initSentry() {
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN, // only set when env var is present
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    replaysSessionSampleRate: 0,
    integrations: [Sentry.replayIntegration()],
  });
}

export { Sentry };
