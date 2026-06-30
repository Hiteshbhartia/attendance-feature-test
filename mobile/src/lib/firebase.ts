import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { api } from "./api-client";
import { Alert } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if config is provided
const isConfigured = !!firebaseConfig.apiKey;

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const messaging = isConfigured && typeof window !== "undefined" ? getMessaging(app!) : null;

export async function requestNotificationPermissionAndGetToken() {
  if (!messaging) {
    console.warn("[fcm] Firebase is not configured.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      // Wait for the service worker to become active before trying to subscribe
      await navigator.serviceWorker.ready;

      // If there is an installing worker, wait for it to activate
      if (registration.installing) {
        await new Promise<void>((resolve) => {
          registration.installing?.addEventListener('statechange', (e: any) => {
            if (e.target.state === 'activated') {
              resolve();
            }
          });
        });
      }
      
      const token = await getToken(messaging, {
        vapidKey: process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log("[fcm] Token generated successfully (hidden for security).");
        // Send the token to the server to save it
        await api.post("/fcm/register", { token });
        return token;
      } else {
        console.warn("[fcm] No registration token available.");
      }
    } else {
      console.warn("[fcm] Notification permission denied.");
    }
  } catch (err) {
    console.error("[fcm] An error occurred while retrieving token:", err);
  }
  return null;
}

if (messaging) {
  onMessage(messaging, (payload) => {
    console.log("[fcm] Message received in foreground:", payload);
    const title = payload.notification?.title || "New Notification";
    const body = payload.notification?.body || "You have a new message.";
    Alert.alert(title, body);
  });
}
