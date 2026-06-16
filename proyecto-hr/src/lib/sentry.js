import * as Sentry from "@sentry/react";

// DSN must be set via VITE_SENTRY_DSN env var (Vercel → Settings → Environment Variables)
// Project: javascript-react (NOT node) — get DSN from Sentry → Projects → javascript-react → Settings → Client Keys
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) return; // silently skip in local dev without config

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    replaysSessionSampleRate: 0,
    integrations: [Sentry.replayIntegration()],
  });
}

export { Sentry };
