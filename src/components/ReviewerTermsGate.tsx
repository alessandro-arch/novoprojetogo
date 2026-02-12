import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface ReviewerTermsGateProps {
  children: React.ReactNode;
}

const ReviewerTermsGate = ({ children }: ReviewerTermsGateProps) => {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const checkTerms = async () => {
      if (!user) { setChecking(false); return; }

      const { data } = await supabase
        .from("reviewer_profiles" as any)
        .select("first_terms_accepted_at")
        .eq("user_id", user.id)
        .maybeSingle();

      setTermsAccepted(!!(data as any)?.first_terms_accepted_at);
      setChecking(false);
    };
    checkTerms();
  }, [user]);

  if (checking) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!termsAccepted) return <Navigate to="/reviewer/terms" replace />;
  return <>{children}</>;
};

export default ReviewerTermsGate;
