// Genjutsu - a social network for developers where everything disappears after 24 hours
// Copyright (C) 2026 Ovi Ren (@iamovi) — https://github.com/iamovi/genjutsu
// This program is licensed under the GNU Affero General Public License v3.0
// See the LICENSE file or <https://www.gnu.org/licenses/> for details.

import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { MaintenancePage } from "@/components/MaintenancePage";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/theme-provider";
import { syncTime } from "@/lib/utils";
import ScrollToTop from "@/components/ScrollToTop";
import RequireAdmin from "@/components/RequireAdmin";
import { CursorTrail } from "@/components/CursorTrail";
import { SoundEngine } from "@/hooks/useSound";
import { ShadowWalkEngine } from "@/components/ShadowWalk";
import { AppLockGate } from "@/components/AppLockGate";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { FloatingWhisperBubble } from "@/components/FloatingWhisperBubble";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import MfaSessionGuard from "@/components/MfaSessionGuard";

const lazyWithRetry = <T extends { default: ComponentType<any> }>(
  importer: () => Promise<T>,
  key: string
) =>
  lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const err = error as Error;
      const message = err?.message || "";
      const isChunkError =
        message.includes("Importing a module script failed") ||
        message.includes("Failed to fetch dynamically imported module");

      if (isChunkError && typeof window !== "undefined") {
        try {
          const reloadKey = `lazy-retried-${key}`;
          const hasRetried = sessionStorage.getItem(reloadKey) === "1";

          if (!hasRetried) {
            sessionStorage.setItem(reloadKey, "1");
            window.location.reload();
          } else {
            sessionStorage.removeItem(reloadKey);
          }
        } catch {
          // If storage is unavailable (private mode/policy), still attempt one refresh.
          window.location.reload();
        }
      }

      throw error;
    }
  });

import Index from "@/pages/Index";
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const PostPage = lazy(() => import("@/pages/PostPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const WhispersPage = lazy(() => import("@/pages/WhispersPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const CommunityChat = lazy(() => import("@/pages/CommunityChat"));
const PlayPage = lazyWithRetry(() => import("@/pages/PlayPage"), "play-page");
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const StrangerPage = lazy(() => import("@/pages/StrangerPage"));
const MfaChallengePage = lazy(() => import("@/pages/MfaChallengePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

interface RuntimeController {
  maintenance?: boolean;
  maintenanceMessage?: string;
}

const queryClient = new QueryClient();

const App = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  useEffect(() => {
    syncTime();
    const interval = setInterval(syncTime, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const controllerUrl = `/api/controller?t=${Date.now()}`;

    fetch(controllerUrl, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as RuntimeController;
        setMaintenanceMode(Boolean(data?.maintenance));
        setMaintenanceMessage(typeof data?.maintenanceMessage === "string" ? data.maintenanceMessage : "");
      })
      .catch(() => {
        setMaintenanceMode(false);
        setMaintenanceMessage("");
      });
  }, []);

  if (maintenanceMode) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="genjutsu-theme">
        <MaintenancePage message={maintenanceMessage} />
      </ThemeProvider>
    );
  }

  return (
    <HelmetProvider>
      <ThemeProvider defaultTheme="light" storageKey="genjutsu-theme">
        <CursorTrail />
        <SoundEngine />
        <ShadowWalkEngine />
        <AppLockGate>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <ScrollToTop />
              <GoogleAnalytics />
              <AuthProvider>
                <MfaSessionGuard />
                <FloatingWhisperBubble />
                <PushNotificationPrompt />
                <Suspense
                  fallback={
                    <div className="flex h-screen items-center justify-center">
                      <FrogLoader size={32} />
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/auth/mfa" element={<MfaChallengePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/post/:postId" element={<PostPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/whispers" element={<WhispersPage />} />
                    <Route path="/whispers/community" element={<CommunityChat />} />
                    <Route path="/whisper/:username" element={<ChatPage />} />
                    <Route path="/stranger" element={<StrangerPage />} />
                    <Route path="/play" element={<PlayPage />} />
                    <Route
                      path="/admin"
                      element={(
                        <RequireAdmin>
                          <AdminPage />
                        </RequireAdmin>
                      )}
                    />
                    <Route path="/u/:username" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
        </AppLockGate>
      </ThemeProvider>
    </HelmetProvider>
  );
};

export default App;
