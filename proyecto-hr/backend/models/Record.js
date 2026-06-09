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
    telefono: String,
    direccion: String,
    ciudad: String,
    estado: String,
    fechaIngreso: Date,
    departamento: String,
    jefe: String,
    salario: Number,
    tipoContrato: String,
    estado_empleado: { type: String, enum: ["activo", "inactivo", "licencia"], default: "activo" },
    documento: String,
    fotoPerfil: String,
    descripcion: String,
  },
  { timestamps: true }
);

export default mongoose.model("Record", RecordSchema);