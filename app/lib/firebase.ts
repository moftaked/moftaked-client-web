import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import api from "./api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function initFirebase(): boolean {
  if (!firebaseConfig.apiKey) return false;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  try {
    messaging = getMessaging(app);
  } catch {
    return false;
  }
  return true;
}

export async function registerFcmToken(): Promise<void> {
  if (!messaging) {
    if (!initFirebase()) return;
  }
  if (!messaging) return;
  try {
    const swRegistration = await navigator.serviceWorker.ready;
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (currentToken) {
      await api.post("/notifications/fcm-tokens", { token: currentToken });
    }
  } catch {
    // FCM token registration failed — notifications may not work
  }
}

export async function unregisterFcmToken(): Promise<void> {
  if (!messaging) return;
  try {
    const currentToken = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
    if (currentToken) {
      await api.delete(`/notifications/fcm-tokens/${encodeURIComponent(currentToken)}`);
    }
  } catch {
    // Best-effort
  }
}

export function onForegroundMessage(cb: (payload: any) => void): () => void {
  if (!messaging) {
    if (!initFirebase()) return () => {};
  }
  if (!messaging) return () => {};
  const unsubscribe = onMessage(messaging, cb);
  return unsubscribe;
}
