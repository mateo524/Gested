import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, required: true },
    scaleValue: { type: Number, min: 1, max: 5, default: null },
    textValue: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const PulseResponseSchema = new mongoose.Schema(
  {
    pulseCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PulseCheck",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    answers: [AnswerSchema],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Enforce one response per user per pulse check
PulseResponseSchema.index({ pulseCheckId: 1, userId: 1 }, { unique: true });

export default mongoose.model("PulseResponse", PulseResponseSchema);
