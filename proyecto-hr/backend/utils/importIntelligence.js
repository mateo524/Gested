import ExcelJS from "exceljs";

export const IMPORT_CONFIDENCE_THRESHOLD = 0.65;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeHeader(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getWorksheetRowValues(row) {
  return row.values
    .slice(1)
    .map((value) => (value && typeof value === "object" && "text" in value ? value.text : value));
}

function isTruthyText(value) {
  return String(value || "").trim() !== "";
}

function isDateLike(value) {
  const str = String(value || "").trim();
  if (!str) return false;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  const parsed = new Date(str);
  return !Number.isNaN(parsed.getTime());
}

function contentScoreForField(field, values) {
  const sample = values.filter(isTruthyText).slice(0, 40);
  if (!sample.length) return 0;

  if (field === "email") {
    const ok = sample.filter((v) => EMAIL_RE.test(String(v).trim())).length;
    return ok / sample.length;
  }

  if (field === "activo") {
    const ok = sample.filter((v) => ["true", "false", "si", "no", "1", "0"].includes(normalizeText(v))).length;
    return ok / sample.length;
  }

  if (field === "ponderacion") {
    const ok = sample.filter((v) => Number.isFinite(Number(v))).length;
    return ok / sample.length;
  }

  if (field === "fechainicio" || field === "fechafin") {
    const ok = sample.filter((v) => isDateLike(v)).length;
    return ok / sample.length;
  }

  if (field === "rol") {
    const known = ["super_admin", "admin_colegio", "rrhh", "jefe", "empleado", "lector", "auditor"];
    const ok = sample.filter((v) => known.some((k) => normalizeText(v).includes(k))).length;
    return ok / sample.length;
  }

  if (["nombre", "apellido", "cargo", "area", "sede", "jefe", "legajo", "employeeid", "periodo", "competencia", "metrica"].includes(field)) {
    const ok = sample.filter((v) => String(v).trim().length >= 2).length;
    return ok / sample.length;
  }

  return 0.25;
}

function scoreHeaderForField(header, field, aliases) {
  const clean = sanitizeHeader(header);
  if (!clean) return 0;
  if (aliases.includes(clean)) return 1;
  if (aliases.some((a) => clean.includes(a) || a.includes(clean))) return 0.78;
  return 0;
}

function scoreRowAsHeader(row, aliasPool) {
  const headers = row.map((value, index) => {
    const clean = sanitizeHeader(value);
    return clean || `col_${index + 1}`;
  });
  let aliasHits = 0;
  headers.forEach((header) => {
    if (aliasPool.has(header)) aliasHits += 1;
  });
  return aliasHits;
}

function scoreSheet(worksheet, aliasPool) {
  const maxHeaderScan = Math.min(30, worksheet.rowCount || 1);
  let bestScore = -1;
  let headerRowNumber = 1;
  for (let rowNumber = 1; rowNumber <= maxHeaderScan; rowNumber += 1) {
    const rowValues = getWorksheetRowValues(worksheet.getRow(rowNumber));
    const score = scoreRowAsHeader(rowValues, aliasPool);
    if (score > bestScore) {
      bestScore = score;
      headerRowNumber = rowNumber;
    }
  }
  return {
    worksheet,
    sheetName: worksheet.name,
    score: bestScore,
    headerRowNumber,
  };
}

function buildHeaders(rowValues) {
  return rowValues.map((value, index) => {
    const clean = sanitizeHeader(value);
    return clean || `col_${index + 1}`;
  });
}

export async function parseWorkbookRows(file) {
  const workbook = new ExcelJS.Workbook();
  const fileName = String(file.originalname || "").toLowerCase();
  if (fileName.endsWith(".csv")) await workbook.csv.readBuffer(file.buffer);
  else await workbook.xlsx.load(file.buffer);

  const sheets = workbook.worksheets || [];
  if (!sheets.length) {
    return {
      rows: [],
      truncated: false,
      sheetName: "",
      headerRowNumber: 1,
      headers: [],
      worksheetsMeta: [],
      droppedEmptyRows: 0,
    };
  }

  return { workbook, fileName };
}

export function detectBestSheet(workbook, fieldAliases) {
  const aliasPool = new Set(Object.values(fieldAliases).flat());
  const scored = workbook.worksheets.map((worksheet) => scoreSheet(worksheet, aliasPool));
  scored.sort((a, b) => b.score - a.score || b.worksheet.rowCount - a.worksheet.rowCount);
  return {
    best: scored[0],
    candidates: scored.map((item) => ({
      sheetName: item.sheetName,
      score: item.score,
      headerRowNumber: item.headerRowNumber,
      rowCount: item.worksheet.rowCount || 0,
    })),
  };
}

export function extractRowsFromSheet(worksheet, headerRowNumber, maxRows = 3000) {
  const headerValues = getWorksheetRowValues(worksheet.getRow(headerRowNumber));
  const headers = buildHeaders(headerValues);
  const rows = [];
  let truncated = false;
  let droppedEmptyRows = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    if (rows.length >= maxRows) {
      truncated = true;
      return;
    }
    const values = getWorksheetRowValues(row);
    const allEmpty = values.every((value) => !isTruthyText(value));
    if (allEmpty) {
      droppedEmptyRows += 1;
      return;
    }

    const item = { _rowNumber: rowNumber };
    headers.forEach((header, index) => {
      item[header] = values[index];
    });
    rows.push(item);
  });

  return { headers, rows, truncated, droppedEmptyRows };
}

