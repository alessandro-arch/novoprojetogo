import { Clock, FileWarning, Users, ShieldAlert } from "lucide-react";

const challenges = [
  {
    icon: Clock,
    title: "Prazos apertados",
    description:
      "Controlar cronogramas de abertura, submissão, avaliação e divulgação de resultados é complexo.",
  },
  {
    icon: FileWarning,
    title: "Volume de documentos",
    description:
      "Dezenas de propostas com formulários, anexos e orçamentos exigem organização rigorosa.",
  },
  {
    icon: Users,
    title: "Coordenação de avaliadores",
    description:
      "Distribuir propostas entre pareceristas evitando conflitos de interesse requer automação.",
  },
  {
    icon: ShieldAlert,
    title: "Transparência e auditoria",
    description:
      "Garantir rastreabilidade de cada ação e decisão ao longo do processo é obrigatório.",
  },
];

const ChallengesSection = () => {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary mb-3 block">
            Os Desafios
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground">
            Por que a gestão de editais é tão complexa?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {challenges.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 p-6 rounded-xl border border-border/50 bg-card"
            >
              <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold font-heading text-foreground mb-1">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ChallengesSection;
