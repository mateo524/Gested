import test from "node:test";
import assert from "node:assert/strict";
import { buildScopedFilter } from "../../middleware/tenantScope.js";

test("Org A no puede forzar acceso a Org B: buildScopedFilter siempre usa companyId del scope", () => {
  const req = {
    scope: {
      companyId: "orgA",
      schoolId: "schoolA",
      isSuperAdmin: false,
    },
  };

  const filter = buildScopedFilter(req, {
    companyId: "orgB",
    schoolId: "schoolB",
    estado: "ACTIVO",
  });

  assert.equal(filter.companyId, "orgA");
  assert.deepEqual(filter.schoolId, { $in: ["schoolA", null] });
  assert.equal(filter.estado, "ACTIVO");
});

test("SUPER_ADMIN conserva alcance global en buildScopedFilter", () => {
  const req = {
    scope: {
      companyId: "orgA",
      schoolId: "schoolA",
      isSuperAdmin: true,
    },
  };

  const filter = buildScopedFilter(req, {
    companyId: "orgB",
    estado: "ACTIVO",
  });

  assert.equal(filter.companyId, "orgB");
  assert.equal(filter.estado, "ACTIVO");
});
