import mongoose from "mongoose";

const RecordSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    databaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DatabaseFile",
      required: true,
    },
    apellido: String,
    nombre: String,
    nombreCompleto: String,
    rol: String,
    email: String,
  },
  { timestamps: true }
);

export default mongoose.model("Record", RecordSchema);