import test from "node:test";
import assert from "node:assert/strict";
import { can, scopeAccessAllowed, validateRoleAssignmentInput } from "../../utils/accessControl.js";

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
