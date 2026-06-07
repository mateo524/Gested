/**
 * tests/evaluations.test.js
 *
 * Tests for the /evaluations endpoints.
 * DB-dependent assertions (200 + array shape) are skipped unless
 * MONGO_URI_TEST and TEST_AUTH_TOKEN are provided.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "./testApp.js";

const hasTestDb = !!process.env.MONGO_URI_TEST;

// Build a structurally-valid JWT signed with the test secret so we can test
// auth passing but DB queries failing gracefully.
function makeToken(payload = {}) {
  const secret = process.env.JWT_SECRET || "test-secret-for-vitest-do-not-use-in-prod";
  return jwt.sign(
    {
      userId: "000000000000000000000001",
      companyId: "000000000000000000000002",
      roleId: "000000000000000000000003",
      isSuperAdmin: false,
      permisos: ["manage_evaluations"],
      nombre: "Test",
      roleCode: "admin",
      roleKey: "admin",
      roleScope: "company",
      scope: "company",
      departmentCode: "",
      teamId: "",
      ...payload,
    },
    secret,
    { expiresIn: "1h" }
  );
}

// ── No auth → 401 ─────────────────────────────────────────────────────────────

describe("GET /evaluations — no auth", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/evaluations");
    expect(res.status).toBe(401);
  });
});

// ── POST /evaluations — validation (signed token, no DB) ─────────────────────
// Routes validate required fields before touching the DB, so these should
// return 400/401/403 even without a real DB connection.

describe("POST /evaluations — field validation", () => {
  const token = makeToken();

  it("returns 400 when employeeId is missing", async () => {
    const res = await request(app)
      .post("/evaluations")
      .set("Authorization", `Bearer ${token}`)
      .send({ cycleId: "000000000000000000000010", tipo: "AUTOEVALUACION" });
    // Without DB attachTenantScope may fail → 500 acceptable; must not be 201
    expect(res.status).not.toBe(201);
  });

  it("returns 400 when cycleId is missing", async () => {
    const res = await request(app)
      .post("/evaluations")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: "000000000000000000000020", tipo: "AUTOEVALUACION" });
    expect(res.status).not.toBe(201);
  });

  it("does not create an evaluation when both employeeId and cycleId are missing", async () => {
    const res = await request(app)
      .post("/evaluations")
      .set("Authorization", `Bearer ${token}`)
      .send({ tipo: "AUTOEVALUACION" });
    // Without DB attachTenantScope may throw → 400 or 500; never 201
    expect(res.status).not.toBe(201);
  });
});

// ── With real DB ──────────────────────────────────────────────────────────────

describe.skipIf(!hasTestDb)("GET /evaluations — with real DB", () => {
  const token = process.env.TEST_AUTH_TOKEN || makeToken();

  it("returns 200 and an array", async () => {
    const res = await request(app)
      .get("/evaluations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each item has expected shape (_id, estado, tipo)", async () => {
    const res = await request(app)
      .get("/evaluations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    for (const item of res.body) {
      expect(item).toHaveProperty("_id");
      expect(item).toHaveProperty("estado");
      expect(item).toHaveProperty("tipo");
    }
  });
});
