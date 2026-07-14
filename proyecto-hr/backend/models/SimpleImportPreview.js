import mongoose from "mongoose";

const SimpleImportPreviewSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },
  rows: { type: mongoose.Schema.Types.Mixed, default: [] },
  expiresAt: { type: Date, required: true },
});

// TTL index: Mongo garbage-collects expired previews on its own.
SimpleImportPreviewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SimpleImportPreview", SimpleImportPreviewSchema);
