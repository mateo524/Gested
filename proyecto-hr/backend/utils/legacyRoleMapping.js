const FORBIDDEN_PLATFORM_ROLE_KEYS = new Set(["SUPER_ADMIN", "PLATFORM"]);

function normalizeRoleValue(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function mapRoleInputToLegacyRoleCode(input, fallback = "EMPLEADO") {
  const normalized = normalizeRoleValue(input);
  if (!normalized) return fallback;
  if (["ORG_OWNER", "ORG_ADMIN", "DIRECTOR", "ADMIN", "ADMIN_COLEGIO", "DIRECTIVO"].includes(normalized)) {
    return "ADMIN_COLEGIO";
  }
  if (["HR", "RRHH", "RH"].includes(normalized)) return "RRHH";
  if (["MANAGER", "JEFE", "LIDER"].includes(normalized)) return "JEFE";
  if (["VIEWER", "AUDITOR", "LECTOR"].includes(normalized)) return "LECTOR";
  if (["EMPLOYEE", "EMPLEADO", "DOCENTE", "TEACHER", "COLABORADOR"].includes(normalized)) return "EMPLEADO";
  return fallback;
}

export function isForbiddenPlatformRoleInput(input) {
  return FORBIDDEN_PLATFORM_ROLE_KEYS.has(normalizeRoleValue(input));
}
