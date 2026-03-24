import { TrendingUp, Bot, BarChart3, Bell, CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fomentoFeatures = [
  "Upload e leitura inteligente de termos de outorga",
  "Extração automática de dados via IA",
  "Painel de captação por pesquisador e área",
  "Controle de vigências e alertas automáticos",
  "Gestão de rubricas, equipe e bolsistas",
  "Relatórios exportáveis em CSV",
];

const highlights = [
  {
    icon: Bot,
    title: "Inteligência Artificial",
    description:
      "Lê PDFs de termos de outorga e extrai automaticamente pesquisador, valores, rubricas e vigência.",
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

const FomentoSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <Badge className="mb-4 text-[11px]">Novo módulo</Badge>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-4">
            ProjetoGO Fomento
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Monitore toda a captação de recursos da sua instituição — de agências
            de fomento a parcerias privadas.
          </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-14">
          {highlights.map((d) => (
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

        {/* Feature list + CTA */}
        <div className="max-w-2xl mx-auto">
          <div className="p-8 rounded-xl border border-border/50 bg-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-heading text-foreground">
                Funcionalidades do módulo
              </h3>
            </div>
            <ul className="space-y-3 mb-8">
              {fomentoFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground">
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
              Acessar Fomento <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FomentoSection;
