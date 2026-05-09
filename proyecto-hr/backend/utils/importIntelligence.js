import ExcelJS from "exceljs";

export const IMPORT_CONFIDENCE_THRESHOLD = 0.7;
const MAX_PREVIEW_ROWS = 3000;

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeHeader(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const aliasMap = {
  apellido: ["apellido", "apellidos", "last_name", "lastname", "surname"],
  nombre: ["nombre", "nombres", "first_name", "firstname", "name", "apellidoynombre", "nombreyapellido"],
  email: ["email", "correo", "mail", "correoelectronico"],
  cargo: ["cargo", "puesto", "posicion", "rolcargo", "position"],
  area: ["area", "departamento", "sector"],
  role: ["rol", "role", "perfil"],
  managerRef: ["jefe", "supervisor", "manager", "responsable", "encargado"],
  sede: ["sede", "colegio", "school", "institucion", "campus"],
  legajo: ["legajo", "employeeid", "employee_id", "idempleado", "dni"],
  competencia: ["competencia", "competency"],
  metrica: ["metrica", "indicador", "metric", "kpi", "nombre"],
  ponderacion: ["ponderacion", "peso", "weight"],
  anio: ["anio", "ano", "year"],
  periodo: ["periodo", "mes", "quarter", "trimestre"],
  etapa: ["etapa", "fase", "stage"],
  fechainicio: ["fechainicio", "inicio", "startdate"],
  fechafin: ["fechafin", "fin", "enddate"],
};

const expectedByDataset = {
  employees: ["apellido", "nombre", "cargo", "email", "role", "managerRef", "sede", "legajo"],
  metrics: ["competencia", "metrica", "ponderacion"],
  cycles: ["anio", "periodo", "etapa", "fechainicio", "fechafin"],
  roles: ["role"],
};

function confidenceByHeader(sanitizedHeader, field) {
  const aliases = aliasMap[field] || [];
  if (field === "role" && /(observacion|observaciones|comentario|comentarios|nota|notas)/i.test(sanitizedHeader)) {
    return 0;
  }
  if (aliases.includes(sanitizedHeader)) return 0.95;
  if (aliases.some((alias) => sanitizedHeader.includes(alias) || alias.includes(sanitizedHeader))) return 0.8;
  return 0;
}

function confidenceByContent(samples, field) {
  const vals = samples.map((v) => String(v || "").trim()).filter(Boolean);
  if (!vals.length) return 0;
  const sample = vals.slice(0, 20);
  if (field === "email") {
    const hit = sample.filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).length;
    return hit / sample.length;
  }
  if (field === "ponderacion") {
    const hit = sample.filter((v) => !Number.isNaN(Number(v))).length;
    return hit / sample.length;
  }
  if (field === "fechainicio" || field === "fechafin") {
    const hit = sample.filter((v) => !Number.isNaN(new Date(v).getTime())).length;
    return hit / sample.length;
  }
  if (field === "role") {
    const roleWords = ["super_admin", "admin", "rrhh", "jefe", "empleado", "auditor", "lector", "director"];
    const hit = sample.filter((v) => {
      const value = normalizeText(v);
      // Evita tomar textos narrativos largos (ej: observaciones) como columna de rol.
      if (value.length > 32) return false;
      return roleWords.some((word) => value === word || value.startsWith(`${word} `) || value.endsWith(` ${word}`) || value.includes(word));
    }).length;
    return hit / sample.length;
  }
  return 0.2;
}

function scoreRows(rows, headers) {
  let nonEmptyRows = 0;
  let dataDensity = 0;
  for (const row of rows) {
    const rowValues = headers.map((header) => row[header]).filter((value) => String(value || "").trim() !== "");
    if (rowValues.length >= 2) {
      nonEmptyRows += 1;
      dataDensity += rowValues.length;
    }
  }
  return nonEmptyRows * 2 + dataDensity * 0.25;
}

function scoreHeaderRow(headers) {
  let aliasHits = 0;
  let genericCols = 0;
  let suspiciousLong = 0;
  const knownAliases = new Set(Object.values(aliasMap).flat().map((value) => sanitizeHeader(value)));

  headers.forEach((header) => {
    const sanitized = sanitizeHeader(header);
    if (!sanitized) return;
    if (/^col_\d+$/i.test(sanitized)) genericCols += 1;
    if (knownAliases.has(sanitized)) aliasHits += 1;
    if (sanitized.length > 30) suspiciousLong += 1;
  });

  // Priorizamos filas con encabezados tipo dataset y penalizamos narrativas/largas.
  return aliasHits * 6 - genericCols * 1.5 - suspiciousLong * 2;
}

