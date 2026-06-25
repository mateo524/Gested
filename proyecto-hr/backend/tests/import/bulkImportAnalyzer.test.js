import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import Employee from "../../models/Employee.js";
import Role from "../../models/Role.js";
import School from "../../models/School.js";
import User from "../../models/User.js";
import { analyzeBulkImportWorkbook } from "../../services/bulkImportAnalyzer.js";
import {
  buildBulkImportAnalyzeErrorPayload,
  buildBulkImportAnalyzeResponsePayload,
} from "../../routes/bulkImport.routes.js";

async function buildWorkbookBuffer(mutator) {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.addRow(["Seccion", "Detalle"]);
  instructions.addRow(["Objetivo", "Test"]);

  const organization = workbook.addWorksheet("Organización");
  organization.addRow(["organization_code", "organization_name", "status"]);
  organization.addRow(["ORG1", "Demo", "active"]);

  const departments = workbook.addWorksheet("Departamentos");
  departments.addRow(["departamento", "department_name", "status"]);
  departments.addRow(["DEP-RRHH", "RRHH", "active"]);

  const employees = workbook.addWorksheet("Empleados");
  employees.addRow([
    "legajo",
    "first_name",
    "last_name",
    "work_email",
    "job_title",
    "departamento",
    "employment_status",
    "active",
  ]);
  employees.addRow(["EMP-1", "Ana", "Lopez", "ana@demo.local", "Analista", "DEP-RRHH", "active", "yes"]);

  const users = workbook.addWorksheet("Usuarios_y_Roles");
  users.addRow(["legajo", "work_email", "role_key", "scope", "status", "can_login"]);
  users.addRow(["EMP-1", "ana@demo.local", "HR", "ORGANIZATION", "active", "yes"]);

  const managers = workbook.addWorksheet("Managers");
  managers.addRow(["legajo", "email_jefe", "relationship_type", "primary_manager", "status"]);
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

test("analyze bulk import rechaza PLATFORM como roleKey", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      workbook.getWorksheet("Usuarios_y_Roles").getCell("C2").value = "PLATFORM";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(analysis.summary.errors > 0, true);
    assert.equal(
      analysis.errors.some((item) => item.field === "role_key" && item.message.includes("PLATFORM")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze bulk import rechaza roleKey invalido", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      workbook.getWorksheet("Usuarios_y_Roles").getCell("C2").value = "WHATEVER_ROLE";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.field === "role_key" && item.message.includes("no permitido")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze bulk import rechaza scope invalido", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      workbook.getWorksheet("Usuarios_y_Roles").getCell("D2").value = "GLOBAL_ROOT";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.field === "scope" && item.message.includes("no permitido")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze bulk import rechaza empleado sin email", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      workbook.getWorksheet("Empleados").getCell("D2").value = "";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.field === "work_email" && item.message.includes("obligatorio")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze bulk import detecta legajo duplicado", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      workbook.getWorksheet("Empleados").addRow([
        "EMP-1",
        "Beto",
        "Suarez",
        "beto@demo.local",
        "Analista",
        "DEP-RRHH",
        "active",
        "yes",
      ]);
    });

    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.field === "legajo" && item.message.includes("duplicado")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze bulk import detecta email_jefe inexistente", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      workbook.getWorksheet("Managers").getCell("B2").value = "manager.inexistente@demo.local";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.field === "email_jefe" && item.message.includes("no existe")),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze no inserta empleados ni usuarios", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];
  const originalEmployeeCreate = Employee.create;
  const originalUserCreate = User.create;
  let employeeCreateCalled = 0;
  let userCreateCalled = 0;
  Employee.create = async () => {
    employeeCreateCalled += 1;
    return [];
  };
  User.create = async () => {
    userCreateCalled += 1;
    return [];
  };

  try {
    const buffer = await buildWorkbookBuffer();
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(analysis.summary.errors, 0);
    assert.equal(employeeCreateCalled, 0);
    assert.equal(userCreateCalled, 0);
  } finally {
    Employee.create = originalEmployeeCreate;
    User.create = originalUserCreate;
    restores.forEach((restore) => restore());
  }
});

