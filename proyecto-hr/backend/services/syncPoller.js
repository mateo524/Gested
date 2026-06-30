import ExcelSyncConnection from "../models/ExcelSyncConnection.js";
import { syncFromBuffer } from "./excelSyncService.js";
import { refreshOneDriveToken, downloadOneDriveFile } from "./oneDriveService.js";
import { refreshGoogleToken, readGoogleSheet } from "./googleSheetsService.js";
import ExcelJS from "exceljs";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startSyncPoller() {
  console.log("Sync poller started");
  pollAllConnections();
  const intervalId = setInterval(pollAllConnections, POLL_INTERVAL_MS);
  return intervalId;
}

export function stopSyncPoller(intervalId) {
  clearInterval(intervalId);
}

async function pollAllConnections() {
  const connections = await ExcelSyncConnection.find({ status: "active" });
  const results = await Promise.allSettled(
    connections.map((connection) => pollConnection(connection))
  );
  console.log(`Polled ${connections.length} connections`);
  return results;
}

async function pollConnection(connection) {
  try {
    const source = connection.source;

    if (source === "onedrive") {
      const accessToken = await refreshOneDriveToken(connection);
      const buffer = await downloadOneDriveFile(accessToken, connection.oneDriveFileId);
      await syncFromBuffer(connection._id, buffer, connection.companyId);
    } else if (source === "google_sheets") {
      const accessToken = await refreshGoogleToken(connection);
      const rows = await readGoogleSheet(
        connection.googleSpreadsheetId,
        connection.googleSheetName,
        accessToken
      );
      const buffer = await convertRowsToXlsxBuffer(rows);
      await syncFromBuffer(connection._id, buffer, connection.companyId);
    } else if (source === "manual") {
      // Manual connections require user to re-upload; skip
      return;
    }
  } catch (err) {
    console.log(`Error polling connection ${connection._id}: ${err.message}`);
    connection.lastSyncStatus = "error";
    connection.lastSyncError = err.message;
    await connection.save();
  }
}

async function convertRowsToXlsxBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  if (rows && rows.length > 0) {
    const headerRow = rows[0];
    sheet.addRow(headerRow);

    for (let i = 1; i < rows.length; i++) {
      sheet.addRow(rows[i]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
