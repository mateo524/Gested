import mongoose from "mongoose";

const AnnouncementSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    titulo: { type: String, required: true },
    cuerpo: { type: String, required: true },
    prioridad: {
      type: String,
      enum: ["informativa", "importante", "urgente"],
      default: "informativa",
    },
    categoria: { type: String, default: "general" },
    visible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", AnnouncementSchema);
