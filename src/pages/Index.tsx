import HeroSection from "@/components/landing/HeroSection";
import PublicEditaisSection from "@/components/landing/PublicEditaisSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import AudienceSection from "@/components/landing/AudienceSection";
import CTASection from "@/components/landing/CTASection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ChallengesSection from "@/components/landing/ChallengesSection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <PublicEditaisSection />
      <BenefitsSection />
      <AudienceSection />
      <CTASection
        title="Quer ver a plataforma em ação?"
        subtitle="Entre em contato conosco e agende uma demonstração personalizada."
      />
      <FeaturesSection />
      <ChallengesSection />
      <CTASection
        title="Pronto para transformar a gestão dos seus editais?"
        subtitle="Comece agora mesmo e simplifique todo o processo."
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
