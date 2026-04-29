import mongoose from "mongoose";

const MetricLevelSchema = new mongoose.Schema(
  {
    metricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Metric",
      required: true,
      index: true,
    },
    nivel: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    etiqueta: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
  },
  { timestamps: true }
);

MetricLevelSchema.index({ metricId: 1, nivel: 1 }, { unique: true });

export default mongoose.model("MetricLevel", MetricLevelSchema);
