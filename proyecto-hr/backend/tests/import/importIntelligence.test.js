import test from "node:test";
import assert from "node:assert/strict";
import {
  buildColumnDetections,
  classifyDatasetByDetections,
  mapRowsByDetections,
  sanitizeHeader,
  validateRowsForDataset,
} from "../../utils/importIntelligence.js";

test("detecta dataset employees con headers desordenados", () => {
  const headers = ["mail_docente", "apellidos", "nombre_completo", "puesto_actual", "campus"];
  const sanitized = headers.map((value) => sanitizeHeader(value));
  const rows = [
    {
      [sanitized[0]]: "ana@colegio.com",
      [sanitized[1]]: "Perez",
      [sanitized[2]]: "Ana",
      [sanitized[3]]: "Docente",
      [sanitized[4]]: "Norte",
      _rowNumber: 2,
    },
  ];
  const detections = buildColumnDetections(rows, sanitized, {});
  const dataset = classifyDatasetByDetections(detections, "auto");
  assert.equal(dataset, "employees");
  assert.ok((detections.email?.confidence || 0) >= 0.7);
});

test("marca filas invalidas y bloquea super admin", () => {
  const rows = [
    {
      apellido: "Gomez",
      nombre: "Pablo",
      email: "pablo@colegio.com",
      cargo: "Profesor",
      roleCode: "SUPER_ADMIN",
      _rowNumber: 2,
    },
    {
      apellido: "Diaz",
      nombre: "Sofi",
      email: "correo-invalido",
      cargo: "Docente",
      _rowNumber: 3,
    },
  ];
  const result = validateRowsForDataset(rows, "employees");
  assert.equal(result.validRows.length, 0);
  assert.equal(result.invalidRows.length, 2);
  assert.match(result.invalidRows[0].message, /SUPER_ADMIN/i);
  assert.match(result.invalidRows[1].message, /Email invalido/i);
});

test("detecta duplicados por email y legajo", () => {
  const rows = [
    { apellido: "Uno", nombre: "A", cargo: "Docente", email: "a@x.com", legajo: "10", _rowNumber: 2 },
    { apellido: "Dos", nombre: "B", cargo: "Docente", email: "a@x.com", legajo: "10", _rowNumber: 3 },
  ];
  const result = validateRowsForDataset(rows, "employees");
  assert.equal(result.validRows.length, 2);
  assert.ok(result.duplicates.length >= 2);
});

test("mapea columnas manuales para empleados", () => {
  const rows = [
    {
      docenteapellido: "Suarez",
      docentenombre: "Luz",
      correodocente: "luz@colegio.com",
      puestodocente: "Jefe",
      _rowNumber: 2,
    },
  ];
  const headers = ["docenteapellido", "docentenombre", "correodocente", "puestodocente"];
  const detections = buildColumnDetections(rows, headers, {
    apellido: "docenteapellido",
    nombre: "docentenombre",
    email: "correodocente",
    cargo: "puestodocente",
  });
  const mapped = mapRowsByDetections(rows, detections, "employees");
  assert.equal(mapped[0].apellido, "Suarez");
  assert.equal(mapped[0].cargo, "Jefe");
});
