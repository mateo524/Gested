import mongoose from "mongoose";

const SchoolSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    nombre: { type: String, required: true, trim: true },
    codigo: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    provincia: { type: String, trim: true },
    pais: { type: String, default: "Argentina" },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SchoolSchema.index({ companyId: 1, nombre: 1 }, { unique: true });

export default mongoose.model("School", SchoolSchema);
