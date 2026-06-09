// Called once on server startup to ensure all performance indexes exist.
// MongoDB only creates indexes if they don't already exist (idempotent).
export async function ensureIndexes() {
  const { default: User } = await import("../models/User.js");
  const { default: Employee } = await import("../models/Employee.js");
  const { default: Evaluation } = await import("../models/Evaluation.js");
  const { default: EvaluationCycle } = await import("../models/EvaluationCycle.js");
  const { default: DevelopmentPlan } = await import("../models/DevelopmentPlan.js");
  const { default: Notification } = await import("../models/Notification.js");

  await Promise.all([
    // Users: login by email, list by company
    User.collection.createIndex({ email: 1 }, { unique: true, background: true }),
    User.collection.createIndex({ companyId: 1, activo: 1 }, { background: true }),

    // Employees: list by company, search by name
    Employee.collection.createIndex({ companyId: 1, activo: 1 }, { background: true }),
    Employee.collection.createIndex({ companyId: 1, area: 1 }, { background: true }),

    // Evaluations: the most queried collection
    Evaluation.collection.createIndex({ companyId: 1, cycleId: 1 }, { background: true }),
    Evaluation.collection.createIndex({ companyId: 1, employeeId: 1 }, { background: true }),
    Evaluation.collection.createIndex({ evaluatorUserId: 1, estado: 1 }, { background: true }),
    Evaluation.collection.createIndex({ companyId: 1, estado: 1, createdAt: -1 }, { background: true }),

    // Cycles: active cycle lookup
    EvaluationCycle.collection.createIndex({ companyId: 1, estado: 1 }, { background: true }),

    // Development plans: by employee and status
    DevelopmentPlan.collection.createIndex({ companyId: 1, employeeId: 1 }, { background: true }),
    DevelopmentPlan.collection.createIndex({ companyId: 1, estado: 1, fechaSeguimiento: 1 }, { background: true }),

    // Notifications: user feed, sorted by date
    Notification.collection.createIndex({ userId: 1, createdAt: -1 }, { background: true }),
    Notification.collection.createIndex({ userId: 1, read: 1 }, { background: true }),
  ]);

  console.log("[indexes] All indexes ensured");
}
