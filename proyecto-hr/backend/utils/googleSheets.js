/**
 * Google Sheets sync service.
 * One spreadsheet per Company (or School if multi-school).
 *
 * Requires env: GOOGLE_SERVICE_ACCOUNT_KEY (JSON string of the service account credentials)
 * The service account must have the Google Sheets API and Google Drive API enabled.
 */
import { google } from "googleapis";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var not set");
  const key = typeof raw === "string" ? JSON.parse(raw) : raw;
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

// Column headers for each sheet
const SHEETS = {
  Empleados: [
    "Apellido", "Nombre", "Email", "Cargo", "Área", "Activo",
  ],
  Habilidades: [
    "Habilidad", "Competencia", "Descripción", "Activa",
  ],
  Ciclos: [
    "Período", "Año", "Estado", "Fecha inicio", "Fecha fin",
  ],
  Evaluaciones: [
    "Empleado", "Ciclo", "Tipo", "Estado", "Resultado",
  ],
  "Planes de Desarrollo": [
    "Empleado", "Aspecto a desarrollar", "Fortalezas", "Medición", "Estado", "Progreso %", "Fecha seguimiento",
  ],
  KPIs: [
    "Empleado", "KPI", "Valor actual", "Valor objetivo", "% cumplimiento", "Estado", "Período",
  ],
  OKRs: [
    "Empleado", "Objetivo", "Resultado clave", "Progreso %", "Estado", "Ciclo",
  ],
  "Detalle evaluaciones": [
    "Empleado", "Ciclo", "Tipo eval.", "Competencia", "Métrica", "Nivel (0-5)", "Comentario",
  ],
};

// Sheet tab colors
const TAB_COLORS = {
  Empleados: { red: 0.18, green: 0.72, blue: 0.66 },          // teal
  Habilidades: { red: 0.26, green: 0.52, blue: 0.96 },         // blue
  Ciclos: { red: 0.95, green: 0.61, blue: 0.07 },              // amber
  Evaluaciones: { red: 0.6, green: 0.24, blue: 0.8 },          // violet
  "Planes de Desarrollo": { red: 0.13, green: 0.55, blue: 0.13 }, // green
  KPIs: { red: 0.95, green: 0.35, blue: 0.07 },                // orange
  OKRs: { red: 0.07, green: 0.35, blue: 0.95 },                // blue
  "Detalle evaluaciones": { red: 0.55, green: 0.13, blue: 0.55 }, // purple
};

function formatDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("es-AR"); } catch { return ""; }
}

function rowsForEmployees(employees = []) {
  return employees.map(e => [
    e.apellido || "",
    e.nombre || "",
    e.email || "",
    e.cargo || "",
    e.area || "",
    e.activo !== false ? "Sí" : "No",
  ]);
}

function rowsForMetrics(metrics = [], competencyMap = new Map()) {
  return metrics.map(m => [
    m.nombre || "",
    competencyMap.get(String(m.competencyId))?.nombre || "",
    m.descripcion || "",
    m.activa !== false ? "Sí" : "No",
  ]);
}

function rowsForCycles(cycles = []) {
  return cycles.map(c => [
    c.periodo || "",
    String(c.anio || ""),
    c.estado || "",
    formatDate(c.fechaInicio),
    formatDate(c.fechaFin),
  ]);
}

function rowsForEvaluations(evaluations = []) {
  return evaluations.map(e => {
    const empName = e.employeeId?.apellido
      ? `${e.employeeId.apellido}, ${e.employeeId.nombre}`
      : String(e.employeeId?._id || e.employeeId || "");
    const cycleName = e.cycleId?.periodo
      ? `${e.cycleId.periodo} ${e.cycleId.anio || ""}`.trim()
      : "";
    const TIPO_LABEL = { AUTOEVALUACION: "Autoevaluación", JEFATURA: "Jefatura", FINAL: "Cierre final" };
    return [
      empName,
      cycleName,
      TIPO_LABEL[e.tipo] || e.tipo || "",
      e.estado || "",
      e.resultadoFinal != null ? String(e.resultadoFinal) : "",
    ];
  });
}

function rowsForPlans(plans = [], employeeMap = new Map()) {
  return plans.map(p => {
    const emp = employeeMap.get(String(p.employeeId?._id || p.employeeId));
    const empName = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : String(p.employeeId || "");
    // fortalezas is stored as an array in the model
    const fortalezasStr = Array.isArray(p.fortalezas) ? p.fortalezas.join("; ") : (p.fortalezas || "");
    return [
      empName,
      p.aspectoDesarrollar || "",
      fortalezasStr,
      p.medicion || "",
      p.estado || "",
      p.progreso != null ? `${p.progreso}%` : "0%",
      p.fechaSeguimiento ? formatDate(p.fechaSeguimiento) : "",
    ];
  });
}

function rowsForKPIs(kpis = [], employeeMap = new Map()) {
  return kpis.map(k => {
    const emp = employeeMap.get(String(k.employeeId));
    const empName = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : String(k.employeeId || "");
    const current = k.currentValue != null ? k.currentValue : 0;
    const target = k.targetValue != null ? k.targetValue : 0;
    const pct = target > 0 ? Math.round((current / target) * 100) : 0;
    return [
      empName,
      k.name || k.nombre || k.title || "",
      k.currentValue != null ? String(k.currentValue) : "",
      k.targetValue != null ? String(k.targetValue) : "",
      `${pct}%`,
      k.status || k.estado || "",
      k.period || k.periodo || "",
    ];
  });
}

