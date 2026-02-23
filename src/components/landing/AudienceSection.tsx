import { GraduationCap, Building2, Landmark } from "lucide-react";

const audiences = [
  {
    icon: GraduationCap,
    title: "Universidades",
    description:
      "Gerencie editais internos de pesquisa, extensão e bolsas com total controle e transparência.",
  },
  {
    icon: Building2,
    title: "Empresas",
    description:
      "Publique chamadas de inovação aberta e selecione os melhores projetos com avaliação criteriosa.",
  },
  {
    icon: Landmark,
    title: "Agências de Fomento",
    description:
      "Automatize o fluxo de editais públicos, desde a submissão até a homologação dos resultados.",
  },
];

const AudienceSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary mb-3 block">
            Para Quem É
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground">
            Uma solução para diferentes perfis
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {audiences.map((item) => (
            <div
              key={item.title}
              className="text-center p-8 rounded-xl border border-border/50 bg-card"
            >
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
                <item.icon className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold font-heading text-foreground mb-2">
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudienceSection;
