import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-primary" />
          <span className="text-base font-bold font-heading text-foreground tracking-tight">
            ProjetoGO
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Powered by InnovaGO
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
          onClick={() => navigate("/login?role=admin")}
        >
          <Shield className="w-3.5 h-3.5" />
          Acesso Administrativo
        </Button>
      </div>

      {/* Hero content */}
      <div className="container mx-auto px-4 pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Uma Solução InnovaGO
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-heading text-foreground leading-tight mb-6">
            Gerencie editais e propostas com{" "}
            <span className="text-primary">eficiência</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            ProjetoGO simplifica a publicação de editais, recebimento de propostas
            e acompanhamento de todo o processo — tudo em uma única plataforma.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="dark"
              size="lg"
              className="text-base px-8 py-6"
              onClick={() => navigate("/login")}
            >
              Acessar Portal
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 py-6"
              onClick={() => navigate("/register")}
            >
              Sou Proponente
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