test("analyze ignora companyId y schoolId del Excel y los marca como warning", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      const employees = workbook.getWorksheet("Empleados");
      employees.getCell("I1").value = "companyId";
      employees.getCell("J1").value = "schoolId";
      employees.getCell("I2").value = "excel-company";
      employees.getCell("J2").value = "excel-school";
    });
    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "scope-company",
      schoolId: "scope-school",
    });

    assert.equal(
      analysis.warnings.some((item) => item.field.toLowerCase().includes("company") || item.field.toLowerCase().includes("school")),
      true
    );
    assert.equal(analysis.summary.errors, 0);
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze devuelve error controlado cuando el archivo xlsx esta dañado", async () => {
  await assert.rejects(
    () =>
      analyzeBulkImportWorkbook({
        buffer: Buffer.from("esto-no-es-un-xlsx-real"),
        companyId: "company1",
        schoolId: "school1",
      }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, "BULK_IMPORT_INVALID_FILE");
      assert.match(error.message, /No pudimos leer el archivo/i);
      return true;
    }
  );
});

test("analyze no explota con hoja Habilidades vacia", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      const hab = workbook.addWorksheet("Habilidades");
      hab.addRow(["nombre_habilidad", "descripcion", "tipo", "nivel", "activa"]);
      // no data rows
    });

    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(analysis.summary.errors, 0);
    assert.equal(Array.isArray(analysis.errors), true);
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze detecta nombre_habilidad obligatorio", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      const hab = workbook.addWorksheet("Habilidades");
      hab.addRow(["nombre_habilidad", "descripcion", "tipo", "nivel", "activa"]);
      hab.addRow(["", "desc", "TRANSVERSAL", "BASICO", "yes"]);
    });

    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.sheet === "Habilidades" && item.field === "nombre_habilidad"),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze detecta tipo de habilidad invalido", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      const hab = workbook.addWorksheet("Habilidades");
      hab.addRow(["nombre_habilidad", "descripcion", "tipo", "nivel", "activa"]);
      hab.addRow(["Trabajo en equipo", "desc", "INVALIDO", "BASICO", "yes"]);
    });

    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(
      analysis.errors.some((item) => item.sheet === "Habilidades" && item.field === "tipo"),
      true
    );
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("analyze acepta habilidad valida sin errores", async () => {
  const restores = [
    patchCollection(Employee, []),
    patchCollection(User, []),
    patchCollection(Role, [{ _id: "r1", code: "RRHH", nombre: "RRHH" }]),
    patchCollection(School, [{ _id: "school1", nombre: "School 1" }]),
  ];

  try {
    const buffer = await buildWorkbookBuffer((workbook) => {
      const hab = workbook.addWorksheet("Habilidades");
      hab.addRow(["nombre_habilidad", "descripcion", "tipo", "nivel", "activa"]);
      hab.addRow(["Liderazgo", "Habilidad de liderazgo", "LIDERAZGO", "AVANZADO", "yes"]);
    });

    const analysis = await analyzeBulkImportWorkbook({
      buffer,
      companyId: "company1",
      schoolId: "school1",
    });

    assert.equal(analysis.summary.errors, 0);
    assert.equal(analysis.preview.habilidades.length, 1);
  } finally {
    restores.forEach((restore) => restore());
  }
});

test("route helper serializa errores inesperados del analyze sin exponer stack", () => {
  const { status, payload } = buildBulkImportAnalyzeErrorPayload(new Error("boom"));

  assert.equal(status, 500);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "BULK_IMPORT_ANALYZE_FAILED");
  assert.equal(payload.message, "No pudimos analizar el archivo.");
  assert.deepEqual(payload.errors, []);
  assert.deepEqual(payload.warnings, []);
});

test("route helper serializa 422 de validacion con message, code y errores", () => {
  const { status, payload } = buildBulkImportAnalyzeResponsePayload({
    analysis: {
      summary: { totalRows: 4, validRows: 2, warnings: 1, errors: 2, bySheet: {} },
      preview: { employees: [] },
      errors: [{ sheet: "Empleados", rowNumber: "2", field: "work_email", message: "work_email es obligatorio" }],
      warnings: [{ sheet: "KPIs", rowNumber: "3", field: "active", message: "active sera normalizado", severity: "warning" }],
    },
    job: { _id: "job-1" },
    previewToken: "preview-1",
  });

  assert.equal(status, 422);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "BULK_IMPORT_VALIDATION_ERRORS");
  assert.match(payload.message, /errores de validaci/i);
  assert.equal(payload.importJobId, "job-1");
  assert.equal(payload.previewToken, "preview-1");
  assert.equal(Array.isArray(payload.errors), true);
  assert.equal(Array.isArray(payload.warnings), true);
});
