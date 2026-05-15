import test from "node:test";
import assert from "node:assert/strict";
import {
  buildColumnDetections,
  classifyDatasetByDetections,
  mapRowsByDetections,
  validateRowsForDataset,
} from "../../utils/importIntelligence.js";

const fieldAliases = {
  nombre: ["nombre", "name", "firstname", "first_name"],
  apellido: ["apellido", "lastname", "last_name", "surname"],
  email: ["email", "correo", "mail", "correoelectronico"],
  cargo: ["cargo", "puesto", "roletitle", "rolcargo"],
  area: ["area", "departamento", "sector"],
  tipoempleado: ["tipoempleado", "tipo", "perfil"],
  activo: ["activo", "active", "habilitado"],
  competencia: ["competencia", "competency"],
  metrica: ["metrica", "metrica", "nombre", "metric"],
  descripcion: ["descripcion", "description"],
  ponderacion: ["ponderacion", "weight", "peso"],
  periodo: ["periodo", "mes", "period"],
  fechainicio: ["fechainicio", "inicio", "startdate"],
  fechafin: ["fechafin", "fin", "enddate"],
  rol: ["rol", "role", "nombrerol"],
  jefe: ["jefe", "manager", "responsable", "supervisor", "lider"],
  sede: ["sede", "colegio", "escuela", "campus"],
  employeeid: ["employeeid", "idempleado", "idcolaborador"],
  legajo: ["legajo", "nrolegajo", "numerolegajo", "employeecode"],
};

test("detecta columnas en archivo desordenado y clasifica employees", () => {
  const headers = ["apellido_y_nombre", "mail_contacto", "puesto_actual", "sector_base", "cod_legajo"];
  const rows = [
    { _rowNumber: 7, apellido_y_nombre: "Pérez Ana", mail_contacto: "ana@colegio.edu", puesto_actual: "Docente", sector_base: "Primaria", cod_legajo: "A-1" },
    { _rowNumber: 8, apellido_y_nombre: "López Juan", mail_contacto: "juan@colegio.edu", puesto_actual: "Preceptor", sector_base: "Secundaria", cod_legajo: "A-2" },
  ];

  const detections = buildColumnDetections(rows, headers, fieldAliases);
  const classified = classifyDatasetByDetections(detections, "auto");
  assert.equal(classified.dataset, "employees");
  assert.ok((detections.email?.confidence || 0) > 0.6);
});

test("marca invalido SUPER_ADMIN y email malformado en employees", () => {
  const rows = [
    { _rowNumber: 2, apellido: "Perez", nombre: "Ana", email: "ana@", cargo: "Docente", area: "Primaria", tipoempleado: "DOCENTE", activo: true, rol: "SUPER_ADMIN", jefe: "", sede: "Sede A", employeeid: "", legajo: "A-11" },
  ];
  const detections = Object.fromEntries(Object.keys(fieldAliases).map((f) => [f, { header: f, confidence: 0.9, source: "manual" }]));
  const result = validateRowsForDataset(rows, "employees", detections);
  assert.equal(result.validRows.length, 0);
  assert.equal(result.invalidRows.length, 1);
  assert.match(result.invalidRows[0].message, /Email inválido|No se permite crear SUPER_ADMIN/i);
});

test("detecta duplicados de email y legajo", () => {
  const rows = [
    { _rowNumber: 2, apellido: "A", nombre: "A", email: "a@x.com", cargo: "Doc", area: "", tipoempleado: "DOCENTE", activo: true, rol: "EMPLEADO", jefe: "", sede: "", employeeid: "", legajo: "L1" },
    { _rowNumber: 3, apellido: "B", nombre: "B", email: "a@x.com", cargo: "Doc", area: "", tipoempleado: "DOCENTE", activo: true, rol: "EMPLEADO", jefe: "", sede: "", employeeid: "", legajo: "L1" },
  ];
  const detections = Object.fromEntries(Object.keys(fieldAliases).map((f) => [f, { header: f, confidence: 0.9, source: "manual" }]));
  const result = validateRowsForDataset(rows, "employees", detections);
  assert.equal(result.validRows.length, 2);
  assert.ok(result.duplicates.length >= 2);
});

test("mapRowsByDetections usa headers elegidos manualmente", () => {
  const rawRows = [
    { _rowNumber: 10, col_1: "Garcia", col_2: "Maria", col_3: "maria@x.com", col_4: "Docente", col_5: "Primaria" },
  ];
  const detections = {
    apellido: { header: "col_1", confidence: 1, source: "manual" },
    nombre: { header: "col_2", confidence: 1, source: "manual" },
    email: { header: "col_3", confidence: 1, source: "manual" },
    cargo: { header: "col_4", confidence: 1, source: "manual" },
    area: { header: "col_5", confidence: 1, source: "manual" },
  };
  const mapped = mapRowsByDetections(rawRows, detections, "employees");
  assert.equal(mapped[0].apellido, "Garcia");
  assert.equal(mapped[0].nombre, "Maria");
});

