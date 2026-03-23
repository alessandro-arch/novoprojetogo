import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface FomentoProtectedRouteProps {
  children: React.ReactNode;
}

const FomentoProtectedRoute = ({ children }: FomentoProtectedRouteProps) => {
  const { user, session, loading, fomentoRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return <Navigate to="/fomento/login" replace />;
  }

  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    return <Navigate to="/fomento/login" replace />;
  }

  if (!fomentoRole) {
    return <Navigate to="/fomento/login" replace />;
  }

  return <>{children}</>;
};

export default FomentoProtectedRoute;
