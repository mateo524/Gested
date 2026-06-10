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
};

// Sheet tab colors
const TAB_COLORS = {
  Empleados: { red: 0.18, green: 0.72, blue: 0.66 },   // teal
  Habilidades: { red: 0.26, green: 0.52, blue: 0.96 },  // blue
  Ciclos: { red: 0.95, green: 0.61, blue: 0.07 },       // amber
  Evaluaciones: { red: 0.6, green: 0.24, blue: 0.8 },   // violet
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
}) {
  const auth = getAuth();
  const sheetsApi = google.sheets({ version: "v4", auth });
  const driveApi = google.drive({ version: "v3", auth });

  const spreadsheetId = await getOrCreateSpreadsheet(sheetsApi, driveApi, companyName, existingSpreadsheetId);
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const competencyMap = new Map(competencies.map(c => [String(c._id), c]));

  await writeSheet(sheetsApi, spreadsheetId, "Empleados", SHEETS.Empleados, rowsForEmployees(employees));
  await writeSheet(sheetsApi, spreadsheetId, "Habilidades", SHEETS.Habilidades, rowsForMetrics(metrics, competencyMap));
  await writeSheet(sheetsApi, spreadsheetId, "Ciclos", SHEETS.Ciclos, rowsForCycles(cycles));
  await writeSheet(sheetsApi, spreadsheetId, "Evaluaciones", SHEETS.Evaluaciones, rowsForEvaluations(evaluations));

  return { spreadsheetId, spreadsheetUrl: url };
}

export function isGoogleSheetsEnabled() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}
