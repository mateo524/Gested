import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import companiesRoutes from "./routes/companies.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import exportRoutes from "./routes/export.routes.js";
import recordsRoutes from "./routes/records.routes.js";
import storageRoutes from "./routes/storage.routes.js";
import announcementsRoutes from "./routes/announcements.routes.js";
import searchRoutes from "./routes/search.routes.js";
import employeesRoutes from "./routes/employees.routes.js";
import competenciesRoutes from "./routes/competencies.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import schoolsRoutes from "./routes/schools.routes.js";
import evaluationCyclesRoutes from "./routes/evaluationCycles.routes.js";
import evaluationsRoutes from "./routes/evaluations.routes.js";
import educationExportsRoutes from "./routes/educationExports.routes.js";
import developmentPlansRoutes from "./routes/developmentPlans.routes.js";
import { ensureInitialAccess } from "./utils/bootstrap.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/companies", companiesRoutes);
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);
app.use("/audit", auditRoutes);
app.use("/settings", settingsRoutes);
app.use("/export", exportRoutes);
app.use("/records", recordsRoutes);
app.use("/storage", storageRoutes);
app.use("/announcements", announcementsRoutes);
app.use("/search", searchRoutes);
app.use("/employees", employeesRoutes);
app.use("/competencies", competenciesRoutes);
app.use("/metrics", metricsRoutes);
app.use("/schools", schoolsRoutes);
app.use("/evaluation-cycles", evaluationCyclesRoutes);
app.use("/evaluations", evaluationsRoutes);
app.use("/education-exports", educationExportsRoutes);
app.use("/development-plans", developmentPlansRoutes);

app.get("/", (req, res) => {
  res.send("API RRHH PRO funcionando");
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB conectado");

    const { credentials } = await ensureInitialAccess();
    console.log(`Admin inicial listo: ${credentials.email}`);

    app.listen(process.env.PORT || 3000, () => {
      console.log(`Servidor corriendo en puerto ${process.env.PORT || 3000}`);
    });
  } catch (err) {
    console.log("Error MongoDB:", err);
    process.exit(1);
  }
}

start();
