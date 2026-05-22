import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import ScrollRestoration from "@/components/ScrollRestoration";
import EdgeSwipeBack from "@/components/EdgeSwipeBack";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import { PushNotificationsHandler } from "@/components/PushNotificationsHandler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Code-split every route so the initial bundle only loads the shell.
const HomePage = lazy(() => import("./pages/HomePage"));
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
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache-first behaviour for smoother revisits across the app.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
      <DeepLinkHandler />
      {user && <PushNotificationsHandler />}
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
      {user && !mustCompletePasswordReset && <BottomNav />}
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
