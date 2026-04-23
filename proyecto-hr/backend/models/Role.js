import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  nombre: { type: String, required: true },
  permisos: {
    type: [String],
    default: [],
  },
});

export default mongoose.model("Role", RoleSchema);