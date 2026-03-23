import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao redefinir senha", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
    }
  };

  if (!isRecovery && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border w-full max-w-md text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Link inválido</h2>
          <p className="text-muted-foreground mb-6">
            Este link de redefinição de senha é inválido ou expirou.
          </p>
          <Link to="/login" className="text-primary font-medium hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border w-full max-w-md text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Senha redefinida!</h2>
          <p className="text-muted-foreground mb-6">
            Sua senha foi atualizada com sucesso.
          </p>
          <Button onClick={() => navigate("/login", { replace: true })} className="w-full">
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border w-full max-w-md">
        <h2 className="text-xl font-semibold text-foreground mb-2">Redefinir senha</h2>
        <p className="text-muted-foreground mb-6">Digite sua nova senha abaixo.</p>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              required
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full min-h-[44px]" size="lg" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Redefinir senha
          </Button>
        </form>

        <Link
          to="/login"
          className="flex items-center gap-1 text-sm text-muted-foreground mt-6 hover:text-foreground transition-colors justify-center"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
