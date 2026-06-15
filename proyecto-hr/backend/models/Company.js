import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  tipoCliente: { type: String, default: "general" },
  activa: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  spreadsheetId: { type: String, default: null },
  spreadsheetUrl: { type: String, default: null },
  spreadsheetLastSync: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("Company", CompanySchema);
