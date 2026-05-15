import mongoose from "mongoose";

const ContactRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180, index: true },
    institution: { type: String, trim: true, maxlength: 180, default: "" },
    role: { type: String, trim: true, maxlength: 120, default: "" },
    size: { type: String, trim: true, maxlength: 80, default: "" },
    message: { type: String, trim: true, maxlength: 2000, default: "" },
    source: { type: String, trim: true, lowercase: true, maxlength: 80, default: "landing", index: true },
    status: {
      type: String,
      enum: ["new", "reviewed", "closed"],
      default: "new",
      index: true,
    },
    metadata: {
      userAgent: { type: String, trim: true, maxlength: 300, default: "" },
      referer: { type: String, trim: true, maxlength: 300, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.ContactRequest || mongoose.model("ContactRequest", ContactRequestSchema);
