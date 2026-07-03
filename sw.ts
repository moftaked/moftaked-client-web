import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  onBackgroundMessage(messaging, (payload) => {
    const data = payload.data || {};
    const title = data.title || payload.notification?.title || "إشعار جديد";
    const body = data.body || payload.notification?.body || "";
    const icon = data.icon || "/icons/icon-192x192.png";

    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icons/icon-192x192.png",
      data: { url: data.url || "/" },
    });
  });
}

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matching = clients.find((c) => c.url.includes(url) && "focus" in c);
      if (matching) return matching.focus();
      return self.clients.openWindow(url);
    })
  );
});

const manifest: Array<{ url: string; revision: string | null } | string> =
  (self as any).__WB_MANIFEST || []

self.addEventListener("install", (event) => {
  event.waitUntil(installHandler())
})

async function installHandler() {
  if (manifest.length === 0) return

  const cache = await caches.open("precache-v1")
  const total = manifest.length

  for (let i = 0; i < total; i++) {
    const entry = manifest[i]
    const url = typeof entry === "string" ? entry : entry.url
    const revision = typeof entry === "string" ? null : entry.revision

    const requestUrl = new URL(url, self.location.href)
    if (revision) {
      requestUrl.searchParams.set("_rev", revision)
    }

    try {
      const response = await fetch(requestUrl.toString())
      if (response.ok || response.type === "opaqueredirect") {
        await cache.put(new Request(url), response)
      }
    } catch (e) {
      console.error("Failed to precache " + url, e)
    }

    const clients = await self.clients.matchAll({ includeUncontrolled: true })
    for (const client of clients) {
      client.postMessage({ type: "PRECACHE_PROGRESS", current: i + 1, total })
    }
  }
}

self.addEventListener("message", (event) => {
  if ((event as any).data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map((name) => {
          if (
            name.startsWith("workbox-") ||
            name === "static-assets-cache" ||
            name === "gstatic-fonts-cache"
          ) {
            return caches.delete(name)
          }
        })
      )
    })()
  )
})

self.addEventListener("fetch", (event: any) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      (async () => {
        const cache = await caches.open("google-fonts-cache")
        const cached = await cache.match(event.request)
        if (cached) return cached
        const response = await fetch(event.request)
        if (response.ok) {
          await cache.put(event.request, response.clone())
        }
        return response
      })()
    )
    return
  }

  if (url.origin !== self.location.origin) return

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open("precache-v1")
        const cachedIndex = await cache.match("index.html")
        return cachedIndex || fetch(event.request)
      })()
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open("precache-v1")
      const cached = await cache.match(event.request)
      return cached || fetch(event.request)
    })()
  )
})