export function buildColumnDetections(rows, headers, fieldAliases, manualMapping = {}, learnedMapping = {}) {
  const detections = {};
  const headerValuesMap = new Map();
  headers.forEach((header) => {
    headerValuesMap.set(
      header,
      rows.map((row) => row[header]).filter((v) => v !== undefined)
    );
  });

  Object.entries(fieldAliases).forEach(([field, aliases]) => {
    const learnedHeader = sanitizeHeader(learnedMapping[field] || "");
    const manualHeader = sanitizeHeader(manualMapping[field] || "");
    const forcedHeader = manualHeader || learnedHeader;
    if (forcedHeader && headers.includes(forcedHeader)) {
      detections[field] = {
        field,
        header: forcedHeader,
        confidence: manualHeader ? 1 : 0.9,
        source: manualHeader ? "manual" : "learned",
        reason: manualHeader ? "Mapeo manual" : "Mapeo aprendido",
      };
      return;
    }

    let best = { header: "", score: 0, headerScore: 0, contentScore: 0 };
    headers.forEach((header) => {
      const headerScore = scoreHeaderForField(header, field, aliases);
      const contentScore = contentScoreForField(field, headerValuesMap.get(header) || []);
      const score = (headerScore * 0.72) + (contentScore * 0.28);
      if (score > best.score) {
        best = { header, score, headerScore, contentScore };
      }
    });
    detections[field] = {
      field,
      header: best.header,
      confidence: Number(best.score.toFixed(2)),
      source: "auto",
      reason: `header=${best.headerScore.toFixed(2)} content=${best.contentScore.toFixed(2)}`,
    };
  });

  return detections;
}

export function classifyDatasetByDetections(detections, requestedDataset = "auto") {
  if (requestedDataset && requestedDataset !== "auto") {
    return { dataset: requestedDataset, scores: {} };
  }

  const scoreFor = (fields) => {
    const total = fields.reduce((acc, field) => acc + (detections[field]?.confidence || 0), 0);
    return Number((total / fields.length).toFixed(2));
  };

  const scores = {
    employees: scoreFor(["apellido", "nombre", "cargo"]),
    metrics: scoreFor(["competencia", "metrica"]),
    cycles: scoreFor(["periodo", "fechainicio", "fechafin"]),
    roles: scoreFor(["rol"]),
  };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 0.42) return { dataset: "unknown", scores };
  return { dataset: best[0], scores };
}

