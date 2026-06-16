function resolveApiUrl() {
  const configuredUrl = String(import.meta.env.VITE_API_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    const isLocalOrigin =
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("[::1]");

    return isLocalOrigin ? "http://localhost:3000" : import.meta.env.VITE_API_URL;
  }

  return "http://localhost:3000";
}

export const apiUrl = resolveApiUrl();

const DEFAULT_TIMEOUT_MS = 12000;
const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Verificá tu conexión o intentá nuevamente.";
const TIMEOUT_ERROR_MESSAGE =
  "La solicitud está demorando más de lo esperado. Intentá nuevamente en unos segundos.";

function sanitizeServerMessage(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("<!DOCTYPE") || value.startsWith("<html")) {
    return "Error interno del servidor. Intentá nuevamente en unos segundos.";
  }
  return value.replace(/<[^>]*>/g, "").trim();
}

function withTimeout(fetcher, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetcher(controller.signal).finally(() => clearTimeout(timer));
}

function combineSignals(timeoutSignal, externalSignal) {
  if (!externalSignal) return { signal: timeoutSignal, cleanup: () => {} };
  if (externalSignal.aborted) return { signal: externalSignal, cleanup: () => {} };

  const bridge = new AbortController();
  const abort = () => bridge.abort();
  timeoutSignal.addEventListener("abort", abort, { once: true });
  externalSignal.addEventListener("abort", abort, { once: true });
  function cleanup() {
    timeoutSignal.removeEventListener("abort", abort);
    externalSignal.removeEventListener("abort", abort);
  }
  return { signal: bridge.signal, cleanup };
}

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  if (typeof headers === "object") {
    return { ...headers };
  }
  return {};
}

function buildApiError({ response, data }) {
  const baseMessage =
    (typeof data === "object" && (data?.mensaje || data?.message)) ||
    (typeof data === "string" && sanitizeServerMessage(data)) ||
    "Ocurrió un error del servidor.";
  const code = typeof data === "object" && data?.code ? ` [code: ${data.code}]` : "";
  const request = typeof data === "object" && data?.request ? ` [request: ${data.request}]` : "";
  const error = new Error(`${baseMessage}${code}${request}`);

  error.status = response.status;
  error.code = typeof data === "object" ? data?.code || "" : "";
  error.data = typeof data === "object" ? data : null;
  error.errors = Array.isArray(data?.errors) ? data.errors : [];
  error.warnings = Array.isArray(data?.warnings) ? data.warnings : [];

  return error;
}

export async function apiFetch(path, { token, headers, timeoutMs, signal, ...options } = {}) {
  const activeCompanyId = localStorage.getItem("active_company_id");
  const isGet = (options.method || "GET").toUpperCase() === "GET";
  const effectiveTimeout = Number(timeoutMs || DEFAULT_TIMEOUT_MS);

  const requestInit = (requestSignal) => ({
    ...options,
    signal: requestSignal,
    headers: {
      ...normalizeHeaders(headers),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
    },
  });

  const doRequest = () =>
    withTimeout(
      (timeoutSignal) => {
        const { signal: combinedSignal, cleanup } = combineSignals(timeoutSignal, signal);
        return fetch(`${apiUrl}${path}`, requestInit(combinedSignal)).finally(cleanup);
      },
      effectiveTimeout
    );

  let response;
  try {
    response = await doRequest();
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    if (isGet) {
      try {
        response = await doRequest();
      } catch (retryError) {
        throw new Error(retryError?.name === "AbortError" ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE);
      }
    } else {
      throw new Error(isTimeout ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE);
    }
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw buildApiError({ response, data });
  }

  return data;
}
