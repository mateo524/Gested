import ExcelJS from "exceljs";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import ExcelSyncConnection from "../models/ExcelSyncConnection.js";

// ─── Zentor canonical fields ───────────────────────────────────────────────
export const ZENTOR_FIELDS = {
  legajo:       { label: "Legajo / N° de empleado", required: false },
  nombre:       { label: "Nombre",                  required: true  },
  apellido:     { label: "Apellido",                required: true  },
  email:        { label: "Email laboral",           required: true  },
  cargo:        { label: "Cargo / Puesto",          required: false },
  area:         { label: "Área / Departamento",     required: false },
  tipoEmpleado: { label: "Tipo de empleado",        required: false },
  fechaIngreso: { label: "Fecha de ingreso",        required: false },
  activo:       { label: "Activo (sí/no)",          required: false },
  manager:      { label: "Jefe directo (email o nombre)", required: false },
};

// ─── Known aliases per field (normalized: lowercase, no accents, no spaces) ─
const FIELD_ALIASES = {
  legajo:       ["legajo", "nro", "numero", "numeroempleado", "nroempleado", "id", "idempleado", "codigoempleado", "codigo"],
  nombre:       ["nombre", "nombreempleado", "nombredelempleado", "firstname", "name", "nombrepila", "nombres"],
  apellido:     ["apellido", "apellidos", "apellidoempleado", "lastname", "surname"],
  email:        ["email", "emaillaboral", "correo", "correoelectronico", "mail", "emailcorporativo", "correoempresa"],
  cargo:        ["cargo", "puesto", "posicion", "jobtitle", "title", "rol", "funcion", "position"],
  area:         ["area", "departamento", "sector", "division", "gerencia", "unidad", "department", "division"],
  tipoEmpleado: ["tipoempleado", "tipo", "categoria", "modalidad", "employeetype"],
  fechaIngreso: ["fechaingreso", "fechadeingreso", "ingreso", "hiredate", "startdate", "fechainicio", "fechaalta"],
  activo:       ["activo", "estado", "active", "status", "habilitado", "vigente"],
  manager:      ["manager", "jefe", "jefedirecto", "supervisor", "responsable", "reporta", "reportaa", "gerente", "lider"],
};

// ─── Normalize a string for comparison ────────────────────────────────────
function normalize(str) {
  return String(str ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/[^a-z0-9]/g, "");       // remove non-alphanumeric
}

// ─── Simple similarity score (0-1) ────────────────────────────────────────
function similarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // count matching chars in order
  let matches = 0, j = 0;
  for (let i = 0; i < longer.length && j < shorter.length; i++) {
    if (longer[i] === shorter[j]) { matches++; j++; }
  }
  return matches / longer.length;
}

// ─── Detect which Zentor field a column name most likely maps to ───────────
export function detectFieldForColumn(columnName) {
  const norm = normalize(columnName);
  let bestField = null;
  let bestScore = 0;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const score = similarity(norm, alias);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }
  }

  return bestScore >= 0.75 ? bestField : null;
}

// ─── Build initial mapping suggestions for detected columns ───────────────
export function buildAutoMapping(detectedColumns, savedMapping = []) {
  const savedMap = new Map(savedMapping.map(m => [m.excelColumn, m]));

  return detectedColumns.map(col => {
    if (savedMap.has(col)) return savedMap.get(col);
    const suggested = detectFieldForColumn(col);
    return {
      excelColumn: col,
      zentorField: suggested,
      status: suggested ? "mapped" : "pending",
    };
  });
}

// ─── Detect column changes vs saved mapping ───────────────────────────────
export function detectColumnChanges(currentColumns, savedMapping) {
  const savedCols = new Set(savedMapping.map(m => m.excelColumn));
  const currentSet = new Set(currentColumns);

  const pendingColumns = currentColumns.filter(c => !savedCols.has(c));
  const removedColumns = [...savedCols].filter(c => !currentSet.has(c));

  return { pendingColumns, removedColumns };
}

// ─── Read headers + rows from an Excel buffer ─────────────────────────────
export async function readExcelBuffer(buffer, sheetName = null) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  let sheet;
  if (sheetName) {
    sheet = wb.getWorksheet(sheetName);
    if (!sheet) throw new Error(`La hoja "${sheetName}" no existe en el archivo.`);
  } else {
    // pick first non-empty sheet
    sheet = wb.worksheets.find(ws => ws.rowCount > 0);
    if (!sheet) throw new Error("El archivo no tiene hojas con datos.");
  }

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const val = String(cell.value ?? "").trim();
    if (val) headers.push(val);
  });

  if (headers.length === 0) throw new Error("La primera fila no tiene encabezados.");

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      obj[h] = cell.value ?? null;
    });
    rows.push(obj);
  });

  return { headers, rows, sheetName: sheet.name };
}

// ─── Get available sheet names from Excel buffer ──────────────────────────
export async function getSheetNames(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets.map(ws => ws.name);
}

// ─── Normalize a row value ─────────────────────────────────────────────────
function cellToString(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val).trim() || null;
}

