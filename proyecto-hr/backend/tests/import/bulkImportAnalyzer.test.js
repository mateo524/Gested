import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import Employee from "../../models/Employee.js";
import Role from "../../models/Role.js";
import School from "../../models/School.js";
import User from "../../models/User.js";
import { analyzeBulkImportWorkbook } from "../../services/bulkImportAnalyzer.js";

async function buildWorkbookBuffer(mutator) {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.addRow(["Seccion", "Detalle"]);
  instructions.addRow(["Objetivo", "Test"]);

  const organization = workbook.addWorksheet("Organización");
  organization.addRow(["organization_code", "organization_name", "status"]);
  organization.addRow(["ORG1", "Demo", "active"]);

  const departments = workbook.addWorksheet("Departamentos");
  departments.addRow(["department_code", "department_name", "status"]);
  departments.addRow(["DEP-RRHH", "RRHH", "active"]);

  const employees = workbook.addWorksheet("Empleados");
  employees.addRow([
    "employee_code",
    "first_name",
    "last_name",
    "work_email",
    "job_title",
    "department_code",
    "employment_status",
    "active",
  ]);
  employees.addRow(["EMP-1", "Ana", "Lopez", "ana@demo.local", "Analista", "DEP-RRHH", "active", "yes"]);

  const users = workbook.addWorksheet("Usuarios_y_Roles");
  users.addRow(["employee_code", "work_email", "role_key", "scope", "status", "can_login"]);
  users.addRow(["EMP-1", "ana@demo.local", "HR", "ORGANIZATION", "active", "yes"]);

  const managers = workbook.addWorksheet("Managers");
  managers.addRow(["employee_code", "manager_email", "relationship_type", "primary_manager", "status"]);
  managers.addRow(["EMP-1", "ana@demo.local", "direct", "yes", "active"]);

  const kpis = workbook.addWorksheet("KPIs");
  kpis.addRow(["kpi_name", "employee_email", "target_value", "status", "active"]);
  kpis.addRow(["Rotacion", "ana@demo.local", 10, "active", "yes"]);

  const okrs = workbook.addWorksheet("OKRs");
  okrs.addRow(["objective_title", "key_result_title", "employee_email", "status"]);
  okrs.addRow(["Mejorar clima", "Subir NPS interno", "ana@demo.local", "active"]);

  const catalogs = workbook.addWorksheet("Catálogos");
  catalogs.addRow(["catalog", "value", "description"]);
  catalogs.addRow(["roleKey", "HR", "ok"]);
  catalogs.addRow(["scope", "ORGANIZATION", "ok"]);
  catalogs.addRow(["relationship_type", "direct", "ok"]);
  catalogs.addRow(["status", "active", "ok"]);
  catalogs.addRow(["yes/no", "yes", "ok"]);

  if (mutator) {
    await mutator(workbook);
  }

  return workbook.xlsx.writeBuffer();
}

function patchCollection(model, items) {
  const original = model.find;
  const originalFindOne = model.findOne;
  model.find = () => ({
    select: () => ({
      lean: async () => items,
      session() {
        return this;
      },
    }),
    lean: async () => items,
    session() {
      return this;
    },
  });
  model.findOne = () => ({
    select: () => ({
      lean: async () => items[0] || null,
    }),
    lean: async () => items[0] || null,
  });
  return () => {
    model.find = original;
    model.findOne = originalFindOne;
  };
}

test("analyze bulk import devuelve preview estructurado sin errores para plantilla valida", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer();
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(analysis.summary.errors, 0);
    assert.equal(analysis.preview.employees.length, 1);
    assert.equal(Array.isArray(analysis.preview.usersAndRoles), true);
    assert.equal(analysis.preview.usersAndRoles[0].role_key, "HR");
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze bulk import rechaza roleKey prohibido", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      const users = workbook.getWorksheet("Usuarios_y_Roles");
      users.getCell("C2").value = "SUPER_ADMIN";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(analysis.summary.errors > 0, true);
    assert.equal(
      analysis.errors.some((item) => item.field === "role_key" && item.message.includes("SUPER_ADMIN")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});
