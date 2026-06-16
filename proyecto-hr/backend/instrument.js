import * as Sentry from "@sentry/node";

// Only initialize if DSN is configured — skips silently in local dev without env var
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Don't capture 4xx — only real server errors
    beforeSend(event) {
      if (event.exception) {
        const status = event.extra?.status || event.contexts?.response?.status_code;
        if (status && status < 500) return null;
      }
      return event;
    },
  });
}

export { Sentry };
