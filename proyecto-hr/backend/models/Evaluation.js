import mongoose from "mongoose";

const EvaluationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    evaluatorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EvaluationCycle",
      required: true,
      index: true,
    },
    tipo: {
      type: String,
      enum: ["AUTOEVALUACION", "JEFATURA", "FINAL"],
      required: true,
    },
    estado: {
      type: String,
      enum: ["BORRADOR", "ENVIADA", "REVISADA", "CERRADA"],
      default: "BORRADOR",
    },
    comentariosGenerales: { type: String, trim: true },
    acuerdoEmpleado: {
      type: String,
      enum: ["ACUERDO", "DESACUERDO", "PENDIENTE"],
      default: "PENDIENTE",
    },
    resultadoFinal: { type: Number, default: 0 },
    evidenciaUrls: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("Evaluation", EvaluationSchema);