export async function parseWorkbookRows(file) {
  const workbook = new ExcelJS.Workbook();
  const fileName = String(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();
  const buffer = Buffer.from(file.buffer || []);

  const loadAsDelimited = (text) => {
    const rows = parseCsvText(text);
    if (!rows.length) {
      throw new Error("DELIMITED vacio o invalido");
    }
    const sheet = workbook.addWorksheet("CSV");
    rows.forEach((row) => sheet.addRow(row));
  };

  const loadAsLooseText = () => {
    const utf8 = buffer.toString("utf8");
    const latin1 = buffer.toString("latin1");
    const text = looksMostlyPrintable(utf8) ? utf8 : latin1;
    const rows = parseLooseTextRows(text);
    if (!rows.length) {
      throw new Error("TEXT vacio o invalido");
    }
    const sheet = workbook.addWorksheet("TEXT");
    rows.forEach((row) => sheet.addRow(row));
  };

  const looksLikeCsv =
    fileName.endsWith(".csv") ||
    mimeType.includes("text/csv") ||
    mimeType.includes("application/csv");

  if (looksLikeCsv) {
    loadAsDelimited(buffer.toString("utf8"));
    return workbook;
  }

  try {
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (xlsxError) {
    // Fallback robusto para xlsx "raros" que Excel abre pero exceljs no parsea bien.
    try {
      const xlsx = await import("xlsx");
      const wb = xlsx.read(buffer, { type: "buffer", cellDates: false, raw: false });
      const excelFallback = new ExcelJS.Workbook();
      for (const name of wb.SheetNames || []) {
        const ws = wb.Sheets[name];
        const matrix = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const out = excelFallback.addWorksheet(name || "Sheet");
        matrix.forEach((row) => out.addRow(Array.isArray(row) ? row : [row]));
      }
      if (excelFallback.worksheets.length > 0) {
        return excelFallback;
      }
    } catch {
      // Sigue al fallback siguiente
    }

    const fallbackByMime = mimeType.includes("octet-stream") || mimeType.includes("text/plain");
    try {
      loadAsDelimited(buffer.toString("utf8"));
      return workbook;
    } catch {
      if (!fallbackByMime) {
        throw xlsxError;
      }
      try {
        loadAsLooseText();
        return workbook;
      } catch {
        throw xlsxError;
      }
    }
  }

  return workbook;
}

function parseCsvText(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");
  const delimiter = detectDelimiter(lines.slice(0, 20));
  return lines.map((line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map((cell) => String(cell || "").trim());
  });
}

function parseLooseTextRows(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const tabular = parseCsvText(lines.join("\n"));
  const maxCols = Math.max(0, ...tabular.map((row) => row.length));
  if (maxCols >= 2) return tabular;

  // Narrativo: una línea por fila para posterior extracción semántica.
  return lines.map((line) => [line]);
}

function detectDelimiter(lines) {
  const candidates = [",", ";", "\t", "|"];
  let best = { char: ",", score: -1 };
  for (const char of candidates) {
    let score = 0;
    for (const line of lines) {
      const count = String(line || "").split(char).length - 1;
      score += count;
    }
    if (score > best.score) best = { char, score };
  }
  return best.score > 0 ? best.char : ",";
}

function looksMostlyPrintable(text) {
  if (!text) return false;
  const sample = text.slice(0, 2000);
  let printable = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13 || code >= 160) {
      printable += 1;
    }
  }
  return printable / Math.max(1, sample.length) > 0.8;
}

export function extractRowsFromSheet(worksheet, headerRowNumber) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const headers = headerRow.values.slice(1).map((value, index) => sanitizeHeader(value) || `col_${index + 1}`);
  const rows = [];
  let truncated = false;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    if (rows.length >= MAX_PREVIEW_ROWS) {
      truncated = true;
      return;
    }
    const values = row.values.slice(1);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index];
    });
    const empty = Object.values(item).every((value) => String(value || "").trim() === "");
    if (!empty) rows.push({ ...item, _rowNumber: rowNumber });
  });
  return { headers, rows, truncated };
}

export function detectBestSheet(workbook) {
  const candidates = [];
  for (const worksheet of workbook.worksheets) {
    let best = { sheetName: worksheet.name, headerRowNumber: 1, score: -1, rows: [], headers: [] };
    for (let rowNumber = 1; rowNumber <= Math.min(25, worksheet.rowCount || 25); rowNumber += 1) {
      const { headers, rows } = extractRowsFromSheet(worksheet, rowNumber);
      const dataScore = scoreRows(rows.slice(0, 60), headers);
      const headerScore = scoreHeaderRow(headers);
      const score = dataScore + headerScore;
      if (score > best.score) best = { sheetName: worksheet.name, headerRowNumber: rowNumber, score, rows, headers };
    }
    candidates.push(best);
  }
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0] || { sheetName: "", headerRowNumber: 1, rows: [], headers: [], score: 0 };
  return { selected, candidates };
}

