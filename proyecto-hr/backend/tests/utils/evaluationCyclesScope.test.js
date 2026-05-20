import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantIds } from "../../routes/evaluationCycles.routes.js";

test("resolveTenantIds usa req.scope para usuarios no super admin", () => {
  const req = {
    scope: {
      isSuperAdmin: false,
      companyId: "company-scope",
      schoolId: "school-scope",
    },
    body: {
      companyId: "company-body",
      schoolId: "school-body",
    },
    query: {
      companyId: "company-query",
      schoolId: "school-query",
    },
    get() {
      return "company-header";
    },
  };

  const result = resolveTenantIds(req);

  assert.equal(result.companyId, "company-scope");
  assert.equal(result.schoolId, "school-scope");
});

test("resolveTenantIds permite alcance explicito para super admin", () => {
  const req = {
    scope: {
      isSuperAdmin: true,
    },
    body: {
      companyId: "company-body",
      schoolId: "school-body",
    },
    query: {},
    get() {
      return "company-header";
    },
  };

  const result = resolveTenantIds(req);

  assert.equal(result.companyId, "company-body");
  assert.equal(result.schoolId, "school-body");
});
