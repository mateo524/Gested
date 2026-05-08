export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(fetcher, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetcher(controller.signal).finally(() => clearTimeout(timer));
}

function combineSignals(timeoutSignal, externalSignal) {
  if (!externalSignal) return timeoutSignal;
  if (externalSignal.aborted) return externalSignal;

  const bridge = new AbortController();
  const abortBridge = () => bridge.abort();
  timeoutSignal.addEventListener("abort", abortBridge, { once: true });
  externalSignal.addEventListener("abort", abortBridge, { once: true });
  return bridge.signal;
}

export async function apiFetch(path, { token, headers, timeoutMs, signal, ...options } = {}) {
  const activeCompanyId = localStorage.getItem("active_company_id");
  const isGet = (options.method || "GET").toUpperCase() === "GET";
  const effectiveTimeout = Number(timeoutMs || DEFAULT_TIMEOUT_MS);

  const requestInit = (requestSignal) => ({
    ...options,
    signal: requestSignal,
    headers: {
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
    },
  });

  const doRequest = () =>
    withTimeout(
      (timeoutSignal) =>
        fetch(`${apiUrl}${path}`, requestInit(combineSignals(timeoutSignal, signal))),
      effectiveTimeout
    );

  let response;
  try {
    response = await doRequest();
  } catch (error) {
    if (isGet) {
      try {
        response = await doRequest();
      } catch (retryError) {
        throw new Error(
          retryError?.name === "AbortError"
            ? "El servidor demoro en responder"
            : "No se pudo conectar con el servidor"
        );
      }
    } else {
      throw new Error(
        error?.name === "AbortError"
          ? "La solicitud tardo demasiado"
          : "No se pudo conectar con el servidor"
      );
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
    const baseMessage =
      (typeof data === "object" && (data?.mensaje || data?.message)) ||
      (typeof data === "string" && data) ||
      "Error de servidor";
    const code = typeof data === "object" && data?.code ? ` [code: ${data.code}]` : "";
    const request = typeof data === "object" && data?.request ? ` [request: ${data.request}]` : "";
    throw new Error(`${baseMessage}${code}${request}`);
  }

  return data;
}
