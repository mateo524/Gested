import mongoose from "mongoose";

const ModulesSchema = new mongoose.Schema({
  evaluaciones:     { type: Boolean, default: true },
  competencias:     { type: Boolean, default: true },
  planesDesarrollo: { type: Boolean, default: true },
  reporteEjecutivo: { type: Boolean, default: true },
  orgchart:         { type: Boolean, default: true },
  exportacion:      { type: Boolean, default: true },
  kpis:             { type: Boolean, default: false },
  calibracion:      { type: Boolean, default: false },
  cargaMasiva:      { type: Boolean, default: true },
}, { _id: false });

const CompanySchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  tipoCliente: { type: String, default: "general" },
  activa: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  spreadsheetId: { type: String, default: null },
  spreadsheetUrl: { type: String, default: null },
  spreadsheetLastSync: { type: Date, default: null },
  modules: { type: ModulesSchema, default: () => ({}) },
  plan: { type: String, enum: ["base", "pro"], default: "pro" },
  planExpiresAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("Company", CompanySchema);
