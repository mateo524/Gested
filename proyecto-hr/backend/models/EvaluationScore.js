import mongoose from "mongoose";

const EvaluationScoreSchema = new mongoose.Schema(
  {
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evaluation",
      required: true,
    },
    metricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Metric",
      required: true,
    },
    nivel: { type: Number, enum: [0, 1, 2, 3, 4, 5], default: 0 },
    comentario: { type: String, trim: true },
    evidenciaUrls: [{ type: String }],
  },
  { timestamps: true }
);

EvaluationScoreSchema.index({ evaluationId: 1, metricId: 1 }, { unique: true });

export default mongoose.model("EvaluationScore", EvaluationScoreSchema);
