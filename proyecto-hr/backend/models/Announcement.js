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
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
    },
    title: { type: String, trim: true, required: true },
    body: { type: String, trim: true, required: true },
    type: {
      type: String,
      enum: ["info", "warning", "success", "update"],
      default: "info",
    },
    audienceRoleKeys: { type: [String], default: [] },
    audienceScopes: { type: [String], default: [] },
    audienceType: {
      type: String,
      enum: ["all", "department", "employees", "singleEmployee"],
      default: "all",
    },
    audienceDepartmentCodes: { type: [String], default: [] },
    audienceEmployeeIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      default: [],
    },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    pinned: { type: Boolean, default: false },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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

AnnouncementSchema.index({ companyId: 1, schoolId: 1, isActive: 1, createdAt: -1 });
AnnouncementSchema.index({ companyId: 1, pinned: -1, createdAt: -1 });

export default mongoose.model("Announcement", AnnouncementSchema);
