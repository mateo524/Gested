import mongoose from "mongoose";

const ImportIssueSchema = new mongoose.Schema(
  {
    rowNumber: { type: String, default: "" },
    message: { type: String, required: true },
    severity: { type: String, enum: ["error", "warning"], default: "error" },
    source: { type: String, enum: ["rule", "ai", "manual"], default: "rule" },
    normalized: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const ImportAuditEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const ImportJobSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceFileName: { type: String, required: true },
    sourceMimeType: { type: String, default: "" },
    sourceStorageProvider: { type: String, default: "local" },
    sourceStorageKey: { type: String, default: "" },
    sourcePublicUrl: { type: String, default: "" },
    previewToken: { type: String, default: "", index: true },
    stage: {
      type: String,
      enum: ["uploaded", "validated", "confirmed", "failed", "expired"],
      default: "uploaded",
      index: true,
    },
    datasetRequested: { type: String, default: "auto" },
    datasetDetected: { type: String, default: "unknown" },
    parserType: { type: String, enum: ["rules", "ai", "hybrid"], default: "rules" },
    inferenceUsed: { type: Boolean, default: false },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    previewSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    issues: { type: [ImportIssueSchema], default: [] },
    aiSuggestions: { type: [String], default: [] },
    aiRawSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    auditTrail: { type: [ImportAuditEventSchema], default: [] },
    expiresAt: { type: Date, default: null, index: true },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ImportJobSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.model("ImportJob", ImportJobSchema);
