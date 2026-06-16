import * as Sentry from "@sentry/react";

// Preferred: set VITE_SENTRY_DSN in Vercel env vars pointing to the javascript-react Sentry project.
// Fallback: current Node project DSN (still captures errors, just appears under wrong project in Sentry).
const SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  "https://c0be36902ecb04d42d3acec4a410efe5@o4511576596676608.ingest.de.sentry.io/4511576630886480";

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
