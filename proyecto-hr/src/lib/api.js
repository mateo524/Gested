export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    promise: promise(controller).finally(() => clearTimeout(timer)),
  };
}

export async function apiFetch(path, { token, headers, ...options } = {}) {
  const activeCompanyId = localStorage.getItem("active_company_id");
  const isGet = (options.method || "GET").toUpperCase() === "GET";
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const externalSignal = options.signal;
  const { timeoutMs: _discardTimeout, signal: _discardSignal, ...restOptions } = options;

  const requestInit = (signal) => ({
    ...restOptions,
    signal,
    headers: {
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
    },
  });

  function combineSignals(timeoutSignal, passedSignal) {
    if (!passedSignal) return timeoutSignal;
    if (passedSignal.aborted) return passedSignal;

    const bridge = new AbortController();
    const abortBridge = () => bridge.abort();
    timeoutSignal.addEventListener("abort", abortBridge, { once: true });
    passedSignal.addEventListener("abort", abortBridge, { once: true });
    return bridge.signal;
  }

  async function doRequest() {
    const wrapped = withTimeout(
      (controller) => fetch(`${apiUrl}${path}`, requestInit(combineSignals(controller.signal, externalSignal))),
      timeoutMs
    );
    return wrapped.promise;
  }

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
      throw new Error(error?.name === "AbortError" ? "La solicitud tardo demasiado" : "No se pudo conectar con el servidor");
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
    const message =
      (typeof data === "object" && data?.mensaje) ||
      (typeof data === "string" && data) ||
      "Error de servidor";

    throw new Error(message);
  }

  return data;
}
