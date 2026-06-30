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
} from "../services/excelSyncService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

// ─── GET /api/excel-sync/connection ─────────────────────────────────────────
// Get active connection for this company
router.get("/connection", canManage, async (req, res) => {
  const companyId = req.scope.companyId;
  const connection = await ExcelSyncConnection.findOne({ companyId, status: { $ne: "disconnected" } })
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

  const connection = await ExcelSyncConnection.findOne({ _id: req.params.id, companyId });
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
    const connection = await ExcelSyncConnection.findOne({ _id: req.params.id, companyId });
    if (!connection) return res.status(404).json({ error: "Conexión no encontrada." });

    if (connection.source === "manual") {
      if (!req.file) return res.status(400).json({ error: "Se necesita el archivo para sincronizar manualmente." });
      const result = await syncFromBuffer(req.params.id, req.file.buffer, companyId);
      return res.json(result);
    }

    // For OneDrive / Google Sheets: fetch from source
    // (Phase 2 - placeholder for now)
    res.status(501).json({ error: "Sincronización automática desde la nube en desarrollo." });
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

export default router;
