import express from "express";
import multer from "multer";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import ExcelSyncConnection from "../models/ExcelSyncConnection.js";
import {
  ZENTOR_FIELDS,
  readExcelBuffer,
  getSheetNames,
  buildAutoMapping,
  syncFromBuffer,
  syncEmployeesFromRows,
} from "../services/excelSyncService.js";
import {
  getOneDriveAuthUrl,
  exchangeOneDriveCode,
  refreshOneDriveToken,
  listOneDriveExcelFiles,
  downloadOneDriveFile,
} from "../services/oneDriveService.js";
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  listGoogleSheets,
  getGoogleSpreadsheetSheets,
  readGoogleSheet,
  downloadDriveFileAsBuffer,
} from "../services/googleSheetsService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── OAuth callbacks — NO auth middleware (redirect from Google/Microsoft) ───
router.get("/onedrive/callback", async (req, res) => {
  const { code, state } = req.query;
  try {
    const { msAccessToken, msRefreshToken, msTokenExpiresAt, companyId } =
      await exchangeOneDriveCode(code, state);
    await ExcelSyncConnection.findOneAndUpdate(
      { companyId, source: "onedrive" },
      { $set: { source: "onedrive", msAccessToken, msRefreshToken, msTokenExpiresAt, status: "pending_file" } },
      { upsert: true, new: true }
    );
    res.redirect(process.env.FRONTEND_URL + "/app?view=excel-sync&onedrive=connected");
  } catch (err) {
    res.redirect(process.env.FRONTEND_URL + "/app?view=excel-sync&onedrive=error");
  }
});

router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  try {
    const { googleAccessToken, googleRefreshToken, googleTokenExpiresAt, companyId } =
      await exchangeGoogleCode(code, state);
    // Always create a new connection — supports multiple Google Sheets per company
    const conn = await ExcelSyncConnection.create({
      companyId,
      source: "google_sheets",
      googleAccessToken,
      googleRefreshToken,
      googleTokenExpiresAt,
      status: "pending_file",
    });
    res.redirect(process.env.FRONTEND_URL + `/app?view=excel-sync&google=connected&connId=${conn._id}`);
  } catch (err) {
    res.redirect(process.env.FRONTEND_URL + "/app?view=excel-sync&google=error");
  }
});

// ─── All other routes require auth ──────────────────────────────────────────
router.use(auth, attachTenantScope);

const canManage = requireAnyPermission(
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_EMPLOYEES,
  PERMISSIONS.MANAGE_SCHOOL_USERS,
);

// ─── GET /api/excel-sync/fields ─────────────────────────────────────────────
// Returns the list of Zentor canonical fields (for mapping UI)
router.get("/fields", canManage, (req, res) => {
  res.json({
    fields: Object.entries(ZENTOR_FIELDS).map(([key, val]) => ({
      key,
      label: val.label,
      required: val.required,
    })),
  });
});

// ─── GET /api/excel-sync/connections ────────────────────────────────────────
// Get ALL active connections for this company
router.get("/connections", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const connections = await ExcelSyncConnection.find({ companyId, status: { $ne: "disconnected" } })
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ connections });
});

// ─── GET /api/excel-sync/connection ─────────────────────────────────────────
// Get single active connection (legacy / flow step use)
router.get("/connection", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const { id } = req.query; // optional: fetch specific connection by id
  const query = id
    ? { _id: id, companyId, status: { $ne: "disconnected" } }
    : { companyId, status: { $ne: "disconnected" } };
  const connection = await ExcelSyncConnection.findOne(query)
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ connection: connection ?? null });
});

