import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  buildAnnouncementListPayload,
  canAccessAnnouncement,
  canManageAnnouncements,
  hasReadAnnouncement,
  resolveAnnouncementTenantIds,
} from "../../routes/announcements.routes.js";

function objectId(seed) {
  return new mongoose.Types.ObjectId(String(seed).padStart(24, "0").slice(-24));
}

function buildAnnouncement(overrides = {}) {
  return {
    _id: objectId(1),
    companyId: "org-a",
    schoolId: "school-a",
    title: "Novedad",
    body: "Contenido",
    type: "info",
    isActive: true,
    visible: true,
    pinned: false,
    audienceRoleKeys: [],
    audienceScopes: [],
    readBy: [],
    createdAt: new Date("2026-05-21T10:00:00.000Z"),
    ...overrides,
  };
}

test("ORG_ADMIN puede gestionar novedades dentro de su tenant", () => {
  assert.equal(
    canManageAnnouncements({
      roleKey: "ORG_ADMIN",
      permisos: [],
    }),
    true
  );
});

test("EMPLOYEE no puede crear novedades", () => {
  assert.equal(
    canManageAnnouncements({
      roleKey: "EMPLOYEE",
      permisos: [],
    }),
    false
  );
});

test("resolveAnnouncementTenantIds ignora body y query para usuarios no superadmin", () => {
  const tenant = resolveAnnouncementTenantIds({
    scope: {
      companyId: "org-scope",
      schoolId: "school-scope",
      isSuperAdmin: false,
    },
    body: {
      companyId: "org-body",
      schoolId: "school-body",
    },
    query: {
      companyId: "org-query",
      schoolId: "school-query",
    },
  });

  assert.equal(tenant.companyId, "org-scope");
  assert.equal(tenant.schoolId, "school-scope");
});

test("usuario de organizacion A no ve novedades de organizacion B", () => {
  const visible = canAccessAnnouncement(
    buildAnnouncement({ companyId: "org-b" }),
    { userId: objectId(11), roleKey: "EMPLOYEE" },
    { companyId: "org-a", schoolId: "school-a" }
  );

  assert.equal(visible, false);
});

test("unread-count cuenta solo novedades no vistas del usuario actual", () => {
  const currentUserId = objectId(21);
  const anotherUserId = objectId(22);

  const payload = buildAnnouncementListPayload(
    [
      buildAnnouncement({
        _id: objectId(31),
        readBy: [{ userId: currentUserId, readAt: new Date() }],
      }),
      buildAnnouncement({
        _id: objectId(32),
        title: "Pendiente",
        readBy: [{ userId: anotherUserId, readAt: new Date() }],
      }),
    ],
    currentUserId
  );

  assert.equal(payload.unreadCount, 1);
  assert.equal(payload.announcements[0].isRead, true);
  assert.equal(payload.announcements[1].isRead, false);
});

test("mark read solo cuenta para ese usuario", () => {
  const currentUserId = objectId(41);
  const anotherUserId = objectId(42);
  const announcement = buildAnnouncement({
    readBy: [{ userId: anotherUserId, readAt: new Date() }],
  });

  assert.equal(hasReadAnnouncement(announcement, currentUserId), false);
  assert.equal(hasReadAnnouncement(announcement, anotherUserId), true);
});

test("read-all potencialmente marca solo novedades visibles para ese usuario", () => {
  const currentUserId = objectId(51);
  const visible = buildAnnouncement({
    _id: objectId(61),
    audienceRoleKeys: ["EMPLOYEE"],
  });
  const hiddenByRole = buildAnnouncement({
    _id: objectId(62),
    audienceRoleKeys: ["HR"],
  });

  const scope = { companyId: "org-a", schoolId: "school-a", roleScope: "SELF" };
  const user = { userId: currentUserId, roleKey: "EMPLOYEE" };

  const visibleUnread = [visible, hiddenByRole].filter(
    (item) => canAccessAnnouncement(item, user, scope) && !hasReadAnnouncement(item, currentUserId)
  );

  assert.equal(visibleUnread.length, 1);
  assert.equal(String(visibleUnread[0]._id), String(visible._id));
});

test("no se puede marcar como leida una novedad de otro tenant", () => {
  const canRead = canAccessAnnouncement(
    buildAnnouncement({ companyId: "org-b" }),
    { userId: objectId(71), roleKey: "ORG_ADMIN" },
    { companyId: "org-a", schoolId: "school-a", roleScope: "ORGANIZATION" }
  );

  assert.equal(canRead, false);
});

test("novedad para departamento solo la ve ese departamento", () => {
  const announcement = buildAnnouncement({
    audienceType: "department",
    audienceDepartmentCodes: ["SECUNDARIA"],
  });

  assert.equal(
    canAccessAnnouncement(
      announcement,
      { userId: objectId(81), roleKey: "EMPLOYEE", departmentCode: "SECUNDARIA" },
      { companyId: "org-a", schoolId: "school-a", roleScope: "SELF", departmentCode: "SECUNDARIA" }
    ),
    true
  );
  assert.equal(
    canAccessAnnouncement(
      announcement,
      { userId: objectId(82), roleKey: "EMPLOYEE", departmentCode: "PRIMARIA" },
      { companyId: "org-a", schoolId: "school-a", roleScope: "SELF", departmentCode: "PRIMARIA" }
    ),
    false
  );
});

test("novedad para empleados específicos solo la ven esos empleados", () => {
  const employeeId = objectId(91);
  const announcement = buildAnnouncement({
    audienceType: "employees",
    audienceEmployeeIds: [employeeId],
  });

  assert.equal(
    canAccessAnnouncement(
      announcement,
      { userId: objectId(92), roleKey: "EMPLOYEE", employeeId },
      { companyId: "org-a", schoolId: "school-a", roleScope: "SELF", employeeId }
    ),
    true
  );
  assert.equal(
    canAccessAnnouncement(
      announcement,
      { userId: objectId(93), roleKey: "EMPLOYEE", employeeId: objectId(94) },
      { companyId: "org-a", schoolId: "school-a", roleScope: "SELF", employeeId: objectId(94) }
    ),
    false
  );
});
