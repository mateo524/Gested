import mongoose from "mongoose";

const KPIRecordSchema = new mongoose.Schema(
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
    kpiCode: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    targetValue: { type: Number, required: true },
    unit: { type: String, trim: true, default: "" },
    frequency: { type: String, trim: true, default: "" },
    status: { type: String, trim: true, default: "active" },
    active: { type: Boolean, default: true },
    sourceImportJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportJob",
      default: null,
    },
    lastImportedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

KPIRecordSchema.index({ companyId: 1, schoolId: 1, employeeId: 1, lookupKey: 1 }, { unique: true });

export default mongoose.models.KPIRecord || mongoose.model("KPIRecord", KPIRecordSchema);
