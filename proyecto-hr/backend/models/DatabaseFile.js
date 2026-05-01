import mongoose from "mongoose";

const DatabaseFileSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
  },
  nombreVisible: { type: String, required: true },
  nombreArchivo: String,
  archivo: String,
  extension: String,
  mimeType: String,
  tipoArchivo: { type: String, default: "excel" },
  storageProvider: { type: String, default: "local" },
  storageKey: String,
  storageBucket: String,
  publicUrl: String,
  hoja: String,
  registros: Number,
  activa: { type: Boolean, default: true },
  fechaSubida: { type: Date, default: Date.now },
});

export default mongoose.model("DatabaseFile", DatabaseFileSchema);