export function mapRowsByDetections(rows, detections, dataset) {
  const fieldsByDataset = {
    employees: ["apellido", "nombre", "email", "cargo", "area", "tipoempleado", "activo", "rol", "jefe", "sede", "employeeid", "legajo"],
    metrics: ["competencia", "metrica", "descripcion", "ponderacion"],
    cycles: ["periodo", "etapa", "estado", "fechainicio", "fechafin", "anio"],
    roles: ["rol"],
  };
  const fields = fieldsByDataset[dataset] || [];
  return rows.map((row) => {
    const mapped = { _rowNumber: row._rowNumber };
    fields.forEach((field) => {
      const header = detections[field]?.header;
      mapped[field] = header ? row[header] : "";
    });
    return mapped;
  });
}

function parseBooleanLoose(value) {
  const norm = normalizeText(value);
  if (["false", "0", "no", "n", "inactivo"].includes(norm)) return false;
  return true;
}

function normalizeRoleCode(rawRole) {
  const norm = sanitizeHeader(rawRole);
  if (!norm) return "";
  if (["superadmin", "super_admin", "superadministrator"].includes(norm)) return "SUPER_ADMIN";
  if (["admincolegio", "director", "admincolegioo"].includes(norm)) return "ADMIN_COLEGIO";
  if (["rrhh", "rh", "humanresources"].includes(norm)) return "RRHH";
  if (["jefe", "manager", "lider"].includes(norm)) return "JEFE";
  if (["empleado", "docente", "teacher", "colaborador"].includes(norm)) return "EMPLEADO";
  if (["lector", "auditor", "lectorauditor"].includes(norm)) return "LECTOR_AUDITOR";
  return "";
}

