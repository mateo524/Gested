import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    accion: String,
    modulo: String,
    detalle: String,
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", AuditLogSchema);