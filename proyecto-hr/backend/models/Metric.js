import mongoose from "mongoose";

const MetricSchema = new mongoose.Schema(
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
    competencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competency",
      required: true,
      index: true,
    },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    cargoAplica: [{ type: String, trim: true }],
    ponderacion: { type: Number, default: 1, min: 0 },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Metric", MetricSchema);
