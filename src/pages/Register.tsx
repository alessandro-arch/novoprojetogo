import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput, getPasswordStrength } from "@/components/ui/password-input";
import { FileText, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";

const Register = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const strength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Senha deve ter no mínimo 8 caracteres", variant: "destructive" });
      return;
    }
    if (strength === "weak") {
      toast({
        title: "Senha muito fraca",
        description: "Use letras maiúsculas, minúsculas, números e caracteres especiais.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: translateAuthError(error.message),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Cadastro realizado!",
      description: "Verifique seu email para confirmar a conta.",
    });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-foreground">ProjetoGO</h1>
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">Cadastro de Proponente</h2>
            <p className="text-muted-foreground mb-6">Crie sua conta para submeter propostas</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  autoComplete="name"
                  className="mt-1"
                />
              </div>
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
              <div>
                <Label htmlFor="password">Senha</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  showStrengthMeter
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use letras maiúsculas, minúsculas, números e caracteres especiais.
                </p>
              </div>
              <Button
                type="submit"
                variant="dark"
                className="w-full min-h-[44px]"
                size="lg"
                disabled={loading || strength === "weak"}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar Conta
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Já tem conta?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Entrar
              </Link>
            </p>

            <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors justify-center">
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
