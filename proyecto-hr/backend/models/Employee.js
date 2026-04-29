import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    legajo: { type: String, trim: true },
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    cargo: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    tipoEmpleado: {
      type: String,
      enum: ["DOCENTE", "NO_DOCENTE", "DIRECTIVO", "RRHH", "OTRO"],
      default: "DOCENTE",
    },
    fechaIngreso: { type: Date, default: null },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeSchema.index({ companyId: 1, schoolId: 1, email: 1 });

export default mongoose.model("Employee", EmployeeSchema);
