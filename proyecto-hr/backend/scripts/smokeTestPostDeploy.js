import "dotenv/config";

const API_URL = process.env.SMOKE_API_URL || process.env.FRONTEND_API_URL || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || "superadmin@performia.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Performia#2026!App";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (!response.ok) {
    throw new Error(`[${response.status}] ${path}: ${typeof data === "object" ? data?.mensaje : data}`);
  }
  return data;
}

async function run() {
  console.log(`Smoke test contra ${API_URL}`);

  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login?.token;
  if (!token) throw new Error("Login no devolvio token.");
  console.log("OK login superadmin");

  const me = await request("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`OK perfil: ${me?.email}`);

  await request("/education-exports/overview", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("OK overview de bases/descargas");

  await request("/education-exports/import-jobs", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("OK historial de importaciones");

  await request("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  console.log("OK forgot-password");

  console.log("Smoke test finalizado sin errores.");
}

run().catch((error) => {
  console.error("Smoke test fallo:", error.message);
  process.exit(1);
});
