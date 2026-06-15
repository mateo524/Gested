import mongoose from "mongoose";

const WebhookConfigSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    url: { type: String, required: true },
    events: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    secret: { type: String, required: true },
  },
  { timestamps: true }
);

const WebhookConfig =
  mongoose.models.WebhookConfig ||
  mongoose.model("WebhookConfig", WebhookConfigSchema);

export default WebhookConfig;
