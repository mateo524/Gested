import mongoose from "mongoose";

const CompetencySchema = new mongoose.Schema(
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
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    tipo: {
      type: String,
      enum: ["TRANSVERSAL", "DOCENTE", "LIDERAZGO", "PERSONALIZADA"],
      required: true,
    },
    componente: {
      type: String,
      enum: ["C", "A", "H"],
      required: true,
    },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Competency", CompetencySchema);
