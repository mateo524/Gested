import mongoose from "mongoose";

const OKRRecordSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    departmentCode: { type: String, trim: true, default: "" },
    lookupKey: { type: String, required: true, trim: true },
    okrCode: { type: String, trim: true, default: "" },
    objectiveTitle: { type: String, required: true, trim: true },
    keyResultTitle: { type: String, required: true, trim: true },
    quarter: { type: String, trim: true, default: "" },
    targetValue: { type: Number, default: null },
    status: { type: String, trim: true, default: "active" },
    sourceImportJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportJob",
      default: null,
    },
    lastImportedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OKRRecordSchema.index({ companyId: 1, schoolId: 1, employeeId: 1, lookupKey: 1 }, { unique: true });

export default mongoose.models.OKRRecord || mongoose.model("OKRRecord", OKRRecordSchema);
