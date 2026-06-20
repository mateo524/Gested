import mongoose from "mongoose";

const NpsResponseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, min: 0, max: 10, required: true },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("NpsResponse", NpsResponseSchema);
