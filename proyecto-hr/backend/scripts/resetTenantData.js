import "dotenv/config";
import mongoose from "mongoose";
import { ensureInitialAccess } from "../utils/bootstrap.js";

const APP_COLLECTIONS = [
  "companies",
  "companysettings",
  "schools",
  "users",
  "roles",
  "permissions",
  "employees",
  "competencies",
  "metrics",
  "metriclevels",
  "evaluationcycles",
  "evaluations",
  "evaluationscores",
  "developmentplans",
  "downloadlogs",
  "auditlogs",
  "announcements",
  "databasefiles",
  "recordimports",
];

async function resetData() {
  if (!process.env.MONGO_URI) {
    throw new Error("Falta MONGO_URI en entorno");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const name of APP_COLLECTIONS) {
    const collection = db.collection(name);
    await collection.deleteMany({});
  }

  const { credentials } = await ensureInitialAccess();

  console.log("Reset completado");
  console.log(`Superadmin: ${credentials.email}`);
  console.log(`Password: ${credentials.password}`);
}

resetData()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Error en reset:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
