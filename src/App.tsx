import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import ScrollRestoration from "@/components/ScrollRestoration";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import AddPlacePage from "./pages/AddPlacePage";
import SearchPage from "./pages/SearchPage";
import ProfilePage from "./pages/ProfilePage";
import LoggedPlacesPage from "./pages/LoggedPlacesPage";
import AuthPage from "./pages/AuthPage";
import PlacePage from "./pages/PlacePage";
import ReviewDetailPage from "./pages/ReviewDetailPage";
import PlaceSubPage from "./pages/PlaceSubPage";
import CountryCitiesPage from "./pages/CountryCitiesPage";
import ExploreListPage from "./pages/ExploreListPage";
import ListDetailPage from "./pages/ListDetailPage";
import SettingsPage from "./pages/SettingsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";

import WelcomePage from "./pages/WelcomePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

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
