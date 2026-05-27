import mongoose from "mongoose";

const UserRoleAssignmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    roleKey: {
      type: String,
      enum: ["ORG_OWNER", "ORG_ADMIN", "HR", "MANAGER", "EMPLOYEE", "VIEWER", "AUDITOR"],
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["ORGANIZATION", "REGION_COUNTRY", "BUSINESS_UNIT", "DEPARTMENT", "TEAM", "SELF"],
      required: true,
    },
    roleLabel: {
      type: String,
      default: "",
      trim: true,
    },
    departmentCode: {
      type: String,
      default: "",
      trim: true,
    },
    teamId: {
      type: String,
      default: "",
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

UserRoleAssignmentSchema.index({ companyId: 1, userId: 1, active: 1 });

export default mongoose.model("UserRoleAssignment", UserRoleAssignmentSchema);
