import mongoose from "mongoose";

const webhookConfigSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  url: { type: String, required: true },
  events: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  secret: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const WebhookConfig =
  mongoose.models.WebhookConfig ||
  mongoose.model("WebhookConfig", webhookConfigSchema);

export default WebhookConfig;
