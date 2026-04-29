import mongoose from "mongoose";

const DevelopmentPlanSchema = new mongoose.Schema(
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
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evaluation",
      default: null,
    },
    fortalezas: [{ type: String, trim: true }],
    aspectoDesarrollar: { type: String, required: true, trim: true },
    medicion: { type: String, trim: true },
    fechaSeguimiento: { type: Date, default: null },
    responsableUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    estado: {
      type: String,
      enum: ["PENDIENTE", "EN_CURSO", "CERRADO"],
      default: "PENDIENTE",
    },
  },
  { timestamps: true }
);

export default mongoose.model("DevelopmentPlan", DevelopmentPlanSchema);
