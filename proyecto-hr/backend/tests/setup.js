import mongoose from "mongoose";
import { beforeAll, afterAll } from "vitest";

// Use a real test DB or mock mongoose
beforeAll(async () => {
  // If MONGO_URI_TEST is set, connect; otherwise mock
  const uri = process.env.MONGO_URI_TEST;
  if (uri) {
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
