import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, LogOut } from "lucide-react";

const FomentoDashboard = () => {
  const { fomentoRole, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[hsl(213,52%,24%)] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-heading text-foreground">
              ProjetoGO Fomento
            </h1>
            <Badge variant="secondary" className="text-[10px]">
              PRPPGE · UVV
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="capitalize">
            {fomentoRole}
          </Badge>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10">
        <h2 className="text-2xl font-bold font-heading text-foreground mb-2">
          Dashboard
        </h2>
        <p className="text-muted-foreground">
          Módulo em construção. Em breve você poderá acessar o monitoramento de captação
          de recursos e termos de outorga.
        </p>
      </main>
    </div>
  );
};

export default FomentoDashboard;
