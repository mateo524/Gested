import express from "express";
import AuditLog from "../models/AuditLog.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

const router = express.Router();

router.get("/", auth, permit("view_audit"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const logs = await AuditLog.find({ companyId })
    .sort({ createdAt: -1 })
    .limit(200);

  res.json(logs);
});

export default router;
