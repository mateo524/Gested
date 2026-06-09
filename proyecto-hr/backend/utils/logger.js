// Structured logger for ZENTOR backend.
// In production (NODE_ENV=production) emits JSON lines that Cloud Logging
// reads automatically from stdout.  In all other envs it prints readable,
// colour-coded lines so local dev stays comfortable.

const IS_PROD = process.env.NODE_ENV === "production";

// ANSI colour codes — only used outside production
const COLOURS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  info: "\x1b[36m",    // cyan
  warn: "\x1b[33m",    // yellow
  error: "\x1b[31m",   // red
  debug: "\x1b[35m",   // magenta
};

// Cloud Logging severity labels map 1-to-1 to our level names except "warn"
const SEVERITY = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
};

/**
 * Core log function.
 * @param {"debug"|"info"|"warn"|"error"} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function log(level, message, meta = {}) {
  const severity = SEVERITY[level] ?? "DEFAULT";

  if (IS_PROD) {
    // Structured JSON — Cloud Logging picks up `severity`, `message`, and
    // any extra fields automatically.
    const entry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    // Use the appropriate stream: errors → stderr, everything else → stdout
    if (level === "error") {
      process.stderr.write(JSON.stringify(entry) + "\n");
    } else {
      process.stdout.write(JSON.stringify(entry) + "\n");
    }
  } else {
    const colour = COLOURS[level] ?? COLOURS.reset;
    const ts = new Date().toISOString();
    const label = level.toUpperCase().padEnd(5);
    const metaStr = Object.keys(meta).length
      ? " " + COLOURS.dim + JSON.stringify(meta) + COLOURS.reset
      : "";
    const line = `${COLOURS.dim}${ts}${COLOURS.reset} ${colour}${label}${COLOURS.reset} ${message}${metaStr}`;
    if (level === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }
}

export const logger = {
  debug: (message, meta) => log("debug", message, meta),
  info:  (message, meta) => log("info",  message, meta),
  warn:  (message, meta) => log("warn",  message, meta),
  error: (message, meta) => log("error", message, meta),
};

export { log };
