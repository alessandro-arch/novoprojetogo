import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}

const CTASection = ({
  title,
  subtitle,
  primaryLabel = "Acessar Portal",
  primaryTo = "/login",
  secondaryLabel,
  secondaryTo,
}: CTASectionProps) => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-[hsl(220,25%,12%)]">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl md:text-3xl font-bold font-heading text-white mb-4">
          {title}
        </h2>
        {subtitle && (
          <p className="text-white/60 mb-8 max-w-xl mx-auto">{subtitle}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="hero-outline"
            size="lg"
            className="text-base px-8 py-6 border-white/30 text-white hover:bg-white/10"
            onClick={() => navigate(primaryTo)}
          >
            {primaryLabel}
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
          {secondaryLabel && secondaryTo && (
            <Button
              variant="hero-outline"
              size="lg"
              className="text-base px-8 py-6 border-white/30 text-white hover:bg-white/10"
              onClick={() => navigate(secondaryTo)}
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default CTASection;
