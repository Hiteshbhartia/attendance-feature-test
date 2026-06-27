import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Helper to securely dispatch a push notification to a user's registered FCM devices.
 * Fail-safe: silently returns if Firebase is not initialized.
 * 
 * @param {string} toId - The userId or employeeId of the recipient
 * @param {string} title - The notification title
 * @param {string} body - The notification body
 */
export async function sendPushNotification(toId, title, body) {
  if (getApps().length === 0) return;
  if (!toId) return;

  try {
    const { FCMToken } = await import("../models/index.js");
    const tokens = await FCMToken.find({
      $or: [{ employeeId: toId }, { userId: toId }]
    }).lean();

    if (tokens.length > 0) {
      const message = {
        notification: {
          title: title || "Arena Notification",
          body: body || "You have a new system notification",
        },
        tokens: tokens.map((t) => t.token),
      };
      
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`[fcm] Push sent to ${toId}: ${response.successCount} success, ${response.failureCount} failed`);
    }
  } catch (e) {
    console.error("[fcm] Failed to send system push notification:", e);
  }
}
