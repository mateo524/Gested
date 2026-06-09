import Notification from "../models/Notification.js";
import { pushNotification } from "../routes/notifications-feed.routes.js";

/**
 * Creates a notification for a user.
 * @param {Object} params
 * @param {string|import("mongoose").Types.ObjectId} params.userId
 * @param {string|import("mongoose").Types.ObjectId} params.companyId
 * @param {string} params.type  - e.g. "info", "warning", "success", "evaluation", "plan"
 * @param {string} params.title
 * @param {string} [params.body]
 * @param {string} [params.link]
 * @returns {Promise<import("../models/Notification.js").default>}
 */
export async function createNotification({ userId, companyId, type = "info", title, body = "", link = null }) {
  const notification = await Notification.create({ userId, companyId, type, title, body, link });
  pushNotification(userId, notification);
  return notification;
}
