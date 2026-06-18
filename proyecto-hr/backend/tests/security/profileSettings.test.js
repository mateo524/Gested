import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  buildSafeUserPayload,
  sanitizeSelfProfilePayload,
  updateOwnPassword,
  validatePasswordChangePayload,
} from "../../routes/auth.routes.js";

test("usuario puede editar nombre, apellido y avatar propio sin tocar rol ni tenant", () => {
  const payload = sanitizeSelfProfilePayload({
    nombre: "  Ana  ",
    apellido: "  Perez  ",
    avatarUrl: "https://cdn.example.com/avatar.png",
    roleKey: "ORG_ADMIN",
    scope: "ORGANIZATION",
    roleLabel: "Rector",
    companyId: "otro-tenant",
    schoolId: "otro-school",
  });

  assert.deepEqual(payload, {
    nombre: "Ana",
    apellido: "Perez",
    avatarUrl: "https://cdn.example.com/avatar.png",
  });
  assert.equal("roleKey" in payload, false);
  assert.equal("scope" in payload, false);
  assert.equal("companyId" in payload, false);
  assert.equal("schoolId" in payload, false);
  assert.equal("roleLabel" in payload, false);
});

test("safe user payload no expone passwordHash y conserva roleLabel y scope visibles", () => {
  const safeUser = buildSafeUserPayload({
    user: {
      _id: "user-1",
      companyId: "company-1",
      schoolId: "school-1",
      roleId: "role-1",
      employeeId: "employee-1",
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@example.com",
      avatarUrl: "https://cdn.example.com/avatar.png",
      activo: true,
      isSuperAdmin: false,
      mustChangePassword: false,
      passwordHash: "secret",
    },
    role: { nombre: "RRHH", code: "RRHH", permisos: ["manage_users"] },
    company: { nombre: "Colegio Norte" },
    effectiveRole: {
      roleCode: "RRHH",
      roleKey: "HR",
      roleLabel: "People Partner Retail",
      roleScope: "BUSINESS_UNIT",
      departmentCode: "",
      teamId: "",
      permisos: ["manage_users"],
    },
  });

  assert.equal(safeUser.nombre, "Ana");
  assert.equal(safeUser.apellido, "Perez");
  assert.equal(safeUser.avatarUrl, "https://cdn.example.com/avatar.png");
  assert.equal(safeUser.roleKey, "HR");
  assert.equal(safeUser.roleLabel, "People Partner Retail");
  assert.equal(safeUser.scope, "BUSINESS_UNIT");
  assert.equal("passwordHash" in safeUser, false);
});

test("validatePasswordChangePayload exige longitud y confirmacion si viene", () => {
  const valid = validatePasswordChangePayload({
    currentPassword: "actual123",
    newPassword: "nueva123",
    confirmPassword: "nueva123",
  });

  assert.equal(valid.currentPassword, "actual123");
  assert.equal(valid.newPassword, "nueva123");

  assert.throws(
    () =>
      validatePasswordChangePayload({
        currentPassword: "actual123",
        newPassword: "123",
        confirmPassword: "123",
      }),
    /8 caracteres/
  );

  assert.throws(
    () =>
      validatePasswordChangePayload({
        currentPassword: "actual123",
        newPassword: "nueva123",
        confirmPassword: "otra123",
      }),
    /no coincide/i
  );
});

test("updateOwnPassword cambia la password con currentPassword valida", async () => {
  const currentHash = await bcrypt.hash("actual123", 10);
  let saveCount = 0;
  const user = {
    passwordHash: currentHash,
    mustChangePassword: true,
    async save() {
      saveCount += 1;
    },
  };

  await updateOwnPassword({
    user,
    currentPassword: "actual123",
    newPassword: "nueva123",
  });

  assert.equal(saveCount, 1);
  assert.equal(user.mustChangePassword, false);
  assert.equal(await bcrypt.compare("nueva123", user.passwordHash), true);
});

test("updateOwnPassword rechaza password actual invalida", async () => {
  const currentHash = await bcrypt.hash("actual123", 10);
  const user = {
    passwordHash: currentHash,
    mustChangePassword: true,
    async save() {},
  };

  await assert.rejects(
    () =>
      updateOwnPassword({
        user,
        currentPassword: "incorrecta",
        newPassword: "nueva123",
      }),
    /no coincide/i
  );
});
