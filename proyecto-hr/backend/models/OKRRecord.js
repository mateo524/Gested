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
    okrCode: { type: String, trim: true, default: "" },
    objective: { type: String, trim: true, default: "" },
    objectiveTitle: { type: String, required: true, trim: true },
    keyResult: { type: String, trim: true, default: "" },
    keyResultTitle: { type: String, required: true, trim: true },
    period: { type: String, trim: true, default: "" },
    quarter: { type: String, trim: true, default: "" },
    targetValue: { type: Number, default: null },
    currentValue: { type: Number, default: null },
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

OKRRecordSchema.index({ companyId: 1, schoolId: 1, employeeId: 1, lookupKey: 1 }, { unique: true });
OKRRecordSchema.index({ companyId: 1, schoolId: 1, employeeId: 1 });
OKRRecordSchema.index({ companyId: 1, schoolId: 1, cycleId: 1 });
OKRRecordSchema.index({ companyId: 1, schoolId: 1, period: 1 });
OKRRecordSchema.index({ companyId: 1, schoolId: 1, status: 1 });
OKRRecordSchema.index(
  { companyId: 1, schoolId: 1, okrCode: 1, period: 1, employeeId: 1 },
  { sparse: true }
);

export default mongoose.models.OKRRecord || mongoose.model("OKRRecord", OKRRecordSchema);
