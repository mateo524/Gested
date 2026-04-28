import express from "express";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";

const router = express.Router();

router.get("/", auth, permit("view_audit"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const search = req.query.q?.trim();
  const modulo = req.query.modulo?.trim();
  const accion = req.query.accion?.trim();
  const from = req.query.from?.trim();
  const to = req.query.to?.trim();
  const userId = req.query.userId?.trim();

  const filters = { companyId };

  if (modulo) filters.modulo = modulo;
  if (accion) filters.accion = accion;
  if (userId) filters.userId = userId;

  if (from || to) {
    filters.createdAt = {};
    if (from) filters.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filters.createdAt.$lte = end;
    }
  }

  if (search) {
    filters.$or = [
      { detalle: { $regex: search, $options: "i" } },
      { modulo: { $regex: search, $options: "i" } },
      { accion: { $regex: search, $options: "i" } },
    ];
  }

  const [logs, users] = await Promise.all([
    AuditLog.find(filters).sort({ createdAt: -1 }).limit(300).lean(),
    User.find({ companyId, isSuperAdmin: false }).select("nombre email").lean(),
  ]);

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const enriched = logs.map((log) => ({
    ...log,
    actor: userMap.get(String(log.userId)) || null,
  }));

  const modules = [...new Set(logs.map((log) => log.modulo).filter(Boolean))].sort();
  const actions = [...new Set(logs.map((log) => log.accion).filter(Boolean))].sort();

  res.json({
    logs: enriched,
    filters: {
      modules,
      actions,
      users,
    },
  });
});

export default router;
