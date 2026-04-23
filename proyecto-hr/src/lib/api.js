export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function apiFetch(path, { token, headers, ...options } = {}) {
  const activeCompanyId = localStorage.getItem("active_company_id");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
    },
  });

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
