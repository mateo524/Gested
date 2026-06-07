import mongoose from "mongoose";

const LeadDripSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    company: { type: String, trim: true },
    source: {
      type: String,
      enum: ["landing_contact", "calendly", "manual"],
      default: "manual",
    },
    currentStep: { type: Number, default: 0 },
    enrolled: { type: Date, default: Date.now },
    lastSentAt: { type: Date },
    completed: { type: Boolean, default: false },
    unsubscribed: { type: Boolean, default: false },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  },
  { timestamps: true }
);

export default mongoose.model("LeadDrip", LeadDripSchema);
