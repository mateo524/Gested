import test from "node:test";
import assert from "node:assert/strict";
import { isForbiddenPlatformRoleInput, mapRoleInputToLegacyRoleCode } from "../../utils/legacyRoleMapping.js";

test("mapRoleInputToLegacyRoleCode entiende roleKeys nuevos", () => {
  assert.equal(mapRoleInputToLegacyRoleCode("ORG_ADMIN"), "ADMIN_COLEGIO");
  assert.equal(mapRoleInputToLegacyRoleCode("HR"), "RRHH");
  assert.equal(mapRoleInputToLegacyRoleCode("MANAGER"), "JEFE");
  assert.equal(mapRoleInputToLegacyRoleCode("EMPLOYEE"), "EMPLEADO");
  assert.equal(mapRoleInputToLegacyRoleCode("VIEWER"), "LECTOR");
  assert.equal(mapRoleInputToLegacyRoleCode("AUDITOR"), "LECTOR");
});

test("isForbiddenPlatformRoleInput bloquea roles de plataforma", () => {
  assert.equal(isForbiddenPlatformRoleInput("SUPER_ADMIN"), true);
  assert.equal(isForbiddenPlatformRoleInput("PLATFORM"), true);
  assert.equal(isForbiddenPlatformRoleInput("ORG_ADMIN"), false);
});
