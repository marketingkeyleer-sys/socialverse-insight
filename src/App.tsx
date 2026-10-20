import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";
import Accounts from "@/pages/Accounts";
import Compose from "@/pages/Compose";
import Posts from "@/pages/Posts";
import PostDetail from "@/pages/PostDetail";
import Inbox from "@/pages/Inbox";
import WhatsApp from "@/pages/WhatsApp";
import Ads from "@/pages/Ads";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

function withLayout(children: React.ReactNode) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

// "/" always rendered the public marketing page even for a logged-in user —
// clicking the logo or navigating to "/" dropped you back onto Landing
// instead of your dashboard. Signed-in users go straight to /dashboard here;
// everyone else still sees Landing.
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomeRoute />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />

                <Route path="/dashboard" element={withLayout(<Dashboard />)} />
                <Route path="/calendar" element={withLayout(<CalendarPage />)} />
                <Route path="/accounts" element={withLayout(<Accounts />)} />
                <Route path="/compose" element={withLayout(<Compose />)} />
                <Route path="/posts" element={withLayout(<Posts />)} />
                <Route path="/posts/:id" element={withLayout(<PostDetail />)} />
                <Route path="/inbox" element={withLayout(<Inbox />)} />
                <Route path="/whatsapp" element={withLayout(<WhatsApp />)} />
                <Route path="/ads" element={withLayout(<Ads />)} />
                <Route path="/analytics" element={withLayout(<Analytics />)} />
                <Route path="/settings" element={withLayout(<Settings />)} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
