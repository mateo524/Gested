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
      default: null,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    departmentCode: { type: String, trim: true, default: "" },
    teamId: { type: String, trim: true, default: "" },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EvaluationCycle",
      default: null,
      index: true,
    },
    lookupKey: { type: String, required: true, trim: true },
    kpiCode: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number, default: null },
    unit: { type: String, trim: true, default: "" },
    frequency: { type: String, trim: true, default: "" },
    period: { type: String, trim: true, default: "" },
    weight: { type: Number, default: 1 },
    status: { type: String, trim: true, default: "active" },
    active: { type: Boolean, default: true },
    source: {
      type: String,
      enum: ["manual", "bulk_import", "system"],
      default: "manual",
    },
    importJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportJob",
      default: null,
      index: true,
    },
    sourceImportJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportJob",
      default: null,
    },
    lastImportedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

KPIRecordSchema.index({ companyId: 1, schoolId: 1, employeeId: 1, lookupKey: 1 }, { unique: true });
KPIRecordSchema.index({ companyId: 1, schoolId: 1, employeeId: 1 });
KPIRecordSchema.index({ companyId: 1, schoolId: 1, cycleId: 1 });
KPIRecordSchema.index({ companyId: 1, schoolId: 1, period: 1 });
KPIRecordSchema.index({ companyId: 1, schoolId: 1, status: 1 });
KPIRecordSchema.index(
  { companyId: 1, schoolId: 1, kpiCode: 1, period: 1, employeeId: 1 },
  { sparse: true }
);

export default mongoose.models.KPIRecord || mongoose.model("KPIRecord", KPIRecordSchema);
