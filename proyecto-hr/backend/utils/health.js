import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let packageVersion = "unknown";
try {
  packageVersion = require("../package.json").version || "unknown";
} catch {
  packageVersion = process.env.npm_package_version || "unknown";
}

export function mapMongooseReadyState(readyState) {
  switch (Number(readyState)) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 0:
      return "disconnected";
    case 3:
      return "disconnected";
    default:
      return "unknown";
  }
}

export function buildHealthStatus(service, options = {}) {
  const hasDatabaseSignal =
    Object.prototype.hasOwnProperty.call(options, "databaseReadyState") ||
    Object.prototype.hasOwnProperty.call(options, "databaseState") ||
    Object.prototype.hasOwnProperty.call(options, "databaseOk");

  const databaseState =
    typeof options.databaseState === "string"
      ? options.databaseState
      : mapMongooseReadyState(options.databaseReadyState);

  const databaseOk =
    typeof options.databaseOk === "boolean"
      ? options.databaseOk
      : databaseState === "connected";

  const ok =
    typeof options.ok === "boolean"
      ? options.ok
      : hasDatabaseSignal
        ? databaseOk
        : true;

  return {
    ok,
    service,
    status: options.status || (ok ? "ok" : "error"),
    env: options.nodeEnv || process.env.NODE_ENV || "development",
    timestamp: options.timestamp || new Date().toISOString(),
    uptimeSeconds:
      typeof options.uptimeSeconds === "number"
        ? options.uptimeSeconds
        : Math.floor(process.uptime()),
    version: options.version || packageVersion,
    database: {
      ok: databaseOk,
      state: databaseState,
    },
  };
}
