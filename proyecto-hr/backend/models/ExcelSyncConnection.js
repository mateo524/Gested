import mongoose from "mongoose";

const ColumnMappingItemSchema = new mongoose.Schema({
  excelColumn: { type: String, required: true },
  zentorField: { type: String, default: null }, // null = ignored
  status: { type: String, enum: ["mapped", "ignored", "pending"], default: "pending" },
}, { _id: false });

const SyncStatsSchema = new mongoose.Schema({
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  errors:  { type: Number, default: 0 },
}, { _id: false });

const ExcelSyncConnectionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },

  connectionName: { type: String, trim: true, default: null }, // user-given label

  source: {
    type: String,
    enum: ["manual", "onedrive", "google_sheets"],
    required: true,
  },

  status: {
    type: String,
    enum: ["active", "pending_mapping", "error", "disconnected"],
    default: "pending_mapping",
  },

  // --- OneDrive ---
  msAccessToken:    { type: String, default: null, select: false },
  msRefreshToken:   { type: String, default: null, select: false },
  msTokenExpiresAt: { type: Date,   default: null },
  oneDriveFileId:   { type: String, default: null },
  oneDriveFileName: { type: String, default: null },
  oneDriveWebUrl:   { type: String, default: null },

  // --- Google Sheets ---
  googleAccessToken:    { type: String, default: null, select: false },
  googleRefreshToken:   { type: String, default: null, select: false },
  googleTokenExpiresAt: { type: Date,   default: null },
  googleSpreadsheetId:  { type: String, default: null },
  googleSheetName:      { type: String, default: null },
  googleSpreadsheetName:{ type: String, default: null },
  googleFileIsNative:   { type: Boolean, default: true },

  // --- Column mapping ---
  sheetName:        { type: String, default: null }, // which tab to read
  columnMapping:    { type: [ColumnMappingItemSchema], default: [] },
  detectedColumns:  { type: [String], default: [] },
  pendingColumns:   { type: [String], default: [] },   // new, not yet mapped
  removedColumns:   { type: [String], default: [] },   // disappeared from Excel

  // --- Sync tracking ---
  lastSyncAt:     { type: Date, default: null },
  lastSyncStatus: { type: String, enum: ["success", "partial", "error", null], default: null },
  lastSyncError:  { type: String, default: null },
  lastSyncStats:  { type: SyncStatsSchema, default: null },

  pollIntervalMinutes: { type: Number, default: 60 },
}, { timestamps: true });

ExcelSyncConnectionSchema.index({ companyId: 1, source: 1 });

export default mongoose.model("ExcelSyncConnection", ExcelSyncConnectionSchema);
