import test from "node:test";
import assert from "node:assert/strict";
import Employee from "../../models/Employee.js";
import School from "../../models/School.js";
import User from "../../models/User.js";
import EvaluationCycle from "../../models/EvaluationCycle.js";
import {
  buildOperationalRecordFilter,
  buildOperationalRecordPayload,
} from "../../routes/metrics.routes.js";

function patchTeamIds(teamIds) {
  const original = Employee.find;
  Employee.find = () => ({
    select: () => ({
      lean: async () => teamIds.map((id) => ({ _id: id })),
    }),
  });
  return () => {
    Employee.find = original;
  };
}

test("MANAGER TEAM no puede ver KPI/OKR de empleado ajeno", async () => {
  const restore = patchTeamIds(["emp-team-1"]);
  try {
    await assert.rejects(
      () =>
        buildOperationalRecordFilter({
          scope: {
            companyId: "org-a",
            schoolId: "school-a",
            roleKey: "MANAGER",
            roleCode: "JEFE",
            roleScope: "TEAM",
            employeeId: "mgr-1",
            teamId: "team-a",
            isSuperAdmin: false,
          },
          query: {
            employeeId: "emp-outside-7",
          },
        }),
      /fuera de tu alcance/
    );
  } finally {
    restore();
  }
});

test("MANAGER DEPARTMENT queda filtrado a su departamento y tenant en KPI/OKR", async () => {
  const restore = patchTeamIds(["emp-sec-1", "emp-sec-2"]);
  try {
    const filter = await buildOperationalRecordFilter({
      scope: {
        companyId: "org-a",
        schoolId: "school-a",
        roleKey: "MANAGER",
        roleCode: "JEFE",
        roleScope: "DEPARTMENT",
        departmentCode: "SECUNDARIA",
        employeeId: "mgr-1",
        isSuperAdmin: false,
      },
      query: {
        companyId: "org-b",
        schoolId: "school-b",
        departmentCode: "PRIMARIA",
        status: "active",
      },
    });

    assert.equal(filter.companyId, "org-a");
    assert.equal(filter.schoolId, "school-a");
    assert.equal(filter.status, "active");
    assert.ok(Array.isArray(filter.$or));
    assert.deepEqual(filter.$or[1], { departmentCode: "SECUNDARIA" });
  } finally {
    restore();
  }
});

test("EMPLOYEE SELF solo ve sus propios KPI/OKR aunque mande employeeId ajeno", async () => {
  const filter = await buildOperationalRecordFilter({
    scope: {
      companyId: "org-a",
      schoolId: "school-a",
      roleKey: "EMPLOYEE",
      roleCode: "EMPLEADO",
      roleScope: "SELF",
      employeeId: "emp-self-1",
      isSuperAdmin: false,
    },
    query: {
      employeeId: "emp-other-9",
      companyId: "org-b",
      schoolId: "school-b",
      status: "active",
    },
  });

  assert.equal(filter.companyId, "org-a");
  assert.equal(filter.schoolId, "school-a");
  assert.equal(filter.employeeId, "emp-self-1");
  assert.equal(filter.status, "active");
});

test("SUPER_ADMIN conserva alcance global en filtros KPI/OKR", async () => {
  const filter = await buildOperationalRecordFilter({
    scope: {
      companyId: "org-a",
      schoolId: null,
      roleKey: "SUPER_ADMIN",
      roleCode: "SUPER_ADMIN",
      roleScope: "GLOBAL",
      employeeId: null,
      isSuperAdmin: true,
    },
    query: {
      companyId: "org-b",
      schoolId: "school-b",
      employeeId: "emp-any-1",
      status: "active",
    },
    get(header) {
      return header === "X-Company-Id" ? "org-header" : null;
    },
  });

  assert.equal(filter.companyId, "org-b");
  assert.equal(filter.schoolId, "school-b");
  assert.equal(filter.employeeId, "emp-any-1");
});

test("buildOperationalRecordPayload usa tenant del scope y no body para no super admin", async () => {
  const originalEmployeeFindOne = Employee.findOne;
  const originalSchoolFindOne = School.findOne;
  const originalUserFindOne = User.findOne;
  const originalCycleFindOne = EvaluationCycle.findOne;

  Employee.findOne = () => ({
    select: () => ({
      lean: async () => ({
        _id: "emp-1",
        companyId: "org-a",
        schoolId: "school-a",
        area: "SECUNDARIA",
        managerId: "mgr-1",
      }),
    }),
  });
  School.findOne = () => ({
    select: () => ({
      lean: async () => ({ _id: "school-a" }),
    }),
  });
  User.findOne = async () => null;
  EvaluationCycle.findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });

  try {
    const payload = await buildOperationalRecordPayload(
      {
        scope: {
          companyId: "org-a",
          schoolId: "school-a",
          roleKey: "ORG_ADMIN",
          roleCode: "ADMIN_COLEGIO",
          roleScope: "ORGANIZATION",
          isSuperAdmin: false,
        },
        body: {
          companyId: "org-b",
          schoolId: "school-b",
          employeeId: "emp-1",
          kpiCode: "KPI-1",
          name: "Satisfacción",
          targetValue: 90,
          currentValue: 75,
          period: "2026-Q2",
        },
        query: {
          companyId: "org-c",
          schoolId: "school-c",
        },
        user: {
          userId: "user-admin-1",
        },
        get() {
          return "org-header";
        },
      },
      "kpi"
    );

    assert.equal(payload.companyId, "org-a");
    assert.equal(payload.schoolId, "school-a");
    assert.equal(String(payload.employeeId), "emp-1");
    assert.equal(payload.createdBy, "user-admin-1");
    assert.equal(payload.updatedBy, "user-admin-1");
    assert.equal(payload.source, "manual");
    assert.equal(payload.period, "2026-Q2");
  } finally {
    Employee.findOne = originalEmployeeFindOne;
    School.findOne = originalSchoolFindOne;
    User.findOne = originalUserFindOne;
    EvaluationCycle.findOne = originalCycleFindOne;
  }
});