export function buildColumnDetections(rows, headers, manualMapping = {}) {
  const detections = {};
  const usedHeaders = new Set();

  const samplesByHeader = new Map();
  headers.forEach((header) => {
    samplesByHeader.set(
      header,
      rows
        .slice(0, 120)
        .map((row) => row[header])
        .filter((value) => String(value || "").trim() !== "")
    );
  });

  for (const [field, mappedHeader] of Object.entries(manualMapping || {})) {
    const sanitized = sanitizeHeader(mappedHeader);
    if (!sanitized || !headers.includes(sanitized)) continue;
    detections[field] = { header: sanitized, confidence: 1, source: "manual" };
    usedHeaders.add(sanitized);
  }

  const allFields = Object.keys(aliasMap);
  for (const field of allFields) {
    if (detections[field]) continue;
    let bestHeader = null;
    let bestScore = 0;
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      if (field === "role" && /(observacion|observaciones|comentario|comentarios|nota|notas)/i.test(header)) {
        continue;
      }
      const headerScore = confidenceByHeader(header, field);
      const contentScore = confidenceByContent(samplesByHeader.get(header) || [], field) * 0.65;
      const score = Math.max(headerScore, contentScore);
      if (score > bestScore) {
        bestHeader = header;
        bestScore = score;
      }
    }
    if (bestHeader && bestScore >= 0.35) {
      detections[field] = {
        header: bestHeader,
        confidence: Number(bestScore.toFixed(2)),
        source: bestScore >= 0.8 ? "alias" : "content",
      };
      usedHeaders.add(bestHeader);
    }
  }

  return detections;
}

export function classifyDatasetByDetections(detections, requestedDataset = "auto") {
  if (requestedDataset && requestedDataset !== "auto") return requestedDataset;
  let best = { dataset: "unknown", score: 0 };
  for (const [dataset, fields] of Object.entries(expectedByDataset)) {
    const scores = fields.map((field) => detections[field]?.confidence || 0);
    const score = scores.reduce((acc, item) => acc + item, 0) / fields.length;
    if (score > best.score) best = { dataset, score };
  }
  return best.score >= 0.5 ? best.dataset : "unknown";
}

function getMappedValue(row, detections, field) {
  const header = detections[field]?.header;
  return header ? row[header] : "";
}

export function mapRowsByDetections(rows, detections, dataset) {
  return rows.map((row) => {
    if (dataset === "employees") {
      const rawApellido = String(getMappedValue(row, detections, "apellido") || "").trim();
      const rawNombre = String(getMappedValue(row, detections, "nombre") || "").trim();
      const autoName = splitCombinedName(rawNombre || rawApellido);
      const apellido = rawApellido || autoName.apellido;
      const nombre = rawNombre || autoName.nombre;
      return {
        _rowNumber: row._rowNumber,
        apellido,
        nombre,
        email: String(getMappedValue(row, detections, "email") || "").trim().toLowerCase(),
        cargo: String(getMappedValue(row, detections, "cargo") || "").trim(),
        area: String(getMappedValue(row, detections, "area") || "").trim(),
        roleCode: String(getMappedValue(row, detections, "role") || "").trim(),
        managerRef: String(getMappedValue(row, detections, "managerRef") || "").trim(),
        sede: String(getMappedValue(row, detections, "sede") || "").trim(),
        legajo: String(getMappedValue(row, detections, "legajo") || "").trim(),
      };
    }
    if (dataset === "metrics") {
      return {
        _rowNumber: row._rowNumber,
        competencia: String(getMappedValue(row, detections, "competencia") || "").trim(),
        nombre: String(getMappedValue(row, detections, "metrica") || "").trim(),
        ponderacion: Number(getMappedValue(row, detections, "ponderacion") || 0) || 0,
        descripcion: String(getMappedValue(row, detections, "descripcion") || "").trim(),
      };
    }
    if (dataset === "cycles") {
      return {
        _rowNumber: row._rowNumber,
        anio: Number(getMappedValue(row, detections, "anio") || 0) || 0,
        periodo: String(getMappedValue(row, detections, "periodo") || "").trim(),
        etapa: String(getMappedValue(row, detections, "etapa") || "").trim(),
        fechaInicio: getMappedValue(row, detections, "fechainicio"),
        fechaFin: getMappedValue(row, detections, "fechafin"),
      };
    }
    if (dataset === "roles") {
      return {
        _rowNumber: row._rowNumber,
        nombre: String(getMappedValue(row, detections, "role") || "").trim(),
      };
    }
    return { ...row };
  });
}

