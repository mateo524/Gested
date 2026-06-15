import mongoose from "mongoose";

const EvaluationCycleSchema = new mongoose.Schema(
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
    anio: { type: Number, required: true },
    periodo: { type: String, required: true, trim: true },
    etapa: {
      type: String,
      enum: ["INICIO", "REVISION_INTERMEDIA", "EVALUACION_FINAL"],
      required: true,
    },
    estado: {
      type: String,
      enum: ["BORRADOR", "ABIERTO", "CERRADO"],
      default: "BORRADOR",
    },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
  },
  { timestamps: true }
);

EvaluationCycleSchema.index({ companyId: 1, schoolId: 1, anio: 1, periodo: 1, etapa: 1 }, { unique: true });

export default mongoose.model("EvaluationCycle", EvaluationCycleSchema);
