import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    accion: String,
    modulo: String,
    detalle: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
AuditLogSchema.index({ companyId: 1, modulo: 1, createdAt: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
