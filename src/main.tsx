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

function sanitizeMalformedUrlEncoding() {
  const { pathname, search, hash } = window.location;
  const raw = `${pathname}${search}${hash}`;

  const isDecodable = (value: string) => {
    try {
      decodeURI(value);
      return true;
    } catch {
      return false;
    }
  };

  const escapeBarePercents = (value: string) => value.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");

  const applyReplacement = (next: string) => {
    if (next === raw) return;
    try {
      window.history.replaceState(window.history.state, "", next);
    } catch {
      // Ignore; failing to replace URL is better than crashing startup.
    }
  };

  if (isDecodable(raw)) {
    return;
  }

  // First pass: only escape clearly malformed '%' sequences.
  const minimallyFixed = escapeBarePercents(raw);
  if (isDecodable(minimallyFixed)) {
    applyReplacement(minimallyFixed);
    return;
  }

  // Fallback: if decoding is still broken, escape all percents to avoid router crash loops.
  const fullyEscaped = raw.replace(/%/g, "%25");
  applyReplacement(fullyEscaped);
}

function shouldDropSentryNoise(message: string): boolean {
  return (
    /Large Render Blocking Asset/i.test(message) ||
    /Lock "lock:.*auth-token" was released/i.test(message) ||
    /Lock broken by another request with the 'steal' option/i.test(message)
  );
}

function getSentryEventMessages(event: any): string[] {
  const values = event.exception?.values ?? [];
  return [event.message, ...values.map((v) => `${v.type ?? ""} ${v.value ?? ""}`)].filter(
    (message): message is string => Boolean(message)
  );
}

// Force service worker registration for PWABuilder detection
registerSW({ immediate: true });

sanitizeMalformedUrlEncoding();

// Remove SSR bot content if a real user somehow hits the bot-render route
// (e.g. via WhatsApp/Discord in-app browser using a bot-like user-agent)
const ssrContent = document.getElementById("ssr-content");
if (ssrContent) {
  ssrContent.remove();
}

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
          "URI malformed",
          "Lock broken by another request with the 'steal' option.",
          "Connection to server unavailable",
          "Failed to execute 'insertBefore' on 'Node'",
          "Failed to execute 'removeChild' on 'Node'",
          "Error invoking postMessage: Java object is gone",
          "Failed to read the 'localStorage' property from 'Window'",
          /Lock "lock:.*auth-token" was released/i,
          /Large Render Blocking Asset/i,
        ],
        beforeSend(event) {
          const shouldDrop = getSentryEventMessages(event).some((message) => shouldDropSentryNoise(message));
          return shouldDrop ? null : event;
        },
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
