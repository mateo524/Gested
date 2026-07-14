import mongoose from "mongoose";

const SimpleImportJobSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  status: { type: String, enum: ["processing", "done", "error"], default: "processing", index: true },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: "" },
  expiresAt: { type: Date, required: true },
});

// TTL index: Mongo garbage-collects finished/stale jobs on its own.
SimpleImportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SimpleImportJob", SimpleImportJobSchema);
