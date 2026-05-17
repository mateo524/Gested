import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthStatus } from "../../utils/health.js";

test("buildHealthStatus devuelve payload base consistente", () => {
  const payload = buildHealthStatus("performia-backend", { mongoConnected: true, nodeEnv: "test" });

  assert.equal(payload.ok, true);
  assert.equal(payload.service, "performia-backend");
  assert.equal(payload.mongoConnected, true);
  assert.equal(payload.nodeEnv, "test");
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
