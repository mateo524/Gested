import "dotenv/config";
import mongoose from "mongoose";
import { ensureInitialAccess } from "../utils/bootstrap.js";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const dbName = mongoose.connection.db.databaseName;
    console.log(`Conectado a MongoDB: ${dbName}`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const collection of collections) {
      if (collection.name.startsWith("system.")) continue;
      await mongoose.connection.db.collection(collection.name).deleteMany({});
    }
    console.log(`Colecciones limpiadas: ${collections.map((c) => c.name).join(", ")}`);

    const { credentials } = await ensureInitialAccess();
    console.log("=================================");
    console.log("SUPERADMIN RECREADO");
    console.log(`Email: ${credentials.email}`);
    console.log(`Password: ${credentials.password}`);
    console.log("=================================");
    process.exit(0);
  } catch (error) {
    console.error("Error en reset total:", error);
    process.exit(1);
  }
}

run();
