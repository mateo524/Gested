import express from "express";
import jwt from "jsonwebtoken";
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

export const sseClients = new Map(); // userId → response object

export function pushNotification(userId, notification) {
  const client = sseClients.get(String(userId));
  if (client) {
    client.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  }
}

// GET /notifications-feed/feed
// Returns the last 20 notifications for the authenticated user.
router.get("/feed", auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = notifications.filter((n) => !n.read).length;

    return res.json({
      ok: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "No pudimos cargar las notificaciones.",
    });
  }
});

// PATCH /notifications-feed/feed/read
// Marks all notifications as read for the authenticated user.
router.patch("/feed/read", auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "No pudimos marcar las notificaciones como leídas.",
    });
  }
});

// GET /notifications-feed/stream — SSE endpoint
// Accepts token via Authorization header or ?token= query param (EventSource limitation).
router.get("/stream", (req, res) => {
  // Support token via query param for EventSource clients
  let user;
  try {
    const token =
      req.query.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);
    if (!token) return res.status(401).json({ mensaje: "No autorizado" });
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ mensaje: "Token inválido" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const userId = String(user._id || user.userId || user.id);

  // Send initial ping
  res.write("event: ping\ndata: {}\n\n");

  // Register this client
  sseClients.set(userId, res);

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(userId);
  });
});

export default router;
