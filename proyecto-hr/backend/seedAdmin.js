import "dotenv/config";
import mongoose from "mongoose";
import { ensureInitialAccess } from "./utils/bootstrap.js";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB conectado para seed");

    const { credentials } = await ensureInitialAccess();

    console.log("=================================");
    console.log("LOGIN INICIAL");
    console.log(`Email: ${credentials.email}`);
    console.log(`Password: ${credentials.password}`);
    console.log("=================================");

    process.exit(0);
  } catch (error) {
    console.error("Error en seed:", error);
    process.exit(1);
  }
}

run();
