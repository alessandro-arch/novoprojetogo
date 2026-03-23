import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";

const FomentoLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      toast({
        title: "Erro ao entrar",
        description: translateAuthError(error.message),
        variant: "destructive",
      });
      return;
    }

    // Check fomento_role
    const { data: profile } = await supabase
      .from("profiles")
      .select("fomento_role")
      .eq("user_id", authData.user.id)
      .single();

    if (!profile?.fomento_role) {
      await supabase.auth.signOut();
      setLoading(false);
      toast({
        title: "Acesso negado",
        description:
          "Você não tem acesso ao módulo Fomento. Entre em contato com o administrador.",
        variant: "destructive",
      });
      return;
    }

    setLoading(false);
    navigate("/fomento/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[hsl(213,52%,24%)] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-foreground">
                ProjetoGO Fomento
              </h1>
            </div>

            <div className="mb-8">
              <Badge variant="secondary" className="text-xs">
                PRPPGE · UVV
              </Badge>
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">Entrar</h2>
            <p className="text-muted-foreground mb-6">
              Acesse o módulo de monitoramento de captação de recursos
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
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
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                className="w-full min-h-[44px] bg-[hsl(213,52%,24%)] text-white hover:bg-[hsl(213,52%,30%)] transition-colors"
                size="lg"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar
              </Button>
            </form>

            <Link
              to="/"
              className="flex items-center gap-1 text-sm text-muted-foreground mt-6 hover:text-foreground transition-colors justify-center"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FomentoLogin;
