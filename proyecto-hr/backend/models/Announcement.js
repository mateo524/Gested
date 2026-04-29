import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    nombreOriginal: String,
    nombreArchivo: String,
    mimeType: String,
    extension: String,
    tipoArchivo: { type: String, default: "documento" },
  },
  { _id: false }
);

const ReadBySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    attachments: { type: [AttachmentSchema], default: [] },
    readBy: { type: [ReadBySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", AnnouncementSchema);
