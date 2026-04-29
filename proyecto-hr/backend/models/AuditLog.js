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

export default mongoose.model("AuditLog", AuditLogSchema);
