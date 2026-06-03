import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  buildDevelopmentSuggestionsFromData,
  buildSuggestionTenantFilter,
} from "../../routes/developmentPlans.routes.js";

function objectId(seed) {
  return new mongoose.Types.ObjectId(String(seed).padStart(24, "0").slice(-24));
}

function buildEmployee(id, area = "ACA") {
  return {
    _id: objectId(id),
    nombre: `Empleado${id}`,
    apellido: `Apellido${id}`,
    area,
  };
}

test("ORG_ADMIN recibe sugerencias solo de su tenant via scope filter", () => {
  const filter = buildSuggestionTenantFilter(
    {
      scope: {
        companyId: "org-scope",
        schoolId: "school-scope",
        isSuperAdmin: false,
      },
      query: {
        companyId: "org-query",
        schoolId: "school-query",
      },
    },
    {}
  );

  assert.equal(filter.companyId, "org-scope");
  assert.deepEqual(filter.schoolId, { $in: ["school-scope", null] });
});

test("KPI en riesgo genera sugerencia", () => {
  const employee = buildEmployee(1, "RRHH");
  const suggestions = buildDevelopmentSuggestionsFromData({
    employees: [employee],
    kpis: [
      {
        _id: objectId(11),
        employeeId: employee._id,
        name: "Satisfaccion",
        targetValue: 100,
        currentValue: 45,
        unit: "%",
        period: "2026-Q2",
        departmentCode: "RRHH",
      },
    ],
    canCreatePlan: true,
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].sourceType, "kpi");
  assert.match(suggestions[0].suggestedAction, /seguimiento|plan/i);
});

test("OKR sin avance genera sugerencia", () => {
  const employee = buildEmployee(2, "OPS");
  const suggestions = buildDevelopmentSuggestionsFromData({
    employees: [employee],
    okrs: [
      {
        _id: objectId(22),
        employeeId: employee._id,
        objectiveTitle: "Mejorar proceso",
        keyResultTitle: "Reducir demora",
        targetValue: 10,
        currentValue: 0,
        period: "2026-Q2",
      },
    ],
    canCreatePlan: true,
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].sourceType, "okr");
  assert.match(suggestions[0].reason, /OKR/i);
});

test("plan vencido genera sugerencia", () => {
  const employee = buildEmployee(3, "TEC");
  const suggestions = buildDevelopmentSuggestionsFromData({
    employees: [employee],
    plans: [
      {
        _id: objectId(33),
        employeeId: employee._id,
        aspectoDesarrollar: "Seguimiento operativo",
        estado: "EN_CURSO",
        fechaSeguimiento: new Date("2026-01-15T00:00:00.000Z"),
      },
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].sourceType, "plan");
  assert.match(suggestions[0].suggestedAction, /Revisar plan vencido/i);
});

test("empleado sin plan y con KPI bajo sugiere crear plan", () => {
  const employee = buildEmployee(4, "ACA");
  const suggestions = buildDevelopmentSuggestionsFromData({
    employees: [employee],
    kpis: [
      {
        _id: objectId(44),
        employeeId: employee._id,
        name: "Participacion",
        targetValue: 100,
        currentValue: 30,
        period: "2026-Q2",
      },
    ],
    plans: [],
    canCreatePlan: true,
  });

  assert.equal(suggestions[0].canCreatePlan, true);
  assert.match(suggestions[0].suggestedAction, /Crear plan de desarrollo/i);
});

test("no hay sugerencias si no hay senales", () => {
  const employee = buildEmployee(5, "FIN");
  const suggestions = buildDevelopmentSuggestionsFromData({
    employees: [employee],
    kpis: [
      {
        _id: objectId(55),
        employeeId: employee._id,
        name: "Meta sana",
        targetValue: 100,
        currentValue: 90,
        period: "2026-Q2",
      },
    ],
    okrs: [
      {
        _id: objectId(56),
        employeeId: employee._id,
        objectiveTitle: "Ordenar backlog",
        keyResultTitle: "Cierre semanal",
        targetValue: 10,
        currentValue: 9,
      },
    ],
    evaluations: [
      {
        _id: objectId(57),
        employeeId: employee._id,
        tipo: "FINAL",
        estado: "CERRADA",
        resultadoFinal: 4.5,
      },
    ],
    plans: [
      {
        _id: objectId(58),
        employeeId: employee._id,
        estado: "CERRADO",
        fechaSeguimiento: new Date("2026-12-01T00:00:00.000Z"),
        aspectoDesarrollar: "OK",
      },
    ],
  });

  assert.equal(suggestions.length, 0);
});