export function validateRowsForDataset(mappedRows, dataset, detections, _options = {}) {
  const validRows = [];
  const invalidRows = [];
  const warnings = [];
  const duplicates = [];
  const detectedRoles = new Set();
  const seenEmail = new Map();
  const seenLegajo = new Map();
  const confirmationsRequired = [];

  const addWarning = (row, message, normalized = null) => {
    warnings.push({ row, message, source: "rule", normalized });
  };

  mappedRows.forEach((row) => {
    if (dataset === "employees") {
      const normalized = {
        apellido: String(row.apellido || "").trim(),
        nombre: String(row.nombre || "").trim(),
        email: String(row.email || "").trim().toLowerCase(),
        cargo: String(row.cargo || "").trim(),
        area: String(row.area || "").trim(),
        tipoempleado: String(row.tipoempleado || "DOCENTE").trim().toUpperCase() || "DOCENTE",
        activo: parseBooleanLoose(row.activo),
        roleCode: normalizeRoleCode(row.rol || ""),
        managerRef: String(row.jefe || "").trim(),
        sede: String(row.sede || "").trim(),
        employeeId: String(row.employeeid || "").trim(),
        legajo: String(row.legajo || "").trim(),
      };

      const errors = [];
      if (!normalized.apellido) errors.push("Falta apellido");
      if (!normalized.nombre) errors.push("Falta nombre");
      if (!normalized.cargo) errors.push("Falta cargo");
      if (!normalized.email && !normalized.legajo && !normalized.employeeId) {
        errors.push("Falta identificador (email o legajo/employeeId)");
      }
      if (normalized.email && !EMAIL_RE.test(normalized.email)) {
        errors.push("Email inválido");
      }
      if (normalized.roleCode === "SUPER_ADMIN") {
        errors.push("No se permite crear SUPER_ADMIN por importación");
      }

      if (!errors.length) {
        if (normalized.email) {
          if (seenEmail.has(normalized.email)) {
            duplicates.push({
              row: row._rowNumber,
              type: "email",
              value: normalized.email,
              duplicateOf: seenEmail.get(normalized.email),
            });
            addWarning(row._rowNumber, `Email duplicado (${normalized.email})`, normalized);
          } else {
            seenEmail.set(normalized.email, row._rowNumber);
          }
        }
        const legajoKey = normalized.legajo || normalized.employeeId;
        if (legajoKey) {
          if (seenLegajo.has(legajoKey)) {
            duplicates.push({
              row: row._rowNumber,
              type: "legajo",
              value: legajoKey,
              duplicateOf: seenLegajo.get(legajoKey),
            });
            addWarning(row._rowNumber, `Legajo/employeeId duplicado (${legajoKey})`, normalized);
          } else {
            seenLegajo.set(legajoKey, row._rowNumber);
          }
        }
        if (normalized.roleCode) detectedRoles.add(normalized.roleCode);
        else if (String(row.rol || "").trim()) {
          addWarning(row._rowNumber, "Rol no reconocido; requiere confirmación manual", normalized);
          confirmationsRequired.push("roles");
        }
        if (String(row.jefe || "").trim() && (detections.jefe?.confidence || 0) < IMPORT_CONFIDENCE_THRESHOLD) {
          addWarning(row._rowNumber, "Jefe detectado con baja confianza; revisar antes de confirmar", normalized);
          confirmationsRequired.push("jefes");
        }
        if (String(row.sede || "").trim() && (detections.sede?.confidence || 0) < IMPORT_CONFIDENCE_THRESHOLD) {
          addWarning(row._rowNumber, "Sede detectada con baja confianza; revisar antes de confirmar", normalized);
          confirmationsRequired.push("sedes");
        }
        validRows.push(normalized);
      } else {
        invalidRows.push({
          row: row._rowNumber,
          message: errors.join(", "),
          normalized,
          source: "rule",
        });
      }
      return;
    }

    if (dataset === "metrics") {
      const normalized = {
        competencia: String(row.competencia || "").trim(),
        nombre: String(row.metrica || "").trim(),
        descripcion: String(row.descripcion || "").trim(),
        ponderacion: Number(row.ponderacion || 1),
      };
      const errors = [];
      if (!normalized.competencia) errors.push("Falta competencia");
      if (!normalized.nombre) errors.push("Falta métrica");
      if (!Number.isFinite(normalized.ponderacion) || normalized.ponderacion <= 0) errors.push("Ponderación inválida");
      if (errors.length) invalidRows.push({ row: row._rowNumber, message: errors.join(", "), normalized, source: "rule" });
      else validRows.push(normalized);
      return;
    }

    if (dataset === "cycles") {
      const normalized = {
        periodo: String(row.periodo || "").trim(),
        etapa: String(row.etapa || "INICIO").trim().toUpperCase(),
        estado: String(row.estado || "BORRADOR").trim().toUpperCase(),
        fechaInicio: new Date(row.fechainicio),
        fechaFin: new Date(row.fechafin),
        anio: Number(row.anio || new Date().getFullYear()),
      };
      const errors = [];
      if (!normalized.periodo) errors.push("Falta período");
      if (Number.isNaN(normalized.fechaInicio.getTime())) errors.push("Fecha inicio inválida");
      if (Number.isNaN(normalized.fechaFin.getTime())) errors.push("Fecha fin inválida");
      if (errors.length) invalidRows.push({ row: row._rowNumber, message: errors.join(", "), normalized, source: "rule" });
      else validRows.push(normalized);
      return;
    }

    if (dataset === "roles") {
      const raw = String(row.rol || "").trim();
      const roleCode = normalizeRoleCode(raw);
      const normalized = { nombre: raw, roleCode };
      if (!raw) {
        invalidRows.push({ row: row._rowNumber, message: "Falta nombre de rol", normalized, source: "rule" });
      } else if (roleCode === "SUPER_ADMIN") {
        invalidRows.push({ row: row._rowNumber, message: "No se permite SUPER_ADMIN por importación", normalized, source: "rule" });
      } else {
        validRows.push(normalized);
        if (roleCode) detectedRoles.add(roleCode);
      }
    }
  });

  const needsManualMapping = Object.values(detections).some(
    (item) => item.source === "auto" && item.confidence < IMPORT_CONFIDENCE_THRESHOLD
  );

  return {
    validRows,
    invalidRows,
    warnings,
    duplicates,
    detectedRoles: [...detectedRoles],
    needsManualMapping,
    confirmationsRequired: [...new Set(confirmationsRequired)],
  };
}
