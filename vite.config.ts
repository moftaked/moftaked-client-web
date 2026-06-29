import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

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
        strategies: "injectManifest",
        srcDir: ".",
        filename: "sw.ts",
        registerType: "prompt",
        includeAssets: ["favicon.ico", "icons/*.png", "icons/*.jpg", "fonts/**/*"],
        manifest: false,
        devOptions: {
          type: "module",
        },
        workbox: {},
        injectManifest: {
          globPatterns: isDev ? [] : ["**/*.{js,css,ico,png,svg,woff,woff2}"],
          // Explicitly precache index.html via additionalManifestEntries to
          // avoid the React Router SPA-mode build timing issue where
          // index.html is generated after Workbox's glob scan completes.
          // Date.now() revision ensures it is refreshed on every build.
          additionalManifestEntries: isDev
            ? []
            : [{ url: "index.html", revision: Date.now().toString() }],
        },
      }),
    ],
  };
});
