import { PERMISSIONS } from "./permissions.js";

export const ROLE_KEYS = ["ORG_OWNER", "ORG_ADMIN", "HR", "MANAGER", "EMPLOYEE", "VIEWER", "AUDITOR"];
export const ROLE_SCOPES = ["ORGANIZATION", "REGION_COUNTRY", "BUSINESS_UNIT", "DEPARTMENT", "TEAM", "SELF"];

export const ROLE_PRESETS = [
  {
    roleKey: "ORG_OWNER",
    label: "Propietario de organizacion",
    description: "Administra la organizacion completa y sus accesos internos.",
    allowedScopes: ["ORGANIZATION"],
    defaultPermissions: [
      PERMISSIONS.MANAGE_SCHOOLS,
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_ROLES,
      PERMISSIONS.MANAGE_SCHOOL_USERS,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.MANAGE_COMPETENCIES,
      PERMISSIONS.MANAGE_METRICS,
      PERMISSIONS.MANAGE_EVALUATION_CYCLES,
      PERMISSIONS.MANAGE_EVALUATIONS,
      PERMISSIONS.MANAGE_DEVELOPMENT_PLANS,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.DOWNLOAD_REPORTS,
      PERMISSIONS.VIEW_AUDIT,
    ],
    cannot: ["No administra otras organizaciones", "No crea SUPER_ADMIN"],
    isSystem: true,
    legacyRoleCode: "ADMIN_COLEGIO",
  },
  {
    roleKey: "ORG_ADMIN",
    label: "Administrador de organizacion",
    description: "Gestiona personas, configuracion y seguimiento operativo dentro de su organizacion.",
    allowedScopes: ["ORGANIZATION"],
    defaultPermissions: [
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_ROLES,
      PERMISSIONS.MANAGE_SCHOOL_USERS,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.MANAGE_COMPETENCIES,
      PERMISSIONS.MANAGE_METRICS,
      PERMISSIONS.MANAGE_EVALUATION_CYCLES,
      PERMISSIONS.MANAGE_EVALUATIONS,
      PERMISSIONS.MANAGE_DEVELOPMENT_PLANS,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.DOWNLOAD_REPORTS,
      PERMISSIONS.VIEW_AUDIT,
    ],
    cannot: ["No administra otras organizaciones", "No tiene acceso plataforma"],
    isSystem: true,
    legacyRoleCode: "ADMIN_COLEGIO",
  },
  {
    roleKey: "HR",
    label: "RRHH",
    description: "Gestiona personas y acompanamiento dentro de la organizacion.",
    allowedScopes: ["ORGANIZATION", "REGION_COUNTRY", "BUSINESS_UNIT", "DEPARTMENT"],
    defaultPermissions: [
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.MANAGE_EVALUATIONS,
      PERMISSIONS.MANAGE_DEVELOPMENT_PLANS,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.DOWNLOAD_REPORTS,
    ],
    cannot: ["No administra plataforma", "No crea SUPER_ADMIN"],
    isSystem: true,
    legacyRoleCode: "RRHH",
  },
  {
    roleKey: "MANAGER",
    label: "Manager",
    description: "Gestiona seguimiento de su equipo o departamento segun alcance asignado.",
    allowedScopes: ["DEPARTMENT", "TEAM"],
    defaultPermissions: [
      PERMISSIONS.VIEW_TEAM,
      PERMISSIONS.EVALUATE_TEAM,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.DOWNLOAD_TEAM_REPORTS,
    ],
    cannot: ["No administra otras areas", "No crea usuarios globales"],
    isSystem: true,
    legacyRoleCode: "JEFE",
  },
  {
    roleKey: "EMPLOYEE",
    label: "Empleado",
    description: "Accede solo a su informacion y procesos propios.",
    allowedScopes: ["SELF"],
    defaultPermissions: [
      PERMISSIONS.VIEW_SELF_PROFILE,
      PERMISSIONS.SELF_EVALUATE,
      PERMISSIONS.DOWNLOAD_SELF_REPORT,
    ],
    cannot: ["No gestiona otras personas", "No cambia permisos"],
    isSystem: true,
    legacyRoleCode: "EMPLEADO",
  },
  {
    roleKey: "VIEWER",
    label: "Lector",
    description: "Consulta informacion en modo solo lectura dentro del alcance asignado.",
    allowedScopes: ["ORGANIZATION", "REGION_COUNTRY", "BUSINESS_UNIT", "DEPARTMENT", "TEAM", "SELF"],
    defaultPermissions: [PERMISSIONS.READ_ONLY_ACCESS, PERMISSIONS.VIEW_REPORTS],
    cannot: ["No escribe", "No confirma importaciones"],
    isSystem: true,
    legacyRoleCode: "LECTOR",
  },
  {
    roleKey: "AUDITOR",
    label: "Auditor",
    description: "Consulta informacion y auditoria en modo solo lectura.",
    allowedScopes: ["ORGANIZATION", "REGION_COUNTRY", "BUSINESS_UNIT", "DEPARTMENT", "TEAM", "SELF"],
    defaultPermissions: [PERMISSIONS.READ_ONLY_ACCESS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.VIEW_AUDIT],
    cannot: ["No escribe", "No confirma importaciones"],
    isSystem: true,
    legacyRoleCode: "LECTOR",
  },
];

export function getRolePreset(roleKey) {
  return ROLE_PRESETS.find((item) => item.roleKey === roleKey) || null;
}

export function getPresetByLegacyRoleCode(roleCode) {
  return ROLE_PRESETS.find((item) => item.legacyRoleCode === roleCode) || null;
}

export function isValidRoleKey(roleKey) {
  return ROLE_KEYS.includes(roleKey);
}

export function isValidRoleScope(scope) {
  return ROLE_SCOPES.includes(scope);
}
