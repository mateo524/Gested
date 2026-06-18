import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import AuditLog from "../../models/AuditLog.js";
import Employee from "../../models/Employee.js";
import ImportJob from "../../models/ImportJob.js";
import KPIRecord from "../../models/KPIRecord.js";
import OKRRecord from "../../models/OKRRecord.js";
import Role from "../../models/Role.js";
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

// These tests call requireAnyPermission which always hydrates from DB.
// Without MONGO_URI (CI unit-test pass) the hydration returns 401 instead of 403.
// Skip them unless a real DB connection is available.
const hasDb = Boolean(process.env.MONGO_URI);

test("EMPLOYEE no puede usar bulk import de gestion", { skip: !hasDb }, async () => {
  const { res, nextCalled } = await runMiddleware(bulkImportManageAccess, {
    user: {
      permisos: [PERMISSIONS.DOWNLOAD_SELF_REPORT, PERMISSIONS.VIEW_SELF_PROFILE],
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("VIEWER/AUDITOR puede leer jobs pero no confirmar importacion", { skip: !hasDb }, async () => {
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

test("bulk import confirm persiste KPIRecord y OKRRecord con source e importJobId", async () => {
  const originalStartSession = mongoose.startSession;
  const originalImportJobFindOne = ImportJob.findOne;
  const originalImportJobFindById = ImportJob.findById;
  const originalRoleFind = Role.find;
  const originalEmployeeFind = Employee.find;
  const originalUserFind = User.find;
  const originalKpiFindOne = KPIRecord.findOne;
  const originalKpiCreate = KPIRecord.create;
  const originalOkrFindOne = OKRRecord.findOne;
  const originalOkrCreate = OKRRecord.create;
  const originalAuditCreate = AuditLog.create;

  const createdKpis = [];
  const createdOkrs = [];
  const job = {
    _id: "job-metrics-1",
    companyId: "org-a",
    schoolId: "school-a",
    stage: "analyzed",
    sourceFileName: "bulk.xlsx",
    previewSummary: {
      preview: {
        employees: [],
        usersAndRoles: [],
        managers: [],
        kpis: [
          {
            _rowNumber: 2,
            kpi_code: "KPI-001",
            kpi_name: "Satisfacción del estudiante",
            owner_employee_code: "EMP-1",
            employee_email: "ana@demo.local",
            department_code: "DEP-ACA",
            target_value: 92,
            current_value: 88,
            frequency: "quarterly",
            period: "2026-Q2",
            unit: "percent",
            weight: 2,
            active: "yes",
            status: "active",
          },
        ],
        okrs: [
          {
            _rowNumber: 3,
            okr_code: "OKR-001",
            objective_title: "Mejorar participación",
            key_result_title: "Alcanzar 90% de participación",
            owner_employee_code: "EMP-1",
            employee_email: "ana@demo.local",
            department_code: "DEP-ACA",
            quarter: "2026-Q2",
            target_value: 90,
            current_value: 60,
            weight: 3,
            active: "yes",
            status: "active",
          },
        ],
      },
      summary: { totalRows: 2, validRows: 2, warnings: 0, errors: 0 },
      persistenceWarnings: [],
    },
    issues: [],
    auditTrail: [],
    save: async function save() {
      return this;
    },
  };

  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      await callback();
    },
    async endSession() {},
  });
  ImportJob.findOne = () => ({
    sort: async () => job,
  });
  ImportJob.findById = () => ({
    lean: async () => job,
  });
  Role.find = () => ({
    session() {
      return {
        lean: async () => [],
      };
    },
  });
  Employee.find = () => ({
    session: async () => [
      {
        _id: "emp-1",
        legajo: "EMP-1",
        email: "ana@demo.local",
        area: "Académica",
      },
    ],
  });
  User.find = () => ({
    session: async () => [
      {
        _id: "user-ana",
        email: "ana@demo.local",
      },
    ],
  });
  KPIRecord.findOne = () => ({
    session: async () => null,
  });
  KPIRecord.create = async ([payload]) => {
    createdKpis.push(payload);
    return [payload];
  };
  OKRRecord.findOne = () => ({
    session: async () => null,
  });
  OKRRecord.create = async ([payload]) => {
    createdOkrs.push(payload);
    return [payload];
  };
  AuditLog.create = async () => ({ _id: "audit-1" });

  try {
    const response = await confirmBulkImportJob({
      req: {
        scope: { companyId: "org-a", schoolId: "school-a", isSuperAdmin: false },
        user: { userId: "user-admin-1" },
      },
      importJobId: "job-metrics-1",
      previewToken: null,
    });

    assert.equal(response.status, 200);
    assert.equal(createdKpis.length, 1);
    assert.equal(createdOkrs.length, 1);
    assert.equal(createdKpis[0].source, "bulk_import");
    assert.equal(createdKpis[0].importJobId, "job-metrics-1");
    assert.equal(createdKpis[0].ownerUserId, "user-ana");
    assert.equal(createdKpis[0].period, "2026-Q2");
    assert.equal(createdKpis[0].currentValue, 88);
    assert.equal(createdOkrs[0].source, "bulk_import");
    assert.equal(createdOkrs[0].importJobId, "job-metrics-1");
    assert.equal(createdOkrs[0].ownerUserId, "user-ana");
    assert.equal(createdOkrs[0].period, "2026-Q2");
    assert.equal(createdOkrs[0].objective, "Mejorar participación");
    assert.equal(createdOkrs[0].keyResult, "Alcanzar 90% de participación");
    assert.equal(response.payload.result.kpis.created, 1);
    assert.equal(response.payload.result.okrs.created, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    ImportJob.findOne = originalImportJobFindOne;
    ImportJob.findById = originalImportJobFindById;
    Role.find = originalRoleFind;
    Employee.find = originalEmployeeFind;
    User.find = originalUserFind;
    KPIRecord.findOne = originalKpiFindOne;
    KPIRecord.create = originalKpiCreate;
    OKRRecord.findOne = originalOkrFindOne;
    OKRRecord.create = originalOkrCreate;
    AuditLog.create = originalAuditCreate;
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
