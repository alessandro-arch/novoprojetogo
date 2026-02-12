import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Loader2, UserCircle, AlertCircle } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { user, loading, globalRole, membership } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Redirect based on role
  if (globalRole === "icca_admin") return <Navigate to="/admin" replace />;
  if (membership?.role === "org_admin" || membership?.role === "edital_manager") return <Navigate to="/org" replace />;
  if (membership?.role === "proponente") return <Navigate to="/proponente" replace />;
  if (membership?.role === "reviewer") return <Navigate to="/reviewer" replace />;

  // No specific panel role — show welcome with profile prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md space-y-4">
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Bem-vindo ao ProjetoGO
        </h1>

        {profile && !profile.profile_completed && (
          <div className="flex items-center justify-center gap-2">
            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
              <AlertCircle className="w-3 h-3 mr-1" /> Cadastro incompleto
            </Badge>
          </div>
        )}

        <p className="text-muted-foreground">
          Complete seu cadastro pessoal para participar dos editais.
        </p>

        <Link to="/profile">
          <Button size="lg">
            <UserCircle className="w-4 h-4 mr-2" /> Meu Cadastro
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
