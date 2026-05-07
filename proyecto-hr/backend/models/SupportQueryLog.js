import mongoose from "mongoose";

const SupportQueryLogSchema = new mongoose.Schema(
  {
    channel: { type: String, default: "web" },
    context: { type: String, default: "public-web" },
    question: { type: String, required: true },
    answer: { type: String, default: "" },
    intent: { type: String, default: "unknown", index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

SupportQueryLogSchema.index({ createdAt: -1 });

export default mongoose.model("SupportQueryLog", SupportQueryLogSchema);
