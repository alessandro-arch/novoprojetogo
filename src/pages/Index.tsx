import { FileText, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const modules = [
  {
    icon: FileText,
    title: "ProjetoGO",
    description: "Gestão de editais, formulários e propostas",
    to: "/login",
  },
  {
    icon: TrendingUp,
    title: "ProjetoGO Fomento",
    description: "Monitoramento de captação de recursos e termos de outorga",
    
    to: "/fomento/login",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="flex items-center gap-3 mb-3">
        <FileText className="w-8 h-8 text-primary" />
        <span className="text-3xl font-extrabold font-heading text-foreground tracking-tight">
          ProjetoGO
        </span>
      </div>
      <p className="text-muted-foreground mb-12 text-center">
        Selecione o módulo que deseja acessar
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {modules.map((m) => (
          <Card
            key={m.title}
            className="cursor-pointer transition-shadow duration-200 hover:shadow-xl group"
            onClick={() => navigate(m.to)}
          >
            <CardContent className="flex flex-col items-center text-center gap-4 p-8">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <m.icon className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-heading text-foreground">
                {m.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {m.description}
              </p>
              
              <Button variant="dark" className="mt-2 gap-2">
                Acessar <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Powered by <span className="font-semibold">InnovaGO</span>
      </p>
    </div>
  );
};

export default Index;
