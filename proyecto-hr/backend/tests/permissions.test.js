/**
 * tests/permissions.test.js
 *
 * Tests that superAdmin-only endpoints reject regular users and unauthenticated
 * requests with the correct HTTP status codes.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "./testApp.js";

// ── Token helpers ─────────────────────────────────────────────────────────────

const SECRET = process.env.JWT_SECRET || "test-secret-for-vitest-do-not-use-in-prod";

function makeToken(overrides = {}) {
  return jwt.sign(
    {
      userId: "000000000000000000000001",
      companyId: "000000000000000000000002",
      roleId: "000000000000000000000003",
      isSuperAdmin: false,
      permisos: ["manage_employees"],
      nombre: "Regular User",
      roleCode: "admin",
      roleKey: "admin",
      roleScope: "company",
      scope: "company",
      departmentCode: "",
      teamId: "",
      ...overrides,
    },
    SECRET,
    { expiresIn: "1h" }
  );
}

const regularToken = makeToken();
const superAdminToken = makeToken({ isSuperAdmin: true });

// ── /companies — superAdmin gate ──────────────────────────────────────────────

describe("GET /companies — superAdmin gate", () => {
  it("returns 403 for regular user token", async () => {
    const res = await request(app)
      .get("/companies")
      .set("Authorization", `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/companies");
    expect(res.status).toBe(401);
  });
});

describe("POST /companies — superAdmin gate", () => {
  it("returns 403 for regular user token", async () => {
    const res = await request(app)
      .post("/companies")
      .set("Authorization", `Bearer ${regularToken}`)
      .send({ nombre: "Test Co" });
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/companies")
      .send({ nombre: "Test Co" });
    expect(res.status).toBe(401);
  });
});

// ── /analytics/usage — superAdmin gate ───────────────────────────────────────

describe("GET /analytics/usage — superAdmin gate", () => {
  it("returns 403 for regular user token", async () => {
    const res = await request(app)
      .get("/analytics/usage")
      .set("Authorization", `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/analytics/usage");
    expect(res.status).toBe(401);
  });
});

// ── DELETE /evaluations/:id — auth then 404 ───────────────────────────────────

describe("DELETE /evaluations/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).delete("/evaluations/nonexistent");
    expect(res.status).toBe(401);
  });

  it("returns 404 (or other non-2xx) with valid auth but nonexistent id", async () => {
    // A valid ObjectId that doesn't exist
    const fakeId = "000000000000000000000099";
    const res = await request(app)
      .delete(`/evaluations/${fakeId}`)
      .set("Authorization", `Bearer ${regularToken}`);
    // Without DB the query will likely throw → 500, but it must not be 2xx
    expect([200, 201, 204]).not.toContain(res.status);
  });
});
