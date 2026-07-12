import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import ScrollRestoration from "@/components/ScrollRestoration";
import EdgeSwipeBack from "@/components/EdgeSwipeBack";
import RouteTransition from "@/components/RouteTransition";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import { PushNotificationsHandler } from "@/components/PushNotificationsHandler";
import UsernameSetupGate from "@/components/UsernameSetupGate";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import HomePage from "./pages/HomePage";
import WelcomePage from "./pages/WelcomePage";

// Keep the two Mapbox globe routes eagerly loaded. In the native WebView,
// splitting these route modules can leave the globe canvases mounted but blank.
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const AddPlacePage = lazy(() => import("./pages/AddPlacePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LoggedPlacesPage = lazy(() => import("./pages/LoggedPlacesPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const PlacePage = lazy(() => import("./pages/PlacePage"));
const ReviewDetailPage = lazy(() => import("./pages/ReviewDetailPage"));
const PlaceSubPage = lazy(() => import("./pages/PlaceSubPage"));
const CountryCitiesPage = lazy(() => import("./pages/CountryCitiesPage"));
const ExploreListPage = lazy(() => import("./pages/ExploreListPage"));
const ListDetailPage = lazy(() => import("./pages/ListDetailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const DeleteAccountPage = lazy(() => import("./pages/DeleteAccountPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mustCompletePasswordReset } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  if (mustCompletePasswordReset) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, mustCompletePasswordReset } = useAuth();

  return (
    <div className="max-w-lg mx-auto relative min-h-screen">
      <ScrollRestoration />
      <EdgeSwipeBack />
      <RouteTransition />
      <DeepLinkHandler />
      {user && <PushNotificationsHandler />}
      {/* Status-bar scrim: subtle fade under the clock/Dynamic Island so
          content scrolling beneath never collides with the system text.
          Outside the route container so gestures don't move it. */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 z-40 pointer-events-none"
        style={{
          height: "calc(env(safe-area-inset-top, 0px) + 24px)",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
        }}
      />
      {/* Wrapper targeted by EdgeSwipeBack: the interactive swipe-back
          gesture translates this element with the finger */}
      <div id="route-container">
      <Suspense fallback={null}>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="/support" element={<SupportPage />} />

          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/explore" element={<ProtectedRoute><ExplorePage /></ProtectedRoute>} />
          <Route path="/explore/list" element={<ProtectedRoute><ExploreListPage /></ProtectedRoute>} />
          <Route path="/add" element={<ProtectedRoute><AddPlacePage /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/logged-places" element={<ProtectedRoute><LoggedPlacesPage /></ProtectedRoute>} />
          <Route path="/place/:id" element={<ProtectedRoute><PlacePage /></ProtectedRoute>} />
          <Route path="/review/:reviewId" element={<ProtectedRoute><ReviewDetailPage /></ProtectedRoute>} />
          <Route path="/place/:id/:section" element={<ProtectedRoute><PlaceSubPage /></ProtectedRoute>} />
          <Route path="/country/:countryName/cities" element={<ProtectedRoute><CountryCitiesPage /></ProtectedRoute>} />
          <Route path="/list/:listId" element={<ProtectedRoute><ListDetailPage /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </div>
      {user && !mustCompletePasswordReset && <BottomNav />}
      <UsernameSetupGate />
    </div>
  );
}

// Shared request cache: screens render instantly from cached data on
// back-navigation while a background refetch keeps everything fresh
// (staleTime 0 = always revalidate on mount, never show a spinner if
// cached data exists). The cache is persisted to localStorage so a cold
// app launch also paints the last known Home/Place content immediately,
// then silently revalidates.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Instagram-style resume freshness: when the app returns to the foreground
// after a meaningful background period, silently revalidate all cached
// queries. Data updates in place — no spinners, no visible reload.
if (typeof window !== "undefined") {
  const RESUME_REFRESH_AFTER_MS = 60 * 1000;
  let backgroundedAt: number | null = null;
  import("@capacitor/app").then(({ App: CapApp }) => {
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        backgroundedAt = Date.now();
        return;
      }
      if (backgroundedAt !== null && Date.now() - backgroundedAt >= RESUME_REFRESH_AFTER_MS) {
        void queryClient.invalidateQueries();
      }
      backgroundedAt = null;
    });
  }).catch(() => {});
}

// Warm the lazy route chunks during idle time right after startup, so the
// first navigation to each tab never waits on a chunk load (chunks are local
// files in Capacitor, but the parse/execute still causes a brief blank).
if (typeof window !== "undefined") {
  const warmRouteChunks = () => {
    void import("./pages/ExplorePage");
    void import("./pages/SearchPage");
    void import("./pages/ProfilePage");
    void import("./pages/AddPlacePage");
    void import("./pages/PlacePage");
    void import("./pages/LoggedPlacesPage");
  };
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(warmRouteChunks, { timeout: 5000 });
  } else {
    // WKWebView has no requestIdleCallback
    window.setTimeout(warmRouteChunks, 2500);
  }
}

const queryPersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "stampaway_rq_cache_v1",
  throttleTime: 2000,
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v1",
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <AppRoutes />
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
