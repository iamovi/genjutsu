// Genjutsu - a social network for developers where everything disappears after 24 hours
// Copyright (C) 2026 Ovi Ren (@iamovi) — https://github.com/iamovi/genjutsu
// This program is licensed under the GNU Affero General Public License v3.0
// See the LICENSE file or <https://www.gnu.org/licenses/> for details.

import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";
import "./i18n";
import { loadConfig, getConfig } from "@/lib/config";

// Force service worker registration for PWABuilder detection
registerSW({ immediate: true });

loadConfig()
  .then(() => {
    const config = getConfig();
    if (config.VITE_SENTRY_DSN) {
      Sentry.init({
        dsn: config.VITE_SENTRY_DSN,
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
          "Failed to execute 'insertBefore' on 'Node'",
          "Failed to execute 'removeChild' on 'Node'",
          "Error invoking postMessage: Java object is gone",
          "Failed to read the 'localStorage' property from 'Window'",
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
  })
  .catch((err) => {
    console.error("Fatal: Failed to load app config.", err);
    // Render a minimal error page so users don't see a blank white screen
    document.getElementById("root")!.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;background:#0a0a0a;color:#fff;text-align:center;padding:2rem;">
        <div>
          <h1 style="font-size:1.5rem;font-weight:bold;color:#ef4444;margin-bottom:0.5rem;">Failed to load Genjutsu</h1>
          <p style="color:#888;font-size:0.9rem;margin-bottom:1.5rem;">Could not connect to the configuration service. Please check your internet connection and try again.</p>
          <button onclick="window.location.reload()" style="background:#7c3aed;color:#fff;padding:0.6rem 1.5rem;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Retry</button>
        </div>
      </div>
    `;
  });

