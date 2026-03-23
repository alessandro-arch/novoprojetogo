import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FomentoLogin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <TrendingUp className="w-12 h-12 text-primary mb-4" />
      <h1 className="text-2xl font-bold font-heading text-foreground mb-2">
        ProjetoGO Fomento
      </h1>
      <p className="text-muted-foreground mb-8 text-center max-w-md">
        Módulo em construção. Em breve você poderá acessar o monitoramento de captação de recursos e termos de outorga.
      </p>
      <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>
    </div>
  );
};

export default FomentoLogin;
