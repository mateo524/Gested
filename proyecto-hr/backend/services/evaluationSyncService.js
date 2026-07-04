import ExcelSyncConnection from "../models/ExcelSyncConnection.js";
import Employee from "../models/Employee.js";
import { refreshOneDriveToken, downloadOneDriveFile } from "./oneDriveService.js";
import ExcelJS from "exceljs";

const SHEET_NAME = "Zentor_Evaluaciones";
const HEADERS = ["Empleado", "Apellido", "Cargo", "Tipo", "Ciclo", "Estado", "Puntaje", "Comentarios", "Fecha"];

/**
 * Writes a completed evaluation back to the company's connected Excel file.
 * Best-effort: if no active connection exists, or the source is manual, returns silently.
 *
 * @param {object} evaluation - Mongoose document with companyId, employeeId, tipo, estado, comentariosGenerales, puntajeFinal, acuerdoEmpleado
 * @param {string} cycleName - Human-readable cycle name to include in the row
 */
export async function writeEvaluationToExcel(evaluation, cycleName) {
  try {
    const connection = await ExcelSyncConnection.findOne({
      companyId: evaluation.companyId,
      active: true,
    });

    if (!connection || connection.source === "manual") {
      return;
    }

    const employee = await Employee.findById(evaluation.employeeId).lean();

    const evaluationRow = {
      empleado: employee?.nombre ?? "",
      apellido: employee?.apellido ?? "",
      cargo: employee?.cargo ?? "",
      tipo: evaluation.tipo ?? "",
      ciclo: cycleName ?? "",
      estado: evaluation.estado ?? "",
      puntaje: evaluation.puntajeFinal ?? "",
      comentarios: evaluation.comentariosGenerales ?? "",
      fecha: new Date().toISOString().split("T")[0],
    };

    await writeRowToExcel(connection, evaluationRow);
  } catch (err) {
    // Write-back is best-effort; never let sync errors surface to the evaluation flow
    console.error("[evaluationSyncService] writeEvaluationToExcel failed silently:", err?.message);
  }
}

/**
 * Appends a row to the connected Excel file.
 * Handles OneDrive (download → modify → re-upload). Google Sheets is not yet implemented.
 *
 * @param {object} connection - ExcelSyncConnection document (source, fileId, accessToken, refreshToken, etc.)
 * @param {object} row - { empleado, apellido, cargo, tipo, ciclo, estado, puntaje, comentarios, fecha }
 */
async function writeRowToExcel(connection, row) {
  try {
    if (connection.source === "google_sheets") {
      console.log("[evaluationSyncService] Google write-back not yet implemented");
      return;
    }

    if (connection.source !== "onedrive") {
      return;
    }

    // Ensure we have a fresh access token before downloading
    const freshToken = await refreshOneDriveToken(connection);
    const accessToken = freshToken ?? connection.accessToken;

    // Download the current workbook binary from OneDrive
    const fileBuffer = await downloadOneDriveFile(connection, accessToken);

    // Parse with ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    // Find or create the target sheet
    let sheet = workbook.getWorksheet(SHEET_NAME);
    const isNewSheet = !sheet;

    if (isNewSheet) {
      sheet = workbook.addWorksheet(SHEET_NAME);
      sheet.addRow(HEADERS);

      // Style the header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.commit();
    }

    // Append the data row in the same column order as HEADERS
    sheet.addRow([
      row.empleado,
      row.apellido,
      row.cargo,
      row.tipo,
      row.ciclo,
      row.estado,
      row.puntaje,
      row.comentarios,
      row.fecha,
    ]);

    // Serialize back to buffer
    const outputBuffer = await workbook.xlsx.writeBuffer();

    // PUT the updated workbook back to OneDrive
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${connection.fileId}/content`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: outputBuffer,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`OneDrive upload failed (${response.status}): ${detail}`);
    }
  } catch (err) {
    // Best-effort: log and swallow so evaluation flow is never interrupted
    console.error("[evaluationSyncService] writeRowToExcel failed silently:", err?.message);
  }
}

/**
 * Bulk-exports all CERRADA evaluations for a company to its connected Excel file.
 * Placeholder implementation — iterates and delegates to writeEvaluationToExcel.
 *
 * @param {string} companyId
 */
export async function syncAllEvaluationsToExcel(companyId) {
  try {
    // Lazy import to avoid circular dependencies at module load time
    const { default: Evaluation } = await import("../models/Evaluation.js");

    const closedEvaluations = await Evaluation.find({
      companyId,
      estado: "CERRADA",
    }).lean();

    if (!closedEvaluations.length) {
      return;
    }

    // Fetch each evaluation's cycle name if available; fall back to cycleId string
    for (const evaluation of closedEvaluations) {
      let cycleName = evaluation.cycleId?.toString() ?? "";

      try {
        const { default: EvaluationCycle } = await import("../models/EvaluationCycle.js");
        const cycle = await EvaluationCycle.findById(evaluation.cycleId).lean();
        if (cycle?.nombre) {
          cycleName = cycle.nombre;
        }
      } catch {
        // Cycle model may not exist yet; use raw id
      }

      await writeEvaluationToExcel(evaluation, cycleName);
    }
  } catch (err) {
    console.error("[evaluationSyncService] syncAllEvaluationsToExcel failed:", err?.message);
  }
}
