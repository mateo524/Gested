import test from "node:test";
import assert from "node:assert/strict";
import Employee from "../../models/Employee.js";
import {
  buildEvaluationFilter,
  canEmployeeViewEvaluation,
  filterEvaluationsForScope,
} from "../../routes/evaluations.routes.js";
import { buildPlansFilter } from "../../routes/developmentPlans.routes.js";
import { requirePermission } from "../../middleware/rbac.js";

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

function reqBase(overrides = {}) {
  return {
    scope: {
      companyId: "orgA",
      schoolId: "schoolA",
      roleCode: "JEFE",
      employeeId: "jefe1",
      isSuperAdmin: false,
      ...overrides.scope,
    },
    query: {
      ...overrides.query,
    },
    user: {
      permisos: [],
      ...overrides.user,
    },
  };
}

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

async function runMiddleware(middleware, req) {
  const res = mockRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("JEFE no puede consultar evaluations de empleado fuera de su equipo", async () => {
  const restore = patchTeamIds(["emp-team-1"]);
  try {
    const req = reqBase({
      query: { employeeId: "emp-outside-9" },
    });
    await assert.rejects(() => buildEvaluationFilter(req), /fuera de tu equipo/);
  } finally {
    restore();
  }
});

test("JEFE no puede consultar developmentPlans de empleado fuera de su equipo", async () => {
  const restore = patchTeamIds(["emp-team-1"]);
  try {
    const req = reqBase({
      query: { employeeId: "emp-outside-9" },
    });
    await assert.rejects(() => buildPlansFilter(req), /fuera de tu equipo/);
  } finally {
    restore();
  }
});

test("EMPLEADO queda limitado a su propio employeeId en evaluations aunque mande query", async () => {
  const req = reqBase({
    scope: {
      roleCode: "EMPLEADO",
      employeeId: "emp-self-1",
    },
    query: { employeeId: "emp-other-2" },
  });

  const filter = await buildEvaluationFilter(req);
  assert.equal(filter.employeeId, "emp-self-1");
  assert.equal(filter.companyId, "orgA");
});

test("EMPLEADO no recibe evaluacion de jefatura abierta dentro de su lista visible", async () => {
  const req = reqBase({
    scope: {
      roleCode: "EMPLEADO",
      employeeId: "emp-self-1",
    },
  });

  const visible = filterEvaluationsForScope(req, [
    { _id: "auto-1", employeeId: "emp-self-1", tipo: "AUTOEVALUACION", estado: "ENVIADA" },
    { _id: "boss-open-1", employeeId: "emp-self-1", tipo: "JEFATURA", estado: "REVISADA" },
  ]);

  assert.deepEqual(
    visible.map((item) => item._id),
    ["auto-1"]
  );
});

test("EMPLEADO si puede ver su autoevaluacion propia", async () => {
  const req = reqBase({
    scope: {
      roleCode: "EMPLEADO",
      employeeId: "emp-self-1",
    },
  });

  assert.equal(
    canEmployeeViewEvaluation(req, {
      employeeId: "emp-self-1",
      tipo: "AUTOEVALUACION",
      estado: "BORRADOR",
    }),
    true
  );
});

test("MANAGER si puede ver evaluacion de jefatura dentro de su alcance", async () => {
  const req = reqBase({
    scope: {
      roleCode: "JEFE",
      employeeId: "jefe-1",
    },
  });

  assert.equal(
    canEmployeeViewEvaluation(req, {
      employeeId: "emp-team-1",
      tipo: "JEFATURA",
      estado: "REVISADA",
    }),
    true
  );
});

test("ORG_ADMIN mantiene tenant del scope en evaluations y no ve otra organizacion", async () => {
  const req = reqBase({
    scope: {
      roleCode: "ADMIN_COLEGIO",
      companyId: "org-own",
      schoolId: "school-own",
      employeeId: null,
    },
    query: { employeeId: "emp-a1" },
  });

  const filter = await buildEvaluationFilter(req);
  assert.equal(filter.companyId, "org-own");
  assert.deepEqual(filter.schoolId, { $in: ["school-own", null] });
  assert.equal(filter.employeeId, "emp-a1");
});

// requirePermission always hydrates from DB — skip if no DB available in CI
const hasDb = Boolean(process.env.MONGO_URI);
test("LECTOR/AUDITOR no puede escribir endpoint critico protegido por permiso de escritura", { skip: !hasDb }, async () => {
  const middleware = requirePermission("manage_employees");
  const { res, nextCalled } = await runMiddleware(middleware, {
    user: {
      permisos: ["read_only_access"],
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload?.mensaje, "No tienes permiso para realizar esta accion");
});

test("SUPER_ADMIN puede filtrar globalmente en evaluations sin restriccion de company/school", async () => {
  const req = reqBase({
    scope: {
      isSuperAdmin: true,
      companyId: null,
      schoolId: null,
      roleCode: "SUPER_ADMIN",
    },
    query: { employeeId: "emp-any-1", estado: "ENVIADA" },
  });

  const filter = await buildEvaluationFilter(req);
  assert.equal(filter.employeeId, "emp-any-1");
  assert.equal(filter.estado, "ENVIADA");
  assert.equal("companyId" in filter, false);
});
