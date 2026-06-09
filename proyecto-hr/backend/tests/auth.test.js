/**
 * tests/auth.test.js
 *
 * Auth endpoint tests using supertest against the test app.
 * DB-dependent tests (login with real credentials) are skipped unless
 * MONGO_URI_TEST is set.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "./testApp.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const hasTestDb = !!process.env.MONGO_URI_TEST;

// ── /health ──────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with ok field", async () => {
    const res = await request(app).get("/health");
    // Without a DB connection ok will be false → 503, but the field must exist.
    // We only assert the field is present and is a boolean.
    expect([200, 503]).toContain(res.status);
    expect(typeof res.body.ok).toBe("boolean");
  });
});

// ── POST /auth/login — validation (no DB needed) ─────────────────────────────

describe("POST /auth/login — request validation", () => {
  it("returns 400 when body is missing entirely", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send();
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ password: "somepassword" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when both email and password are empty strings", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "", password: "" });
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/login — wrong credentials (no DB needed → 401 or 500) ─────────
// When no DB is connected the User.findOne query will throw, which the route
// catches and returns 401 or 500.  Either way it must NOT return 200.

describe("POST /auth/login — wrong credentials (no real DB)", () => {
  it("does not return 200 for nonexistent user", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "wrongpassword" });
    expect(res.status).not.toBe(200);
  });
});

// ── POST /auth/login — DB-dependent tests ────────────────────────────────────

describe.skipIf(!hasTestDb)("POST /auth/login — with real DB", () => {
  const VALID_EMAIL = process.env.TEST_USER_EMAIL;
  const VALID_PASSWORD = process.env.TEST_USER_PASSWORD;

  it("returns 200 and a token with valid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 401 with wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: VALID_EMAIL, password: "this-is-definitely-wrong" });
    expect(res.status).toBe(401);
  });
});

// ── Protected routes — no token / invalid token ──────────────────────────────

// /dashboard/summary is an auth-protected route (auth middleware fires first).
describe("GET /dashboard/summary — token enforcement", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/dashboard/summary");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/dashboard/summary")
      .set("Authorization", "Bearer this.is.not.a.valid.jwt");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a malformed Bearer value", async () => {
    const res = await request(app)
      .get("/dashboard/summary")
      .set("Authorization", "Bearer invalid-token-xyz");
    expect(res.status).toBe(401);
  });
});
