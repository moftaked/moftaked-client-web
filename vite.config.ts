import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

const runtimeCaching = [
  // Catch-all for same-origin JS/CSS assets that React Router may generate
  // AFTER Workbox's glob scan (e.g. manifest-*.js). CacheFirst is safe here
  // because every file is content-hashed — a new hash means a new URL.
  {
    urlPattern: /\/assets\/.*\.(js|css)$/,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "static-assets-cache",
      expiration: {
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "google-fonts-cache",
      expiration: {
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "gstatic-fonts-cache",
      expiration: {
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      },
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  },
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDev = mode === "development";
  const enableSwDev = env.VITE_ENABLE_SW_DEV === "true";

  return {
    plugins: [
      tailwindcss(),
      reactRouter(),
      tsconfigPaths(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.ico", "icons/*.png", "icons/*.jpg", "fonts/**/*"],
        manifest: false,
        devOptions: {
          type: "module",
        },
        workbox: {
          globPatterns: isDev ? [] : ["**/*.{js,css,ico,png,svg,woff,woff2}"],
          // Explicitly precache index.html via additionalManifestEntries to
          // avoid the React Router SPA-mode build timing issue where
          // index.html is generated after Workbox's glob scan completes.
          // Date.now() revision ensures it is refreshed on every build.
          additionalManifestEntries: isDev
            ? []
            : [{ url: "index.html", revision: Date.now().toString() }],
          // Serve the precached index.html for all navigation requests so
          // that SPA client-side routing works on hard refresh / direct URL
          // access, even when the static file server has no SPA fallback.
          navigateFallback: isDev ? undefined : "index.html",
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching,
        },
      }),
    ],
  };
});
