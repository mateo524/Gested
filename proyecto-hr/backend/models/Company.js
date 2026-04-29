import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  slug: { type: String },
  tipoCliente: { type: String, default: "general" },
  activa: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
});

export default mongoose.model("Company", CompanySchema);
