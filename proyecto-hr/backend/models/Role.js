import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    default: null,
    index: true,
  },
  code: {
    type: String,
    enum: ["SUPER_ADMIN", "ADMIN_COLEGIO", "RRHH", "JEFE", "EMPLEADO", "LECTOR"],
    default: null,
  },
  nombre: { type: String, required: true },
  descripcion: { type: String, default: "" },
  permisos: {
    type: [String],
    default: [],
  },
  scope: {
    type: String,
    enum: ["global", "company", "school", "team", "self", "read_only"],
    default: "company",
  },
  activo: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false },
});

RoleSchema.index({ companyId: 1, code: 1 }, { unique: true, sparse: true });

export default mongoose.model("Role", RoleSchema);