function rowsForOKRs(okrs = [], employeeMap = new Map()) {
  return okrs.map(o => {
    const emp = employeeMap.get(String(o.employeeId));
    const empName = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : String(o.employeeId || "");
    // OKRRecord stores objectiveTitle / keyResultTitle as the primary fields
    const current = o.currentValue != null ? o.currentValue : 0;
    const target = o.targetValue != null ? o.targetValue : 0;
    const pct = target > 0 ? Math.round((current / target) * 100) : (o.progreso != null ? o.progreso : 0);
    return [
      empName,
      o.objectiveTitle || o.objetivo || o.title || "",
      o.keyResultTitle || o.resultadoClave || o.keyResult || "",
      `${pct}%`,
      o.status || o.estado || "",
      o.period || o.quarter || o.ciclo || o.cycle || "",
    ];
  });
}

function rowsForScores(scores = [], employeeMap = new Map()) {
  return scores.map(s => {
    const evalObj = s._evalObj || {};
    const empId = String(evalObj.employeeId?._id || evalObj.employeeId || "");
    const emp = employeeMap.get(empId);
    const empName = emp ? `${emp.apellido || ""}, ${emp.nombre || ""}`.trim().replace(/^,\s*/, "") : empId;
    const cycleName = evalObj.cycleId?.periodo
      ? `${evalObj.cycleId.periodo} ${evalObj.cycleId.anio || ""}`.trim()
      : "";
    const TIPO_LABEL = { AUTOEVALUACION: "Autoevaluación", JEFATURA: "Jefatura", FINAL: "Cierre final" };
    return [
      empName,
      cycleName,
      TIPO_LABEL[evalObj.tipo] || evalObj.tipo || "",
      s.metricId?.competencyId?.nombre || "",
      s.metricId?.nombre || String(s.metricId || ""),
      s.nivel != null ? String(s.nivel) : "0",
      s.comentario || "",
    ];
  });
}

async function getOrCreateSpreadsheet(sheetsApi, driveApi, companyName, existingId = null) {
  if (existingId) {
    // Verify it still exists
    try {
      await sheetsApi.spreadsheets.get({ spreadsheetId: existingId, fields: "spreadsheetId" });
      return existingId;
    } catch { /* deleted externally — recreate */ }
  }

  const title = `ZENTOR — ${companyName}`;
  const res = await sheetsApi.spreadsheets.create({
    requestBody: {
      properties: { title, locale: "es_AR" },
      sheets: Object.keys(SHEETS).map((name, i) => ({
        properties: {
          title: name,
          index: i,
          tabColor: TAB_COLORS[name],
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    },
  });

  const spreadsheetId = res.data.spreadsheetId;

  // Make it accessible to anyone with the link (viewer)
  try {
    await driveApi.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch { /* non-fatal */ }

  return spreadsheetId;
}

async function writeSheet(sheetsApi, spreadsheetId, sheetName, headers, rows) {
  const values = [headers, ...rows];
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  // Bold + freeze header row, auto-resize columns
  const sheetId = await getSheetId(sheetsApi, spreadsheetId, sheetName);
  if (sheetId == null) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.1, green: 0.18, blue: 0.22 } } },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length },
          },
        },
      ],
    },
  });
}

async function getSheetId(sheetsApi, spreadsheetId, sheetName) {
  const res = await sheetsApi.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheet = res.data.sheets?.find(s => s.properties.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}

/**
 * Full sync of all data for a company.
 * @param {object} opts
 * @param {string} opts.companyName
 * @param {string|null} opts.existingSpreadsheetId
 * @param {Array} opts.employees
 * @param {Array} opts.competencies
 * @param {Array} opts.cycles
 * @param {Array} [opts.evaluations]
 * @returns {{ spreadsheetId: string, spreadsheetUrl: string }}
 */
export async function syncCompanySpreadsheet({
  companyName,
  existingSpreadsheetId = null,
  employees = [],
  competencies = [],
  metrics = [],
  cycles = [],
  evaluations = [],
  plans = [],
  kpis = [],
  okrs = [],
  scores = [],
}) {
  const auth = getAuth();
  const sheetsApi = google.sheets({ version: "v4", auth });
  const driveApi = google.drive({ version: "v3", auth });

  const spreadsheetId = await getOrCreateSpreadsheet(sheetsApi, driveApi, companyName, existingSpreadsheetId);
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const competencyMap = new Map(competencies.map(c => [String(c._id), c]));
  const employeeMap = new Map(employees.map(e => [String(e._id), e]));

  await writeSheet(sheetsApi, spreadsheetId, "Empleados", SHEETS.Empleados, rowsForEmployees(employees));
  await writeSheet(sheetsApi, spreadsheetId, "Habilidades", SHEETS.Habilidades, rowsForMetrics(metrics, competencyMap));
  await writeSheet(sheetsApi, spreadsheetId, "Ciclos", SHEETS.Ciclos, rowsForCycles(cycles));
  await writeSheet(sheetsApi, spreadsheetId, "Evaluaciones", SHEETS.Evaluaciones, rowsForEvaluations(evaluations));
  await writeSheet(sheetsApi, spreadsheetId, "Planes de Desarrollo", SHEETS["Planes de Desarrollo"], rowsForPlans(plans, employeeMap));
  await writeSheet(sheetsApi, spreadsheetId, "KPIs", SHEETS.KPIs, rowsForKPIs(kpis, employeeMap));
  await writeSheet(sheetsApi, spreadsheetId, "OKRs", SHEETS.OKRs, rowsForOKRs(okrs, employeeMap));
  await writeSheet(sheetsApi, spreadsheetId, "Detalle evaluaciones", SHEETS["Detalle evaluaciones"], rowsForScores(scores, employeeMap));

  return { spreadsheetId, spreadsheetUrl: url };
}

export function isGoogleSheetsEnabled() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}
