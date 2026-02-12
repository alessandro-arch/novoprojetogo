import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import PublicEditaisSection from "@/components/landing/PublicEditaisSection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <PublicEditaisSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Index;
