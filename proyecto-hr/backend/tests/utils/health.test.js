import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthStatus, mapMongooseReadyState } from "../../utils/health.js";

test("buildHealthStatus devuelve payload base consistente", () => {
  const payload = buildHealthStatus("performia-backend", {
    databaseReadyState: 1,
    nodeEnv: "test",
    uptimeSeconds: 123,
    version: "9.9.9-test",
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.service, "performia-backend");
  assert.equal(payload.status, "ok");
  assert.equal(payload.env, "test");
  assert.equal(payload.uptimeSeconds, 123);
  assert.equal(payload.version, "9.9.9-test");
  assert.deepEqual(payload.database, {
    ok: true,
    state: "connected",
  });
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("buildHealthStatus marca error cuando la base no esta conectada", () => {
  const payload = buildHealthStatus("performia-backend", {
    databaseReadyState: 0,
    nodeEnv: "test",
  });

  assert.equal(payload.ok, false);
  assert.equal(payload.status, "error");
  assert.deepEqual(payload.database, {
    ok: false,
    state: "disconnected",
  });
});

test("mapMongooseReadyState traduce estados conocidos y desconocidos", () => {
  assert.equal(mapMongooseReadyState(1), "connected");
  assert.equal(mapMongooseReadyState(2), "connecting");
  assert.equal(mapMongooseReadyState(0), "disconnected");
  assert.equal(mapMongooseReadyState(3), "disconnected");
  assert.equal(mapMongooseReadyState(999), "unknown");
});
