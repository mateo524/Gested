import test from "node:test";
import assert from "node:assert/strict";
import Employee from "../../models/Employee.js";
import ImportJob from "../../models/ImportJob.js";
import User from "../../models/User.js";
import { buildBulkImportTenantFilter, createBulkImportAnalysisJob } from "../../services/bulkImportAnalyzer.js";
import { confirmBulkImportJob } from "../../services/bulkImportConfirm.js";
import {
  bulkImportManageAccess,
  bulkImportReadAccess,
  resolveBulkTenant,
} from "../../routes/bulkImport.routes.js";
import { PERMISSIONS } from "../../utils/permissions.js";

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

async function runMiddleware(middleware, req) {
  const res = mockRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("EMPLOYEE no puede usar bulk import de gestion", async () => {
  const { res, nextCalled } = await runMiddleware(bulkImportManageAccess, {
    user: {
      permisos: [PERMISSIONS.DOWNLOAD_SELF_REPORT, PERMISSIONS.VIEW_SELF_PROFILE],
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("VIEWER/AUDITOR puede leer jobs pero no confirmar importacion", async () => {
  const readerReq = {
    user: {
      permisos: [PERMISSIONS.READ_ONLY_ACCESS, PERMISSIONS.VIEW_AUDIT],
    },
  };
  const writerReq = {
    user: {
      permisos: [PERMISSIONS.READ_ONLY_ACCESS, PERMISSIONS.VIEW_AUDIT],
    },
  };

  const readCheck = await runMiddleware(bulkImportReadAccess, readerReq);
  const manageCheck = await runMiddleware(bulkImportManageAccess, writerReq);

  assert.equal(readCheck.nextCalled, true);
  assert.equal(manageCheck.nextCalled, false);
  assert.equal(manageCheck.res.statusCode, 403);
});

test("ADMIN/RRHH quedan filtrados a su organizacion en bulk import jobs", () => {
  const filter = buildBulkImportTenantFilter({
    scope: {
      companyId: "org-a",
      schoolId: "school-a",
      isSuperAdmin: false,
    },
  });

  assert.equal(filter.jobType, "bulk_unified");
  assert.equal(filter.companyId, "org-a");
  assert.equal(filter.schoolId, "school-a");
  assert.equal("companyId" in buildBulkImportTenantFilter({
    scope: { companyId: "org-b", schoolId: null, isSuperAdmin: false },
  }), true);
});

test("resolveBulkTenant usa companyId/schoolId desde req.scope para no super admin", () => {
  const tenant = resolveBulkTenant({
    scope: {
      companyId: "scope-company",
      schoolId: "scope-school",
      isSuperAdmin: false,
    },
    body: { schoolId: "body-school" },
    query: { schoolId: "query-school" },
    get() {
      return "header-company";
    },
  });

  assert.deepEqual(tenant, {
    companyId: "scope-company",
    schoolId: "scope-school",
  });
});

test("analyze crea ImportJob en estado analyzed", async () => {
  const originalCreate = ImportJob.create;
  const calls = [];
  ImportJob.create = async (payload) => {
    calls.push(payload);
    return { _id: "job-1", ...payload };
  };

  try {
    const result = await createBulkImportAnalysisJob({
      req: { user: { userId: "user-1" } },
      file: { originalname: "fake.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      companyId: "org-a",
      schoolId: "school-a",
      analysis: {
        summary: {
          totalRows: 5,
          validRows: 4,
          warnings: 1,
          errors: 0,
          bySheet: {},
        },
        raw: {
          preview: { employees: [] },
          persistenceWarnings: [],
        },
        errors: [],
        warnings: [],
      },
    });

    assert.equal(result.job.stage, "analyzed");
    assert.equal(calls[0].jobType, "bulk_unified");
    assert.equal(calls[0].datasetDetected, "bulk-unified");
  } finally {
    ImportJob.create = originalCreate;
  }
});

test("confirm no corre si hay errores bloqueantes y no inserta empleados ni usuarios", async () => {
  const originalFindOne = ImportJob.findOne;
  const originalEmployeeCreate = Employee.create;
  const originalUserCreate = User.create;
  const called = { employeeCreate: 0, userCreate: 0 };

  const job = {
    _id: "job-blocked",
    companyId: "org-a",
    schoolId: "school-a",
    stage: "analyzed",
    previewSummary: { preview: {}, summary: { errors: 1 } },
    issues: [
      {
        rowNumber: "2",
        message: "roleKey no permitido: PLATFORM",
        severity: "error",
        normalized: { sheet: "Usuarios_y_Roles", field: "role_key" },
      },
    ],
    auditTrail: [],
    save: async () => {},
  };

  ImportJob.findOne = () => ({
    sort: async () => job,
  });
  Employee.create = async () => {
    called.employeeCreate += 1;
    return [];
  };
  User.create = async () => {
    called.userCreate += 1;
    return [];
  };

  try {
    const response = await confirmBulkImportJob({
      req: {
        scope: { companyId: "org-a", schoolId: "school-a", isSuperAdmin: false },
        user: { userId: "user-1" },
      },
      importJobId: "job-blocked",
      previewToken: null,
    });

    assert.equal(response.status, 400);
    assert.equal(response.payload.ok, false);
    assert.equal(called.employeeCreate, 0);
    assert.equal(called.userCreate, 0);
  } finally {
    ImportJob.findOne = originalFindOne;
    Employee.create = originalEmployeeCreate;
    User.create = originalUserCreate;
  }
});
