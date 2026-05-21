import express from "express";
import Announcement from "../models/Announcement.js";
import Company from "../models/Company.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";
import { logAudit } from "../utils/audit.js";
import { getPresetByLegacyRoleCode } from "../utils/rolePresets.js";

const router = express.Router();
const ANNOUNCEMENT_TYPES = new Set(["info", "warning", "success", "update"]);
const ANNOUNCEMENT_SCOPES = new Set([
  "ORGANIZATION",
  "REGION_COUNTRY",
  "BUSINESS_UNIT",
  "DEPARTMENT",
  "TEAM",
  "SELF",
]);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "si", "yes", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "inactive"].includes(normalized)) return false;
  return fallback;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeAnnouncementType(value, fallback = "info") {
  const normalized = normalizeText(value).toLowerCase();
  if (ANNOUNCEMENT_TYPES.has(normalized)) return normalized;
  if (normalized === "urgente" || normalized === "importante") return "warning";
  if (normalized === "informativa") return "info";
  return fallback;
}

function normalizeLegacyPriority(type) {
  if (type === "warning") return "urgente";
  if (type === "success") return "importante";
  if (type === "update") return "importante";
  return "informativa";
}

function normalizeAudienceRoleKeys(value) {
  const values = normalizeStringArray(value).map((item) => item.toUpperCase());
  if (values.some((item) => item === "SUPER_ADMIN" || item === "PLATFORM")) {
    throw createHttpError(400, "No se permite configurar audiencias de plataforma");
  }
  return [...new Set(values)];
}

function normalizeAudienceScopes(value) {
  const values = normalizeStringArray(value).map((item) => item.toUpperCase());
  const invalid = values.find((item) => !ANNOUNCEMENT_SCOPES.has(item));
  if (invalid) {
    throw createHttpError(400, `Scope de audiencia invalido: ${invalid}`);
  }
  return [...new Set(values)];
}

export function canManageAnnouncements(user = {}) {
  if (user?.isSuperAdmin) return true;
  const roleKey = String(user?.roleKey || "").toUpperCase();
  const roleCode = String(user?.roleCode || "").toUpperCase();
  const permissions = Array.isArray(user?.permisos) ? user.permisos : [];

  return (
    ["ORG_OWNER", "ORG_ADMIN", "HR"].includes(roleKey) ||
    ["ADMIN_COLEGIO", "RRHH", "DIRECTOR"].includes(roleCode) ||
    permissions.includes("manage_users") ||
    permissions.includes("manage_settings")
  );
}

function getHeaderValue(req, headerName) {
  if (typeof req?.get === "function") {
    return req.get(headerName);
  }
  const headers = req?.headers || {};
  return headers[headerName.toLowerCase()] || headers[headerName] || null;
}

export function resolveAnnouncementTenantIds(req) {
  const companyFromHeader = getHeaderValue(req, "X-Company-Id");
  const scope = req.scope || {};
  return {
    companyId: scope.isSuperAdmin ? companyFromHeader || scope.companyId || req.user?.companyId || null : scope.companyId || req.user?.companyId || null,
    schoolId: scope.isSuperAdmin ? scope.schoolId || req.user?.schoolId || null : scope.schoolId || req.user?.schoolId || null,
  };
}

export function hasReadAnnouncement(item, currentUserId) {
  return Boolean(
    item?.readBy?.some((entry) => String(entry.userId) === String(currentUserId))
  );
}

function resolveUserRoleKeys(user = {}, scope = {}) {
  const keys = new Set();
  if (user?.roleKey) keys.add(String(user.roleKey).toUpperCase());
  if (scope?.roleKey) keys.add(String(scope.roleKey).toUpperCase());
  const preset = getPresetByLegacyRoleCode(user?.roleCode || scope?.roleCode || "");
  if (preset?.roleKey) keys.add(String(preset.roleKey).toUpperCase());
  return [...keys];
}

function resolveUserScopes(user = {}, scope = {}) {
  const values = [user?.roleScope, user?.scope, scope?.roleScope]
    .map((item) => normalizeText(item).toUpperCase())
    .filter(Boolean);
  return [...new Set(values)];
}

