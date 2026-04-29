import mongoose from "mongoose";

const EvaluationScoreSchema = new mongoose.Schema(
  {
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evaluation",
      required: true,
      index: true,
    },
    metricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Metric",
      required: true,
      index: true,
    },
    nivel: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    comentario: { type: String, trim: true },
    evidenciaUrls: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("EvaluationScore", EvaluationScoreSchema);
