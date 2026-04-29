import mongoose from "mongoose";

const DevelopmentPlanSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Record",
      required: true,
    },
    empleadoEmail: {
      type: String,
      required: true,
    },
    titulo: {
      type: String,
      required: true,
    },
    descripcion: String,
    objetivos: [
      {
        descripcion: String,
        estado: { type: String, enum: ["pendiente", "en_progreso", "completado"], default: "pendiente" },
        fechaTarget: Date,
        completedAt: Date,
      },
    ],
    competencias: [
      {
        nombre: String,
        nivelActual: { type: Number, min: 1, max: 5 },
        nivelTarget: { type: Number, min: 1, max: 5 },
        acciones: [String],
      },
    ],
    fechaInicio: {
      type: Date,
      required: true,
    },
    fechaFin: {
      type: Date,
      required: true,
    },
    estado: { type: String, enum: ["no_iniciado", "en_curso", "completado", "pausado"], default: "no_iniciado" },
    progreso: { type: Number, min: 0, max: 100, default: 0 },
    responsable: String,
    notas: String,
  },
  { timestamps: true }
);

export default mongoose.model("DevelopmentPlan", DevelopmentPlanSchema);