function isAnnouncementActive(item) {
  if (!item) return false;
  if (item.isActive === false || item.visible === false) return false;
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

export function canAccessAnnouncement(announcement, user = {}, scope = {}) {
  if (!announcement || !isAnnouncementActive(announcement)) return false;
  if (!user?.isSuperAdmin) {
    if (scope.companyId && String(announcement.companyId || "") !== String(scope.companyId)) {
      return false;
    }
    if (scope.schoolId && announcement.schoolId && String(announcement.schoolId || "") !== String(scope.schoolId)) {
      return false;
    }
  }

  const roleAudience = normalizeAudienceRoleKeys(announcement.audienceRoleKeys || []);
  if (roleAudience.length) {
    const userRoleKeys = resolveUserRoleKeys(user, scope);
    if (!userRoleKeys.some((item) => roleAudience.includes(item))) {
      return false;
    }
  }

  const scopeAudience = normalizeAudienceScopes(announcement.audienceScopes || []);
  if (scopeAudience.length) {
    const userScopes = resolveUserScopes(user, scope);
    if (!userScopes.some((item) => scopeAudience.includes(item))) {
      return false;
    }
  }

  return true;
}

export function mapAnnouncement(item, currentUserId) {
  const title = item.title || item.titulo || "";
  const body = item.body || item.cuerpo || "";
  const type = normalizeAnnouncementType(item.type || item.prioridad || "info");
  const isRead = hasReadAnnouncement(item, currentUserId);

  return {
    ...item,
    title,
    body,
    type,
    pinned: item.pinned === true,
    isActive: item.isActive !== false && item.visible !== false,
    isRead,
    unread: !isRead,
    titulo: title,
    cuerpo: body,
    prioridad: item.prioridad || normalizeLegacyPriority(type),
  };
}

export function buildAnnouncementListPayload(announcements, currentUserId) {
  const mapped = announcements.map((item) => mapAnnouncement(item, currentUserId));
  return {
    announcements: mapped,
    unreadCount: mapped.filter((item) => !item.isRead).length,
  };
}

async function resolveTenantCompany(req) {
  const { companyId, schoolId } = resolveAnnouncementTenantIds(req);
  if (!companyId) {
    throw createHttpError(400, "No pudimos resolver la organizacion activa");
  }

  const company = await Company.findById(companyId).select("_id nombre activa").lean();
  if (!company) {
    throw createHttpError(404, "Empresa no encontrada");
  }

  if (!req.user?.isSuperAdmin && company.activa === false) {
    throw createHttpError(403, "La organizacion tiene el acceso suspendido");
  }

  return { companyId: String(company._id), schoolId: schoolId || null, company };
}

async function loadVisibleAnnouncementsForRequest(req, { includeInactive = false } = {}) {
  const { companyId, schoolId } = await resolveTenantCompany(req);
  const query = { companyId };
  if (schoolId) query.schoolId = schoolId;

  const announcements = await Announcement.find(query).sort({ pinned: -1, createdAt: -1 }).limit(300).lean();
  return announcements.filter((item) => {
    if (!includeInactive && !isAnnouncementActive(item)) return false;
    return canAccessAnnouncement(item, req.user, req.scope);
  });
}

router.get("/summary", auth, attachTenantScope, async (req, res, next) => {
  try {
    const announcements = await loadVisibleAnnouncementsForRequest(req);
    const payload = buildAnnouncementListPayload(announcements.slice(0, 6), req.user.userId);
    res.json({
      unreadCount: announcements.filter((item) => !hasReadAnnouncement(item, req.user.userId)).length,
      latest: payload.announcements,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", auth, attachTenantScope, async (req, res, next) => {
  try {
    const announcements = await loadVisibleAnnouncementsForRequest(req);
    res.json({
      unreadCount: announcements.filter((item) => !hasReadAnnouncement(item, req.user.userId)).length,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", auth, attachTenantScope, async (req, res, next) => {
  try {
    const unreadOnly = String(req.query.unread || "").toLowerCase() === "true";
    const includeInactive = String(req.query.active || "").toLowerCase() === "all" && canManageAnnouncements(req.user);
    let announcements = await loadVisibleAnnouncementsForRequest(req, { includeInactive });

    if (unreadOnly) {
      announcements = announcements.filter((item) => !hasReadAnnouncement(item, req.user.userId));
    }

    const payload = buildAnnouncementListPayload(announcements, req.user.userId);
    res.json({
      ...payload,
      companies: [],
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", auth, attachTenantScope, async (req, res, next) => {
  try {
    if (!canManageAnnouncements(req.user)) {
      return res.status(403).json({ mensaje: "No tienes permisos para crear novedades" });
    }

    const { companyId, schoolId, company } = await resolveTenantCompany(req);
    const title = normalizeText(req.body.title || req.body.titulo);
    const body = normalizeText(req.body.body || req.body.cuerpo);
    const type = normalizeAnnouncementType(req.body.type || req.body.prioridad, "info");
    const audienceRoleKeys = normalizeAudienceRoleKeys(req.body.audienceRoleKeys);
    const audienceScopes = normalizeAudienceScopes(req.body.audienceScopes);

    if (!title || !body) {
      return res.status(400).json({ mensaje: "Debes completar titulo y contenido" });
    }

    const announcement = await Announcement.create({
      companyId,
      schoolId,
      title,
      body,
      type,
      audienceRoleKeys,
      audienceScopes,
      createdBy: req.user.userId,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      isActive: toBoolean(req.body.isActive, true),
      pinned: toBoolean(req.body.pinned, false),
      authorUserId: req.user.userId,
      titulo: title,
      cuerpo: body,
      prioridad: normalizeLegacyPriority(type),
      categoria: normalizeText(req.body.categoria || "general") || "general",
      visible: toBoolean(req.body.isActive, true),
      attachments: [],
    });

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "create",
      modulo: "novedades",
      detalle: `Se creo una novedad en ${company.nombre}: ${title}`,
    });

    res.status(201).json({
      ok: true,
      mensaje: "Novedad creada",
      announcement: mapAnnouncement(announcement.toObject(), req.user.userId),
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", auth, attachTenantScope, async (req, res, next) => {
  try {
    if (!canManageAnnouncements(req.user)) {
      return res.status(403).json({ mensaje: "No tienes permisos para editar novedades" });
    }

    const { companyId } = await resolveTenantCompany(req);
    const announcement = await Announcement.findOne({ _id: req.params.id, companyId });
    if (!announcement) {
      return res.status(404).json({ mensaje: "Novedad no encontrada" });
    }

    const title = normalizeText(req.body.title || req.body.titulo || announcement.title || announcement.titulo);
    const body = normalizeText(req.body.body || req.body.cuerpo || announcement.body || announcement.cuerpo);
    const type = normalizeAnnouncementType(req.body.type || req.body.prioridad || announcement.type || announcement.prioridad, announcement.type || "info");

    if (!title || !body) {
      return res.status(400).json({ mensaje: "Debes completar titulo y contenido" });
    }

    announcement.title = title;
    announcement.body = body;
    announcement.type = type;
    announcement.audienceRoleKeys = normalizeAudienceRoleKeys(req.body.audienceRoleKeys ?? announcement.audienceRoleKeys);
    announcement.audienceScopes = normalizeAudienceScopes(req.body.audienceScopes ?? announcement.audienceScopes);
    announcement.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    announcement.isActive = toBoolean(req.body.isActive, announcement.isActive !== false);
    announcement.pinned = toBoolean(req.body.pinned, announcement.pinned === true);
    announcement.titulo = title;
    announcement.cuerpo = body;
    announcement.prioridad = normalizeLegacyPriority(type);
    announcement.visible = announcement.isActive;

    await announcement.save();

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "update",
      modulo: "novedades",
      detalle: `Se actualizo la novedad ${title}`,
    });

    res.json({
      ok: true,
      mensaje: "Novedad actualizada",
      announcement: mapAnnouncement(announcement.toObject(), req.user.userId),
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", auth, attachTenantScope, async (req, res, next) => {
  try {
    if (!canManageAnnouncements(req.user)) {
      return res.status(403).json({ mensaje: "No tienes permisos para desactivar novedades" });
    }

    const { companyId } = await resolveTenantCompany(req);
    const announcement = await Announcement.findOne({ _id: req.params.id, companyId });
    if (!announcement) {
      return res.status(404).json({ mensaje: "Novedad no encontrada" });
    }

    announcement.isActive = false;
    announcement.visible = false;
    await announcement.save();

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "delete",
      modulo: "novedades",
      detalle: `Se desactivo la novedad ${announcement.title || announcement.titulo}`,
    });

    res.json({ ok: true, mensaje: "Novedad desactivada" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/read", auth, attachTenantScope, async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ mensaje: "Novedad no encontrada" });
    }

    if (!canAccessAnnouncement(announcement.toObject(), req.user, req.scope)) {
      return res.status(403).json({ mensaje: "No tienes acceso a esta novedad" });
    }

    if (!hasReadAnnouncement(announcement, req.user.userId)) {
      announcement.readBy.push({
        userId: req.user.userId,
        readAt: new Date(),
      });
      await announcement.save();
    }

    res.json({ ok: true, mensaje: "Novedad marcada como vista" });
  } catch (error) {
    next(error);
  }
});

router.post("/read-all", auth, attachTenantScope, async (req, res, next) => {
  try {
    const announcements = await loadVisibleAnnouncementsForRequest(req);
    const unread = announcements.filter((item) => !hasReadAnnouncement(item, req.user.userId));

    if (!unread.length) {
      return res.json({ ok: true, mensaje: "No hay novedades nuevas", updated: 0 });
    }

    await Promise.all(
      unread.map((item) =>
        Announcement.updateOne(
          { _id: item._id, "readBy.userId": { $ne: req.user.userId } },
          { $push: { readBy: { userId: req.user.userId, readAt: new Date() } } }
        )
      )
    );

    res.json({ ok: true, mensaje: "Novedades marcadas como vistas", updated: unread.length });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  const status = Number(error?.status || 500);
  res.status(status).json({
    ok: false,
    mensaje: error?.message || "No pudimos procesar las novedades",
  });
});

export default router;
