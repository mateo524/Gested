export function buildHealthStatus(service, extras = {}) {
  return {
    ok: true,
    service,
    timestamp: new Date().toISOString(),
    ...extras,
  };
}
