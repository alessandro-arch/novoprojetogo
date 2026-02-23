import { FileText, Users, BarChart3, Shield, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Editais Configuráveis",
    description: "Crie editais com formulários dinâmicos e áreas de conhecimento personalizáveis.",
  },
  {
    icon: Users,
    title: "Multi-Organização",
    description: "Cada organização gerencia seus editais e proponentes de forma independente.",
  },
  {
    icon: BarChart3,
    title: "Dashboard em Tempo Real",
    description: "Acompanhe propostas, submissões e métricas do seu edital em um painel intuitivo.",
  },
  {
    icon: Shield,
    title: "Segurança e Isolamento",
    description: "Dados isolados entre organizações com políticas de segurança robustas.",
  },
  {
    icon: Zap,
    title: "Submissão Simplificada",
    description: "Fluxo de submissão intuitivo com rascunhos, anexos e validação automática.",
  },
  {
    icon: Globe,
    title: "Portal do Proponente",
    description: "Interface dedicada para proponentes acompanharem seus editais e propostas.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary mb-3 block">
            Funcionalidades
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-4">
            Tudo que você precisa para gerenciar editais
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para publicar editais, receber propostas e gerenciar avaliações.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl bg-card border border-border/50 hover:shadow-sm transition-shadow"
            >
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold font-heading text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
