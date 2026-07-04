import express from "express";
import { app as backendApp } from "../backend/server.js";

const app = express();
app.use("/api", backendApp);

export default app;
