import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    nombre: { type: String, required: true },
    apellido: { type: String, default: "", trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    avatarUrl: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true },
    activo: { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

export default mongoose.model("User", UserSchema);
