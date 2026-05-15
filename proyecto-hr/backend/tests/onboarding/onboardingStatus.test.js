import test from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDING_STEPS,
  applyOnboardingStepTransition,
  buildOnboardingStatusPayload,
} from "../../routes/onboarding.routes.js";

test("buildOnboardingStatusPayload calcula progreso correctamente", () => {
  const payload = buildOnboardingStatusPayload({
    onboarding: {
      steps: {
        configure_organization: { completedAt: new Date("2026-05-15T10:00:00.000Z") },
        create_cycle: { completedAt: new Date("2026-05-15T11:00:00.000Z") },
      },
    },
  });

  assert.equal(payload.steps.length, ONBOARDING_STEPS.length);
  assert.equal(payload.progress.completed, 2);
  assert.equal(payload.progress.pending, ONBOARDING_STEPS.length - 2);
  assert.equal(payload.completedAll, false);
});

test("applyOnboardingStepTransition completa un paso", () => {
  const nextSteps = applyOnboardingStepTransition({
    currentSteps: {},
    stepKey: "import_employees",
    mode: "complete",
    userId: "user-1",
  });

  assert.ok(nextSteps.import_employees.completedAt);
  assert.equal(nextSteps.import_employees.updatedBy, "user-1");
});

test("applyOnboardingStepTransition reabre un paso", () => {
  const nextSteps = applyOnboardingStepTransition({
    currentSteps: {
      import_employees: { completedAt: new Date("2026-05-15T10:00:00.000Z") },
    },
    stepKey: "import_employees",
    mode: "reopen",
    userId: "user-2",
  });

  assert.equal(nextSteps.import_employees.completedAt, null);
  assert.equal(nextSteps.import_employees.updatedBy, "user-2");
});

test("applyOnboardingStepTransition rechaza stepKey invalido", () => {
  assert.throws(
    () =>
      applyOnboardingStepTransition({
        currentSteps: {},
        stepKey: "unknown-step",
        mode: "complete",
        userId: "user-1",
      }),
    /Paso de onboarding invalido/
  );
});
