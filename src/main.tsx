import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";
import "./i18n";

// Force service worker registration for PWABuilder detection
registerSW({ immediate: true });

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      "Connection closed",
      "Access denied",
      "NetworkError when attempting to fetch resource.",
      "Failed to fetch",
    ],
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <Sentry.ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center p-4 text-center"><div className="space-y-4"><h1 className="text-2xl font-bold text-destructive">Something went wrong</h1><p className="text-muted-foreground">An unexpected error occurred. Our team has been notified.</p><button onClick={() => window.location.reload()} className="gum-btn bg-primary text-primary-foreground px-4 py-2 font-bold hover:scale-105 active:scale-95 transition-all">Reload Page</button></div></div>}>
      <App />
    </Sentry.ErrorBoundary>
    <Analytics />
    <SpeedInsights />
  </>
);
