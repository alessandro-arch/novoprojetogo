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
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-4">
            Tudo que você precisa para gerenciar editais
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para publicar editais, receber propostas e gerenciar avaliações.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl gradient-card shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow duration-300">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold font-heading text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
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