function parseBool(val) {
  if (typeof val === "boolean") return val;
  const s = String(val ?? "").toLowerCase().trim();
  return ["si", "sí", "yes", "true", "1", "activo", "active"].includes(s);
}

// ─── Map one Excel row to an Employee document ────────────────────────────
function rowToEmployeeData(row, mapping) {
  const get = (field) => {
    const mapItem = mapping.find(m => m.zentorField === field && m.status === "mapped");
    if (!mapItem) return null;
    return row[mapItem.excelColumn] ?? null;
  };

  const nombre   = cellToString(get("nombre"));
  const apellido = cellToString(get("apellido"));
  const email    = cellToString(get("email"))?.toLowerCase() ?? null;

  if (!nombre && !apellido && !email) return null; // empty row

  return {
    nombre:       nombre   ?? "Sin nombre",
    apellido:     apellido ?? "Sin apellido",
    email,
    legajo:       cellToString(get("legajo")),
    cargo:        cellToString(get("cargo")),
    area:         cellToString(get("area")),
    tipoEmpleado: cellToString(get("tipoEmpleado")) || "OTRO",
    fechaIngreso: get("fechaIngreso") ? new Date(get("fechaIngreso")) : null,
    activo:       get("activo") !== null ? parseBool(get("activo")) : true,
    _managerRef:  cellToString(get("manager")),
  };
}

// ─── Main sync function ───────────────────────────────────────────────────
export async function syncEmployeesFromRows(rows, mapping, companyId) {
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const managerRefs = []; // collect for second pass

  // First pass: upsert employees
  for (const row of rows) {
    let data;
    try {
      data = rowToEmployeeData(row, mapping);
      if (!data) { stats.skipped++; continue; }
    } catch {
      stats.errors++;
      continue;
    }

    try {
      const filter = data.email
        ? { companyId, email: data.email }
        : { companyId, nombre: data.nombre, apellido: data.apellido };

      const { _managerRef, ...employeeData } = data;

      const existing = await Employee.findOne(filter);
      if (existing) {
        await Employee.updateOne(filter, { $set: employeeData });
        stats.updated++;
      } else {
        await Employee.create({ ...employeeData, companyId });
        stats.created++;
      }

      if (_managerRef) managerRefs.push({ filter, _managerRef });
    } catch {
      stats.errors++;
    }
  }

  // Second pass: resolve manager references
  for (const { filter, _managerRef } of managerRefs) {
    try {
      const managerLookup = _managerRef.includes("@")
        ? { companyId, email: _managerRef.toLowerCase() }
        : { companyId, $or: [
            { nombre: _managerRef.split(" ")[0] },
            { apellido: _managerRef.split(" ").slice(-1)[0] },
          ]};

      const manager = await Employee.findOne(managerLookup).select("_id").lean();
      if (manager) {
        await Employee.updateOne(filter, { $set: { managerId: manager._id } });
      }
    } catch {
      // non-critical: skip
    }
  }

  return stats;
}

// ─── Full sync from buffer ─────────────────────────────────────────────────
export async function syncFromBuffer(connectionId, buffer, companyId) {
  const connection = await ExcelSyncConnection.findOne({ _id: connectionId, companyId })
    .select("+msAccessToken +msRefreshToken +googleAccessToken +googleRefreshToken");
  if (!connection) throw new Error("Conexión no encontrada.");

  const { headers, rows } = await readExcelBuffer(buffer, connection.sheetName);

  // Detect column changes
  const { pendingColumns, removedColumns } = detectColumnChanges(headers, connection.columnMapping);

  // Update pending/removed
  connection.detectedColumns = headers;
  connection.pendingColumns = pendingColumns;
  connection.removedColumns = removedColumns;

  if (pendingColumns.length > 0) {
    // Add pending entries to mapping for admin to review
    const newEntries = pendingColumns.map(col => ({
      excelColumn: col,
      zentorField: detectFieldForColumn(col),
      status: "pending",
    }));
    connection.columnMapping.push(...newEntries);
  }

  // Remove entries for deleted columns from mapping
  if (removedColumns.length > 0) {
    connection.columnMapping = connection.columnMapping.filter(
      m => !removedColumns.includes(m.excelColumn)
    );
  }

  const activeMappings = connection.columnMapping.filter(m => m.status === "mapped");

  let stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  let syncStatus = "success";
  let syncError = null;

  try {
    stats = await syncEmployeesFromRows(rows, activeMappings, companyId);
    if (pendingColumns.length > 0 || removedColumns.length > 0) {
      syncStatus = "partial";
    }
  } catch (err) {
    syncStatus = "error";
    syncError = err.message;
  }

  connection.lastSyncAt = new Date();
  connection.lastSyncStatus = syncStatus;
  connection.lastSyncError = syncError;
  connection.lastSyncStats = stats;
  connection.status = pendingColumns.length > 0 ? "pending_mapping" : "active";

  await connection.save();

  return {
    stats,
    syncStatus,
    pendingColumns,
    removedColumns,
    connection,
  };
}
