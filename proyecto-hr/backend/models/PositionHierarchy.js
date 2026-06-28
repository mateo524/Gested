import mongoose from "mongoose";

const PositionHierarchySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    puesto: { type: String, required: true, trim: true },
    departamento: { type: String, trim: true, default: "" },
    tipoAcceso: {
      type: String,
      enum: ["EMPLEADO", "MANDO_MEDIO", "DIRECCION"],
      required: true,
    },
  },
  { timestamps: true }
);

PositionHierarchySchema.index({ companyId: 1, puesto: 1, departamento: 1 }, { unique: true });

export default mongoose.model("PositionHierarchy", PositionHierarchySchema);
