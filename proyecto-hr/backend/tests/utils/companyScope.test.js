import test from "node:test";
import assert from "node:assert/strict";
import Company from "../../models/Company.js";
import { resolveCompanyScope } from "../../utils/companyScope.js";

test("resolveCompanyScope tolera requests sin headers definidos", async () => {
  const originalFindById = Company.findById;
  Company.findById = () => ({
    lean: async () => ({
      _id: "org-a",
      activa: true,
    }),
  });

  try {
    const result = await resolveCompanyScope({
      user: {
        companyId: "org-a",
        isSuperAdmin: false,
      },
    });

    assert.equal(result.companyId, "org-a");
    assert.equal(String(result.company._id), "org-a");
  } finally {
    Company.findById = originalFindById;
  }
});
