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
  defaultEmailDomain: { type: String, default: "performia.app" },
  defaultEmployeeRoleCode: { type: String, default: "EMPLEADO" },
  automations: {
    nightlyDataCheck: { type: Boolean, default: true },
    autoCreateUsersFromImport: { type: Boolean, default: false },
    autoAssignDefaultRole: { type: Boolean, default: true },
    notifyOnImportErrors: { type: Boolean, default: true },
  },
});

export default mongoose.model("CompanySetting", CompanySettingSchema);
