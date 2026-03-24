import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ChallengesSection from "@/components/landing/ChallengesSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import AudienceSection from "@/components/landing/AudienceSection";
import PublicEditaisSection from "@/components/landing/PublicEditaisSection";
import FomentoSection from "@/components/landing/FomentoSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <ChallengesSection />
      <PublicEditaisSection />
      <BenefitsSection />
      <AudienceSection />
      <FomentoSection />
      <CTASection
        title="Quer ver a plataforma em ação?"
        subtitle="Solicite uma demonstração e descubra como o ProjetoGO pode transformar a gestão de editais da sua instituição."
        primaryLabel="Solicitar Demonstração"
        primaryTo="/register"
      />
      <CTASection
        title="Pronto para transformar a gestão dos seus editais?"
        subtitle="Comece agora mesmo a publicar editais, receber propostas e gerenciar avaliações."
        primaryLabel="Acessar Portal"
        primaryTo="/login"
        secondaryLabel="Sou Proponente"
        secondaryTo="/register"
      />
      <Footer />
    </div>
  );
};

export default Index;
