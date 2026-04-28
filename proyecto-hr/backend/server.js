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
