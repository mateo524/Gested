import mongoose from "mongoose";

const CompanySettingSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    unique: true,
  },
  nombreVisible: { type: String, default: "" },
  logoUrl: { type: String, default: "" },
  primaryColor: { type: String, default: "#10b981" },
  maxUploadSizeMb: { type: Number, default: 10 },
});

export default mongoose.model("CompanySetting", CompanySettingSchema);