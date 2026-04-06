import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { Loader2 } from "lucide-react";

const RecruiterProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, initialized } = useAuth();
  const { accountType, loading: atLoading, dbAccountType, switchView } = useAccountType();
  const location = useLocation();
  const didSwitch = useRef(false);

  // Auto-switch view to recruiter if DB says recruiter but active view doesn't match
  useEffect(() => {
    if (!initialized || authLoading || atLoading || !user) return;
    if (accountType !== "recruiter" && dbAccountType === "recruiter" && !didSwitch.current) {
      didSwitch.current = true;
      switchView("recruiter");
    }
  }, [initialized, authLoading, atLoading, user, accountType, dbAccountType, switchView]);

  if (!initialized || authLoading || atLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // Allow access if active view OR db type is recruiter
  if (accountType !== "recruiter" && dbAccountType !== "recruiter") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RecruiterProtectedRoute;