// ─── POST /api/excel-sync/upload ────────────────────────────────────────────
// Manual upload: detect columns + suggest mapping
router.post("/upload", canManage, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo." });

  const companyId = req.scope.companyId;

  try {
    const sheets = await getSheetNames(req.file.buffer);
    const sheetName = req.body.sheetName || sheets[0];
    const { headers } = await readExcelBuffer(req.file.buffer, sheetName);

    // Load existing connection to preserve saved mappings
    const existing = await ExcelSyncConnection.findOne({ companyId, source: "manual" });
    const savedMapping = existing?.columnMapping ?? [];

    const suggestedMapping = buildAutoMapping(headers, savedMapping);

    // Upsert the connection record
    const connection = await ExcelSyncConnection.findOneAndUpdate(
      { companyId, source: "manual" },
      {
        $set: {
          status: "pending_mapping",
          sheetName,
          detectedColumns: headers,
          columnMapping: suggestedMapping,
          pendingColumns: [],
          removedColumns: [],
        },
      },
      { upsert: true, new: true }
    );

    // Store file buffer temporarily in connection (we'll re-read on confirm)
    // We don't persist the file — return analysis for the mapping step
    res.json({
      connectionId: connection._id,
      sheets,
      sheetName,
      detectedColumns: headers,
      suggestedMapping,
    });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// ─── POST /api/excel-sync/detect-sheets ─────────────────────────────────────
// Just detect sheet names from uploaded file (before full parse)
router.post("/detect-sheets", canManage, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo." });
  try {
    const sheets = await getSheetNames(req.file.buffer);
    res.json({ sheets });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// ─── PATCH /api/excel-sync/mapping/:id ──────────────────────────────────────
// Save column mapping for a connection
router.patch("/mapping/:id", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const { mapping } = req.body; // [{excelColumn, zentorField, status}]

  if (!Array.isArray(mapping)) {
    return res.status(400).json({ error: "Se esperaba un array de mapeos." });
  }

  const connection = await ExcelSyncConnection.findOne({ _id: req.params.id, companyId })
    .select("+msAccessToken +msRefreshToken +googleAccessToken +googleRefreshToken");
  if (!connection) return res.status(404).json({ error: "Conexión no encontrada." });

  connection.columnMapping = mapping;
  connection.pendingColumns = mapping.filter(m => m.status === "pending").map(m => m.excelColumn);

  const allResolved = mapping.every(m => m.status !== "pending");
  if (allResolved && connection.status === "pending_mapping") {
    connection.status = "active";
  }

  await connection.save();
  res.json({ connection });
});

// ─── POST /api/excel-sync/sync/:id ──────────────────────────────────────────
// Trigger a manual sync (re-upload file or re-read from source)
router.post("/sync/:id", canManage, upload.single("file"), async (req, res) => {
  const companyId = req.scope.companyId;

  try {
    const connection = await ExcelSyncConnection.findOne({ _id: req.params.id, companyId })
      .select("+msAccessToken +msRefreshToken +googleAccessToken +googleRefreshToken");
    if (!connection) return res.status(404).json({ error: "Conexión no encontrada." });

    if (connection.source === "manual") {
      if (!req.file) return res.status(400).json({ error: "Se necesita el archivo para sincronizar manualmente." });
      const result = await syncFromBuffer(req.params.id, req.file.buffer, companyId);
      return res.json(result);
    }

    if (connection.source === "google_sheets") {
      const { accessToken } = await refreshGoogleToken(connection);
      let rows, headers;

      if (connection.googleFileIsNative !== false) {
        // Native Google Sheet
        ({ headers, rows } = await readGoogleSheet(
          connection.googleSpreadsheetId,
          connection.sheetName,
          accessToken
        ));
      } else {
        // .xlsx stored in Drive
        const buffer = await downloadDriveFileAsBuffer(connection.googleSpreadsheetId, accessToken);
        ({ headers, rows } = await readExcelBuffer(buffer, connection.sheetName));
      }

      const activeMappings = connection.columnMapping.filter(m => m.status === "mapped");
      const stats = await syncEmployeesFromRows(rows, activeMappings, companyId);

      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = "success";
      connection.lastSyncError = null;
      connection.lastSyncStats = stats;
      connection.status = "active";
      await connection.save();

      return res.json({ stats, syncStatus: "success", connection });
    }

    if (connection.source === "onedrive") {
      const { accessToken } = await refreshOneDriveToken(connection);
      const buffer = await downloadOneDriveFile(accessToken, connection.oneDriveFileId);
      const result = await syncFromBuffer(req.params.id, buffer, companyId);
      return res.json(result);
    }

    res.status(400).json({ error: "Fuente de datos no reconocida." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/excel-sync/connection/:id ──────────────────────────────────
// Disconnect (soft delete)
router.delete("/connection/:id", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const connection = await ExcelSyncConnection.findOne({ _id: req.params.id, companyId });
  if (!connection) return res.status(404).json({ error: "Conexión no encontrada." });

  connection.status = "disconnected";
  connection.msAccessToken = null;
  connection.msRefreshToken = null;
  connection.googleAccessToken = null;
  connection.googleRefreshToken = null;
  await connection.save();

  res.json({ ok: true });
});

// ─── GET /api/excel-sync/onedrive/auth-url ──────────────────────────────────
router.get("/onedrive/auth-url", canManage, (req, res) => {
  const companyId = req.scope.companyId;
  res.json({ url: getOneDriveAuthUrl(companyId) });
});


// ─── GET /api/excel-sync/onedrive/files ─────────────────────────────────────
router.get("/onedrive/files", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  try {
    const connection = await ExcelSyncConnection.findOne({ companyId, source: "onedrive" }).select("+msAccessToken +msRefreshToken");
    if (!connection) return res.status(404).json({ error: "Conexión de OneDrive no encontrada." });

    const { accessToken } = await refreshOneDriveToken(connection);
    const files = await listOneDriveExcelFiles(accessToken);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/excel-sync/onedrive/select-file ──────────────────────────────
router.post("/onedrive/select-file", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const { fileId, fileName, webUrl, sheetName } = req.body;

  try {
    const connection = await ExcelSyncConnection.findOne({ companyId, source: "onedrive" }).select("+msAccessToken +msRefreshToken");
    if (!connection) return res.status(404).json({ error: "Conexión de OneDrive no encontrada." });

    const { accessToken } = await refreshOneDriveToken(connection);
    const buffer = await downloadOneDriveFile(accessToken, fileId);

    const sheets = await getSheetNames(buffer);
    const selectedSheet = sheetName || sheets[0];
    const { headers } = await readExcelBuffer(buffer, selectedSheet);
    const suggestedMapping = buildAutoMapping(headers, connection.columnMapping ?? []);

    const updated = await ExcelSyncConnection.findOneAndUpdate(
      { companyId, source: "onedrive" },
      {
        $set: {
          oneDriveFileId: fileId,
          oneDriveFileName: fileName,
          oneDriveWebUrl: webUrl,
          sheetName: selectedSheet,
          detectedColumns: headers,
          columnMapping: suggestedMapping,
          status: "pending_mapping",
        },
      },
      { new: true }
    );

    res.json({ connection: updated, suggestedMapping, detectedColumns: headers, sheets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/excel-sync/google/auth-url ────────────────────────────────────
router.get("/google/auth-url", canManage, (req, res) => {
  const companyId = req.scope.companyId;
  res.json({ url: getGoogleAuthUrl(companyId) });
});


// ─── GET /api/excel-sync/google/files ───────────────────────────────────────
router.get("/google/files", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const { connId } = req.query;
  try {
    const query = connId
      ? { _id: connId, companyId, source: "google_sheets" }
      : { companyId, source: "google_sheets", status: { $ne: "disconnected" } };
    const connection = await ExcelSyncConnection.findOne(query).sort({ updatedAt: -1 }).select("+googleAccessToken +googleRefreshToken");
    if (!connection) return res.status(404).json({ error: "Conexión de Google Sheets no encontrada." });

    const { accessToken } = await refreshGoogleToken(connection);
    const files = await listGoogleSheets(accessToken);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/excel-sync/google/select-file ────────────────────────────────
router.post("/google/select-file", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  // Accept both fileId (sent by frontend) and spreadsheetId (legacy)
  const fileId = req.body.fileId || req.body.spreadsheetId;
  const fileName = req.body.fileName || req.body.spreadsheetName;
  const mimeType = req.body.mimeType || "";
  const connId = req.body.connId;
  const { sheetName } = req.body;

  if (!fileId) return res.status(400).json({ error: "Se requiere fileId." });

  try {
    const query = connId
      ? { _id: connId, companyId, source: "google_sheets" }
      : { companyId, source: "google_sheets", status: { $ne: "disconnected" } };
    const connection = await ExcelSyncConnection.findOne(query).sort({ updatedAt: -1 }).select("+googleAccessToken +googleRefreshToken");
    if (!connection) return res.status(404).json({ error: "Conexión de Google Sheets no encontrada." });

    const { accessToken } = await refreshGoogleToken(connection);

    const isNativeSheet = mimeType === "application/vnd.google-apps.spreadsheet";
    let headers, sheets, selectedSheet;

    if (isNativeSheet) {
      sheets = await getGoogleSpreadsheetSheets(fileId, accessToken);
      selectedSheet = sheetName || sheets[0];
      ({ headers } = await readGoogleSheet(fileId, selectedSheet, accessToken));
    } else {
      // .xlsx stored in Drive — download and parse as Excel buffer
      const buffer = await downloadDriveFileAsBuffer(fileId, accessToken);
      sheets = await getSheetNames(buffer);
      selectedSheet = sheetName || sheets[0];
      ({ headers } = await readExcelBuffer(buffer, selectedSheet));
    }

    const suggestedMapping = buildAutoMapping(headers, connection.columnMapping ?? []);

    const updated = await ExcelSyncConnection.findOneAndUpdate(
      { companyId, source: "google_sheets" },
      {
        $set: {
          googleSpreadsheetId: fileId,
          googleSpreadsheetName: fileName,
          googleFileIsNative: isNativeSheet,
          sheetName: selectedSheet,
          detectedColumns: headers,
          columnMapping: suggestedMapping,
          status: "pending_mapping",
        },
      },
      { new: true }
    );

    res.json({ connection: updated, suggestedMapping, detectedColumns: headers, sheets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
