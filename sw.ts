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
