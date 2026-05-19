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
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import { AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/PageWrapper";

const Index = lazy(() => import("@/pages/Index"));
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
const UpdatePasswordPage = lazy(() => import("@/pages/UpdatePasswordPage"));
const GameHouseGallery = lazy(() => import("@/pages/GameHouseGallery"));
const GameHouseSubmit = lazy(() => import("@/pages/GameHouseSubmit"));
const GameHouseEdit = lazy(() => import("@/pages/GameHouseEdit"));
const GameHousePlay = lazy(() => import("@/pages/GameHousePlay"));
const QnaPage = lazy(() => import("@/pages/QnaPage"));
const QnaInbox = lazy(() => import("@/pages/QnaInbox"));
const NotFound = lazy(() => import("@/pages/NotFound"));

////////////////////////////////////////////////////////////////
const MAINTENANCE_MODE = false;
///////////////////////////////////////////////////////////////////////////////////////////////

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Index /></PageWrapper>} />
        <Route path="/auth" element={<PageWrapper><AuthPage /></PageWrapper>} />
        <Route path="/auth/mfa" element={<PageWrapper><MfaChallengePage /></PageWrapper>} />
        <Route path="/auth/update-password" element={<PageWrapper><UpdatePasswordPage /></PageWrapper>} />
        <Route path="/about" element={<PageWrapper><AboutPage /></PageWrapper>} />
        <Route path="/terms" element={<PageWrapper><TermsPage /></PageWrapper>} />
        <Route path="/privacy" element={<PageWrapper><PrivacyPage /></PageWrapper>} />
        <Route path="/post/:postId" element={<PageWrapper><PostPage /></PageWrapper>} />
        <Route path="/search" element={<PageWrapper><SearchPage /></PageWrapper>} />
        <Route path="/whispers" element={<PageWrapper><WhispersPage /></PageWrapper>} />
        <Route path="/whispers/community" element={<PageWrapper><CommunityChat /></PageWrapper>} />
        <Route path="/whisper/:username" element={<PageWrapper><ChatPage /></PageWrapper>} />
        <Route path="/stranger" element={<PageWrapper><StrangerPage /></PageWrapper>} />
        <Route path="/play" element={<PageWrapper><PlayPage /></PageWrapper>} />
        <Route path="/game-house" element={<PageWrapper><GameHouseGallery /></PageWrapper>} />
        <Route path="/game-house/submit" element={<PageWrapper><GameHouseSubmit /></PageWrapper>} />
        <Route path="/game-house/edit/:id" element={<PageWrapper><GameHouseEdit /></PageWrapper>} />
        <Route path="/game-house/play/:id" element={<PageWrapper><GameHousePlay /></PageWrapper>} />
        <Route path="/qna/:username" element={<PageWrapper><QnaPage /></PageWrapper>} />
        <Route path="/qna-inbox" element={<PageWrapper><QnaInbox /></PageWrapper>} />
        <Route
          path="/admin"
          element={(
            <PageWrapper>
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            </PageWrapper>
          )}
        />
        <Route path="/u/:username" element={<PageWrapper><ProfilePage /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><SettingsPage /></PageWrapper>} />
        <Route path="*" element={<PageWrapper><NotFound /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
};

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
                    <AppRoutes />
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
