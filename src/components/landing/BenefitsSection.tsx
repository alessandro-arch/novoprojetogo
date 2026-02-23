import { CheckCircle2 } from "lucide-react";

const benefits = [
  "Publicação de editais com formulários dinâmicos e configuráveis",
  "Recebimento e gestão de propostas em fluxo simplificado",
  "Avaliação cega com distribuição automática de pareceristas",
  "Painel de acompanhamento em tempo real para gestores",
  "Isolamento seguro de dados entre organizações",
];

const BenefitsSection = () => {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary mb-3 block">
            Benefícios
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-10">
            Por que escolher a Plataforma ProjetoGO?
          </h2>

          <div className="space-y-4">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/50"
              >
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <span className="text-foreground leading-relaxed">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
