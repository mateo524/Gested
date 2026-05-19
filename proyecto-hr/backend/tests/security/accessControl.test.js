import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAssignmentSyncPlanForLegacyRole,
  can,
  scopeAccessAllowed,
  validateRoleAssignmentInput,
} from "../../utils/accessControl.js";
import {
  getPresetByLegacyRoleCode,
  getRolePreset,
} from "../../utils/rolePresets.js";

test("MANAGER con TEAM no puede acceder a empleado fuera de su equipo", () => {
  const allowed = scopeAccessAllowed(
    {
      companyId: "org-a",
      roleScope: "TEAM",
      employeeId: "mgr-1",
      teamId: "",
    },
    {
      companyId: "org-a",
      employeeId: "emp-9",
      managerId: "mgr-2",
    }
  );

  assert.equal(allowed, false);
});

test("ORG_ADMIN no puede acceder a otra organizacion", () => {
  const allowed = scopeAccessAllowed(
    {
      companyId: "org-a",
      roleScope: "ORGANIZATION",
      roleKey: "ORG_ADMIN",
    },
    {
      companyId: "org-b",
    }
  );

  assert.equal(allowed, false);
});

test("EMPLOYEE con SELF no tiene permisos de gestion", async () => {
  const allowed = await can(
    {
      companyId: "org-a",
      roleCode: "EMPLEADO",
      permisos: [],
    },
    "manage_employees"
  );

  assert.equal(allowed, false);
});

test("VIEWER y AUDITOR quedan en solo lectura", async () => {
  const viewerWrite = await can(
    {
      companyId: "org-a",
      roleKey: "VIEWER",
      roleScope: "ORGANIZATION",
      permisos: [],
    },
    "manage_users"
  );
  const auditorWrite = await can(
    {
      companyId: "org-a",
      roleKey: "AUDITOR",
      roleScope: "ORGANIZATION",
      permisos: [],
    },
    "manage_roles"
  );
  const auditorRead = await can(
    {
      companyId: "org-a",
      roleKey: "AUDITOR",
      roleScope: "ORGANIZATION",
      permisos: [],
    },
    "view_audit"
  );

  assert.equal(viewerWrite, false);
  assert.equal(auditorWrite, false);
  assert.equal(auditorRead, true);
});

test("roleKey invalido se rechaza en asignaciones", () => {
  assert.throws(
    () => validateRoleAssignmentInput({ roleKey: "DIRECTOR", scope: "ORGANIZATION" }),
    /roleKey invalido/
  );
});

test("scope invalido se rechaza en asignaciones", () => {
  assert.throws(
    () => validateRoleAssignmentInput({ roleKey: "HR", scope: "GLOBAL" }),
    /scope invalido/
  );
});

test("al cambiar rol legacy desde usuarios se preserva el scope fino si es compatible", () => {
  const plan = buildAssignmentSyncPlanForLegacyRole({
    currentAssignment: {
      roleKey: "MANAGER",
      scope: "DEPARTMENT",
      departmentCode: "Academico",
      teamId: "",
      active: true,
    },
    targetLegacyRoleCode: "RRHH",
  });

  assert.deepEqual(plan, {
    roleKey: "HR",
    scope: "DEPARTMENT",
    departmentCode: "Academico",
    teamId: "",
    active: true,
  });
});

test("al cambiar rol legacy con mismo codigo se preserva el roleKey actual", () => {
  const plan = buildAssignmentSyncPlanForLegacyRole({
    currentAssignment: {
      roleKey: "AUDITOR",
      scope: "ORGANIZATION",
      departmentCode: "",
      teamId: "",
      active: true,
    },
    targetLegacyRoleCode: "LECTOR",
  });

  assert.deepEqual(plan, {
    roleKey: "AUDITOR",
    scope: "ORGANIZATION",
    departmentCode: "",
    teamId: "",
    active: true,
  });
});

test("al cambiar rol legacy a uno incompatible se rechaza para evitar degradar alcance", () => {
  assert.throws(
    () =>
      buildAssignmentSyncPlanForLegacyRole({
        currentAssignment: {
          roleKey: "MANAGER",
          scope: "TEAM",
          departmentCode: "",
          teamId: "team-1",
          active: true,
        },
        targetLegacyRoleCode: "EMPLEADO",
      }),
    /no es compatible con el alcance actual/i
  );
});

test("ADMIN_COLEGIO legacy resuelve canonicamente a ORG_ADMIN", () => {
  const preset = getPresetByLegacyRoleCode("ADMIN_COLEGIO");

  assert.equal(preset?.roleKey, "ORG_ADMIN");
});

test("ORG_OWNER sigue existiendo como preset valido", () => {
  const preset = getRolePreset("ORG_OWNER");

  assert.equal(preset?.roleKey, "ORG_OWNER");
  assert.equal(preset?.legacyRoleCode, "ADMIN_COLEGIO");
});

test("ORG_OWNER y ORG_ADMIN conservan sus allowedScopes y permisos actuales", () => {
  const owner = getRolePreset("ORG_OWNER");
  const admin = getRolePreset("ORG_ADMIN");

  assert.deepEqual(owner?.allowedScopes, ["ORGANIZATION"]);
  assert.deepEqual(admin?.allowedScopes, ["ORGANIZATION"]);
  assert.equal(owner?.defaultPermissions.includes("manage_schools"), true);
  assert.equal(admin?.defaultPermissions.includes("manage_schools"), false);
  assert.equal(owner?.defaultPermissions.includes("manage_users"), true);
  assert.equal(admin?.defaultPermissions.includes("manage_users"), true);
});

test("otros legacyRoleCode siguen resolviendo como antes", () => {
  assert.equal(getPresetByLegacyRoleCode("RRHH")?.roleKey, "HR");
  assert.equal(getPresetByLegacyRoleCode("JEFE")?.roleKey, "MANAGER");
  assert.equal(getPresetByLegacyRoleCode("EMPLEADO")?.roleKey, "EMPLOYEE");
});
