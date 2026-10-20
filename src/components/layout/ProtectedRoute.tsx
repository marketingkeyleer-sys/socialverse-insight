import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const confirmingConnection = location.pathname === "/accounts" && new URLSearchParams(location.search).has("connection_request");
  if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding" && !confirmingConnection) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
