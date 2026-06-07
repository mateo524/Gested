import express from "express";
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

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

export default router;
