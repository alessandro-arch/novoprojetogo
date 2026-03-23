import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  backTo?: string;
  backLabel?: string;
}

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const backTo = searchParams.get("back") || "/login";
  const backLabel = backTo.includes("fomento") ? "Voltar ao login Fomento" : "Voltar ao login";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border w-full max-w-md text-center">
          <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Email enviado!</h2>
          <p className="text-muted-foreground mb-6">
            Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
          </p>
          <Link
            to={backTo}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors justify-center"
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border w-full max-w-md">
        <h2 className="text-xl font-semibold text-foreground mb-2">Esqueci minha senha</h2>
        <p className="text-muted-foreground mb-6">
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full min-h-[44px]" size="lg" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Enviar link de redefinição
          </Button>
        </form>

        <Link
          to={backTo}
          className="flex items-center gap-1 text-sm text-muted-foreground mt-6 hover:text-foreground transition-colors justify-center"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
