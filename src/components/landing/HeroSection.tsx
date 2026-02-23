import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[85vh] flex items-center gradient-hero overflow-hidden">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold font-heading text-primary-foreground tracking-tight">ProjetoGO</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground/50 hover:text-primary-foreground/80 hover:bg-primary-foreground/10 text-xs gap-1.5"
            onClick={() => navigate("/login?role=admin")}
          >
            <Shield className="w-3.5 h-3.5" />
            Acesso Administrativo
          </Button>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary-foreground/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 mb-8 animate-fade-in">
            <FileText className="w-4 h-4 text-primary-foreground/70" />
            <span className="text-sm font-medium text-primary-foreground/80">
              Plataforma de Gestão de Editais
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-heading text-primary-foreground leading-tight mb-6 animate-fade-up">
            Gerencie editais e propostas com{" "}
            <span className="text-secondary">eficiência</span>
          </h1>

          <p className="text-lg md:text-xl text-primary-foreground/65 mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: "100ms" }}>
            ProjetoGO simplifica a publicação de editais, recebimento de propostas 
            e acompanhamento de todo o processo — tudo em uma única plataforma.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: "200ms" }}>
            <Button
              variant="hero"
              size="lg"
              className="text-base px-8 py-6"
              onClick={() => navigate("/login")}
            >
              Acessar Portal
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              variant="hero-outline"
              size="lg"
              className="text-base px-8 py-6"
              onClick={() => navigate("/register")}
            >
              Sou Proponente
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 80L60 72C120 64 240 48 360 40C480 32 600 32 720 36C840 40 960 48 1080 52C1200 56 1320 56 1380 56L1440 56V80H1380C1320 80 1200 80 1080 80C960 80 840 80 720 80C600 80 480 80 360 80C240 80 120 80 60 80H0V80Z" fill="hsl(220, 20%, 97%)" />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
