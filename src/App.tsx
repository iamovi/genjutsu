// Genjutsu - a social network for developers where everything disappears after 24 hours
// Copyright (C) 2026 Ovi Ren (@iamovi) — https://github.com/iamovi/genjutsu
// This program is licensed under the GNU Affero General Public License v3.0
// See the LICENSE file or <https://www.gnu.org/licenses/> for details.

import { lazy, Suspense, useEffect } from "react";
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
import maintenanceConfig from "../maintenance.json";

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
const PlayPage = lazy(() => import("@/pages/PlayPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const StrangerPage = lazy(() => import("@/pages/StrangerPage"));
const MfaChallengePage = lazy(() => import("@/pages/MfaChallengePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

////////////////////////////////////////////////////////////////
const MAINTENANCE_MODE = maintenanceConfig.enabled;
///////////////////////////////////////////////////////////////////////////////////////////////

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    syncTime();
    const interval = setInterval(syncTime, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (MAINTENANCE_MODE) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="genjutsu-theme">
        <MaintenancePage />
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
