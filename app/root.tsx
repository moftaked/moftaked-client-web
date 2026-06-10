import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from "react-router";
import { useEffect } from "react";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeProvider } from "./components/theme-provider";
import { NavigationProvider } from "./contexts/navigation-context";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
  { rel: "apple-touch-icon", href: "/icons/apple-icon-180.jpg" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>moftaked</title>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  const isPageLoading = navigation.state === "loading";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const registerPWA = () => {
        import("virtual:pwa-register").then(({ registerSW }) => {
          const updateSW = registerSW({
            onNeedRefresh() {
              const toastId = toast("يتوفر تحديث جديد", {
                description: "انقر للتحديث وإعادة التحميل",
                action: {
                  label: "تحديث",
                  onClick: () => {
                    toast.dismiss(toastId);
                    updateSW();
                  },
                },
                duration: Infinity,
              });
            },
            onOfflineReady() {
              toast("التطبيق جاهز للعمل بدون إنترنت", {
                duration: 5000,
              });
            },
          });
        }).catch(() => {
          // SW registration not available or unsupported browser
        });
      };

      if (import.meta.env.DEV) {
        // In dev mode, clean up any stale production service workers
        // (e.g. leftover sw.js from a previous production build)
        // before registering the dev SW.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          const stale = registrations.filter(
            (r) => !r.active?.scriptURL?.includes("dev-sw")
          );
          return Promise.all(stale.map((r) => r.unregister()));
        }).then(() => {
          registerPWA();
        });
      } else {
        registerPWA();
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.visualViewport) {
      const updateVisualViewport = () => {
        if (!window.visualViewport) return;
        document.documentElement.style.setProperty(
          "--visual-viewport-height",
          `${window.visualViewport.height}px`
        );
      };
      window.visualViewport.addEventListener("resize", updateVisualViewport);
      window.visualViewport.addEventListener("scroll", updateVisualViewport);
      updateVisualViewport();

      return () => {
        window.visualViewport?.removeEventListener("resize", updateVisualViewport);
        window.visualViewport?.removeEventListener("scroll", updateVisualViewport);
      };
    }
  }, []);


  return (
    <ThemeProvider>
      <NavigationProvider>
        {isPageLoading && (
          <div className="fixed top-0 left-0 right-0 h-[3px] bg-muted/20 z-[9999] overflow-hidden">
            <div className="h-full bg-primary animate-route-loading w-1/2 origin-left" />
          </div>
        )}
        <Outlet />
        <Toaster />
      </NavigationProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
