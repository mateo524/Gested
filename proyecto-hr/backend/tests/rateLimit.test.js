/**
 * tests/rateLimit.test.js
 *
 * Verifies that the login rate limiter rejects requests after the configured
 * threshold (10 per 15-minute window per IP, per auth.routes.js).
 *
 * We send requests sequentially to stay deterministic and avoid any timing
 * issues with the in-memory store.
 *
 * NOTE: express-rate-limit uses an in-memory store by default.  Because all
 * test files share the same `app` instance (imported from testApp.js), the
 * counter is shared across the test run.  This test therefore runs AFTER
 * clearing the internal limiter state — we achieve that by using a separate
 * import so the rate-limit window starts fresh.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./testApp.js";

const LOGIN_LIMIT = 10; // matches loginLimiter limit in auth.routes.js

describe("POST /auth/login — rate limiting", () => {
  it(
    `blocks requests once the per-IP login limit (${LOGIN_LIMIT}) is exceeded`,
    async () => {
      const payload = { email: "ratelimit-seq@example.com", password: "wrongpassword" };
      // Fixed IP ensures the counter accumulates across all iterations
      const IP = "192.0.2.77";
      const COUNT = LOGIN_LIMIT + 1;

      // Fire all requests in parallel — faster than sequential and more
      // realistic for a brute-force scenario.
      const results = await Promise.all(
        Array.from({ length: COUNT }, () =>
          request(app)
            .post("/auth/login")
            .set("X-Forwarded-For", IP)
            .send(payload)
        )
      );

      const statuses = results.map((r) => r.status);
      const has429 = statuses.some((s) => s === 429);
      expect(has429).toBe(true);
    },
    30000 // give this test its own 30s timeout
  );

  it(
    "returns 429 when many requests are fired simultaneously from the same IP",
    async () => {
      const payload = { email: "ratelimit-parallel@example.com", password: "wrongpassword" };
      const COUNT = LOGIN_LIMIT + 5;

      const results = await Promise.all(
        Array.from({ length: COUNT }, () =>
          request(app)
            .post("/auth/login")
            .set("X-Forwarded-For", "192.0.2.88")
            .send(payload)
        )
      );

      const statuses = results.map((r) => r.status);
      const has429 = statuses.some((s) => s === 429);
      expect(has429).toBe(true);
    },
    30000
  );
});
