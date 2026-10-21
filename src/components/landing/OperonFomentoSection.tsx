import { Radar, FileText, Bell, Search, CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const operonFeatures = [
  "Editais abertos hoje, com prazo e dias restantes",
  "Várias chamadas por edital, com a data de cada rodada",
  "Documentos oficiais para baixar: edital, anexos e retificações",
  "Linha do tempo de erratas e resultados",
  "Conferido pela curadoria antes de publicar",
  "Cobertura inicial: FAPES e CNPq, outras agências em seguida",
];

const highlights = [
  {
    icon: Radar,
    title: "Radar diário de chamadas",
    description: "Monitora FAPES e CNPq todos os dias e mostra só o que está aberto hoje, com prazo e dias restantes.",
  },
  {
    icon: FileText,
    title: "Do edital ao resultado",
    description: "Acompanhe retificações, erratas, resultado preliminar e final, com download dos documentos oficiais.",
  },
  {
    icon: Bell,
    title: "Avisos no seu canal",
    description: "Siga um edital e seja avisado de cada mudança. Avisos por e-mail e Telegram em breve.",
  },
];

const OperonFomentoSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <Badge className="mb-4 text-[11px]">Novo módulo</Badge>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-4">
            Operon Fomento
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Chamadas de fomento ligadas ao seu perfil, monitoradas todos os dias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-14">
          {highlights.map((d) => (
            <div key={d.title} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <d.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-heading text-foreground mb-2">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="p-8 rounded-xl border border-border/50 bg-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold font-heading text-foreground">Funcionalidades do módulo</h3>
            </div>
            <ul className="space-y-3 mb-4">
              {operonFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mb-8">
              Resumos feitos pela curadoria. Confirme no texto oficial do edital.
            </p>
            <Button variant="dark" className="w-full gap-2" onClick={() => navigate("/editais")}>
              Acessar Operon Fomento <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OperonFomentoSection;
