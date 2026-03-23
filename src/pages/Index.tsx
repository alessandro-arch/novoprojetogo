import { FileText, TrendingUp, ArrowRight, CheckCircle2, Bot, BarChart3, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const projetoGoFeatures = [
  "Criação e publicação de editais",
  "Formulários personalizáveis",
  "Recebimento de propostas",
  "Avaliação e pareceristas",
  "Auditoria e histórico",
];

const fomentoFeatures = [
  "Upload e leitura inteligente de termos de outorga",
  "Extração automática de dados via IA",
  "Painel de captação por pesquisador e área",
  "Controle de vigências e alertas automáticos",
  "Gestão de rubricas, equipe e bolsistas",
  "Relatórios exportáveis em CSV",
];

const differentials = [
  {
    icon: Bot,
    title: "Inteligência Artificial",
    description:
      "O módulo Fomento lê PDFs de termos de outorga e extrai automaticamente pesquisador, valores, rubricas e vigência.",
  },
  {
    icon: BarChart3,
    title: "Visão estratégica",
    description:
      "Dashboards em tempo real com captação por pesquisador, área, financiador e evolução anual.",
  },
  {
    icon: Bell,
    title: "Alertas proativos",
    description:
      "Receba alertas de vigência antes do vencimento para nunca perder um prazo de prestação de contas.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <section className="bg-[hsl(220,25%,12%)] text-white">
        <div className="container mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <FileText className="w-8 h-8 text-white/80" />
              <span className="text-3xl font-extrabold font-heading tracking-tight">
                ProjetoGO
              </span>
            </div>
            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-10 max-w-2xl mx-auto">
              A plataforma completa para gestão de projetos, editais e captação
              de recursos em instituições de ensino e pesquisa
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="hero-outline"
                size="lg"
                className="text-base px-8 py-6"
                onClick={() => navigate("/login")}
              >
                Acessar ProjetoGO
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                variant="hero-outline"
                size="lg"
                className="text-base px-8 py-6"
                onClick={() => navigate("/fomento/login")}
              >
                Acessar Fomento
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
            <p className="mt-8 text-xs text-white/40">
              Powered by <span className="font-semibold text-white/60">InnovaGO</span>
            </p>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground text-center mb-12">
            Escolha o módulo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* ProjetoGO Card */}
            <Card className="cursor-pointer transition-shadow duration-200 hover:shadow-xl group flex flex-col">
              <CardContent className="flex flex-col flex-1 p-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-5">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold font-heading text-foreground mb-2">
                  ProjetoGO
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  Publique editais, gerencie formulários, receba e avalie
                  propostas em um único lugar.
                </p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {projetoGoFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="dark"
                  className="w-full gap-2"
                  onClick={() => navigate("/login")}
                >
                  Acessar <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Fomento Card */}
            <Card className="cursor-pointer transition-shadow duration-200 hover:shadow-xl group flex flex-col">
              <CardContent className="flex flex-col flex-1 p-8">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <TrendingUp className="w-7 h-7 text-primary" />
                  </div>
                  <Badge className="text-[10px]">Novo módulo</Badge>
                </div>
                <h3 className="text-xl font-bold font-heading text-foreground mb-2">
                  ProjetoGO Fomento
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  Monitore toda a captação de recursos da sua instituição — de
                  agências de fomento a parcerias privadas.
                </p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {fomentoFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="dark"
                  className="w-full gap-2"
                  onClick={() => navigate("/fomento/login")}
                >
                  Acessar <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Differentials */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground text-center mb-12">
            Por que usar o ProjetoGO?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {differentials.map((d) => (
              <div key={d.title} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <d.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold font-heading text-foreground mb-2">
                  {d.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {d.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[hsl(220,25%,12%)] py-8">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-white/60 text-sm">
            ProjetoGO · Plataforma de gestão de projetos e captação de recursos
          </p>
          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} Powered by{" "}
            <span className="font-semibold text-white/60">InnovaGO</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
