import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    activo: { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