function normalizeRoleCode(raw) {
  const value = normalizeText(raw).replace(/\s+/g, "_");
  if (!value) return "";
  // Frases narrativas tipo "no SUPER_ADMIN" no deben convertirse en rol.
  if (value.includes("no_super_admin") || value.includes("no_se_permite_super_admin")) return "";
  if (value.includes("super")) return "SUPER_ADMIN";
  if (value.includes("admin") && value.includes("coleg")) return "ADMIN_COLEGIO";
  if (value.includes("director")) return "DIRECTOR";
  if (value.includes("rrhh")) return "RRHH";
  if (value.includes("jefe")) return "JEFE";
  if (value.includes("auditor") || value.includes("lector")) return "AUDITOR";
  if (value.includes("empleado") || value.includes("docente")) return "EMPLEADO";
  return raw ? String(raw).trim().toUpperCase() : "";
}

function splitCombinedName(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return { nombre: "", apellido: "" };
  if (text.includes(",")) {
    const [apellidoRaw, nombreRaw] = text.split(",", 2);
    return {
      apellido: String(apellidoRaw || "").trim(),
      nombre: String(nombreRaw || "").trim(),
    };
  }
  const parts = text.split(" ").filter(Boolean);
  if (parts.length <= 1) return { nombre: text, apellido: "" };
  return {
    nombre: parts[0],
    apellido: parts.slice(1).join(" "),
  };
}

export function validateRowsForDataset(mappedRows, dataset, options = {}) {
  const validRows = [];
  const invalidRows = [];
  const warnings = [];
  const duplicates = [];
  const emailSeen = new Set();
  const legajoSeen = new Set();
  const highestAllowedRoleCode = String(options.highestAllowedRoleCode || "ADMIN_COLEGIO").toUpperCase();

  for (const row of mappedRows) {
    const errors = [];

    if (dataset === "employees") {
      if (!row.apellido) errors.push("Falta apellido");
      if (!row.nombre) errors.push("Falta nombre");
      if (!row.cargo) errors.push("Falta cargo");
      if (!row.email && !row.legajo) errors.push("Falta email o legajo");
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Email invalido");

      let roleCode = normalizeRoleCode(row.roleCode);
      if (roleCode === "SUPER_ADMIN") {
        row.roleCode = highestAllowedRoleCode;
        roleCode = highestAllowedRoleCode;
        warnings.push({
          row: row._rowNumber,
          field: "roleCode",
          message: `SUPER_ADMIN no permitido: se asigno ${highestAllowedRoleCode}`,
          value: row.roleCode,
        });
      }
      if (row.email && emailSeen.has(row.email)) duplicates.push(`Email duplicado: ${row.email}`);
      if (row.legajo && legajoSeen.has(row.legajo)) duplicates.push(`Legajo duplicado: ${row.legajo}`);
      if (row.email) emailSeen.add(row.email);
      if (row.legajo) legajoSeen.add(row.legajo);

      if (row.roleCode && !["ADMIN_COLEGIO", "DIRECTOR", "RRHH", "JEFE", "EMPLEADO", "AUDITOR"].includes(roleCode)) {
        warnings.push({ row: row._rowNumber, field: "roleCode", message: "Rol ambiguo, requiere confirmacion", value: row.roleCode });
      }
      if (row.managerRef) {
        warnings.push({ row: row._rowNumber, field: "managerRef", message: "Jefe requiere confirmacion de referencia", value: row.managerRef });
      }
      if (row.sede) {
        warnings.push({ row: row._rowNumber, field: "sede", message: "Sede requiere confirmacion con colegio activo", value: row.sede });
      }
    }

    if (dataset === "metrics") {
      if (!row.competencia) errors.push("Falta competencia");
      if (!row.nombre) errors.push("Falta metrica");
      if (!Number.isFinite(row.ponderacion) || row.ponderacion <= 0) errors.push("Ponderacion invalida");
    }

    if (dataset === "cycles") {
      if (!row.anio) errors.push("Falta anio");
      if (!row.periodo) errors.push("Falta periodo");
      if (!row.etapa) errors.push("Falta etapa");
    }

    if (dataset === "roles") {
      if (!row.nombre) errors.push("Falta nombre de rol");
      if (normalizeRoleCode(row.nombre) === "SUPER_ADMIN") errors.push("No se permite SUPER_ADMIN por importacion");
    }

    if (errors.length) invalidRows.push({ row: row._rowNumber, message: errors.join(", "), normalized: row });
    else validRows.push(row);
  }

  return { validRows, invalidRows, warnings, duplicates };
}
