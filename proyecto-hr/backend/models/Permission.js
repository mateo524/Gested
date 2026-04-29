import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    module: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Permission", PermissionSchema);
