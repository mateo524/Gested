import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    type: { type: String, enum: ["scale", "text"], required: true },
  },
  { _id: false }
);

const PulseCheckSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    questions: [QuestionSchema],
    active: { type: Boolean, default: true },
    closesAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PulseCheck", PulseCheckSchema);
