import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import exportRoutes from "./routes/export.routes.js";
import recordsRoutes from "./routes/records.routes.js";
import developmentPlansRoutes from "./routes/developmentPlans.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Mantener MongoDB activo (evita cold start en Atlas free tier)
const MONGO_OPTS = {
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 60000,
  serverSelectionTimeoutMS: 15000,
};

mongoose
  .connect(process.env.MONGO_URI, MONGO_OPTS)
  .then(() => {
    console.log("MongoDB conectado");
    // Ping cada 4 minutos para evitar que Atlas suspenda la conexión
    setInterval(() => {
      mongoose.connection.db?.admin().ping();
    }, 240000);
  })
  .catch((err) => console.log("Error MongoDB:", err));

// Health check público (para que el frontend despierte la DB)
app.get("/health", async (req, res) => {
  try {
    await mongoose.connection.db?.admin().ping();
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "connecting" });
  }
});

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);
app.use("/audit", auditRoutes);
app.use("/settings", settingsRoutes);
app.use("/export", exportRoutes);
app.use("/records", recordsRoutes);
app.use("/development-plans", developmentPlansRoutes);

app.get("/", (req, res) => {
  res.send("API RRHH PRO funcionando");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor corriendo en puerto ${process.env.PORT || 3000}`);
});
