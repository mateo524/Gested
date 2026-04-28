import mongoose from "mongoose";

const DatabaseFileSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  nombreVisible: { type: String, required: true },
  nombreArchivo: String,
  archivo: String,
  extension: String,
  mimeType: String,
  tipoArchivo: { type: String, default: "excel" },
  hoja: String,
  registros: Number,
  activa: { type: Boolean, default: true },
  fechaSubida: { type: Date, default: Date.now },
});

export default mongoose.model("DatabaseFile", DatabaseFileSchema);
