import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  BULK_IMPORT_CATALOGS,
  BULK_IMPORT_TEMPLATE_FILENAME,
  buildBulkImportTemplateBuffer,
} from "../../utils/bulkImportTemplate.js";

test("la plantilla oficial incluye todas las solapas requeridas", async () => {
  const buffer = await buildBulkImportTemplateBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.equal(BULK_IMPORT_TEMPLATE_FILENAME, "Plantilla_ZENTOR_Importacion.xlsx");
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "Instrucciones",
    "Organización",
    "Departamentos",
    "Empleados",
    "Usuarios_y_Roles",
    "Managers",
    "KPIs",
    "OKRs",
    "Evaluaciones",
    "Mediciones_Desempeno",
    "Planes_Desarrollo",
    "Catálogos",
  ]);
});

test("la hoja Catálogos expone valores permitidos y excluye SUPER_ADMIN/PLATFORM", async () => {
  const buffer = await buildBulkImportTemplateBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet("Catálogos");
  const values = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    values.push(String(row.getCell(2).value || ""));
  });

  BULK_IMPORT_CATALOGS.roleKey.forEach((roleKey) => {
    assert.ok(values.includes(roleKey));
  });
  BULK_IMPORT_CATALOGS.scope.forEach((scope) => {
    assert.ok(values.includes(scope));
  });
  assert.equal(values.includes("SUPER_ADMIN"), false);
  assert.equal(values.includes("PLATFORM"), false);
});
