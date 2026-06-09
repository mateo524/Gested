// Fire-and-forget background task runner.
// Use for operations that shouldn't block the HTTP response.
export function runInBackground(fn, label = "task") {
  Promise.resolve()
    .then(fn)
    .catch(err => console.error(`[background:${label}] Error:`, err.message));
}
