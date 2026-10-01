import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Headset, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";
import Seo from "@/components/Seo";

const ServiceDeskLogin = () => {
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

    // Acesso permitido: administrador geral (icca_admin) ou membro ativo de alguma instituição
    const [{ data: roles }, { data: memberships }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
      supabase
        .from("sd_members")
        .select("id")
        .eq("user_id", authData.user.id)
        .eq("status", "ativo")
        .limit(1),
    ]);

    const isSuperadmin = (roles ?? []).some((r) => r.role === "icca_admin");
    const isMember = (memberships ?? []).length > 0;

    if (!isSuperadmin && !isMember) {
      await supabase.auth.signOut();
      setLoading(false);
      toast({
        title: "Acesso negado",
        description:
          "Você não tem acesso ao Service Desk. Entre em contato com o administrador da sua instituição.",
        variant: "destructive",
      });
      return;
    }

    setLoading(false);
    navigate("/servicedesk", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Seo
        title="Entrar — Service Desk Acadêmico | ProjetoGO"
        description="Acesse o Service Desk Acadêmico da sua instituição no ProjetoGO."
        path="/servicedesk/login"
        noindex
      />
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Headset className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-foreground">
                Service Desk Acadêmico
              </h1>
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2 mt-6">Entrar</h2>
            <p className="text-muted-foreground mb-6">
              Acesse os serviços e solicitações da sua instituição
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
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
              <div className="flex justify-end">
                <Link
                  to="/forgot-password?back=/servicedesk/login"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full min-h-[44px]"
                size="lg"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Aluno ou professor? No primeiro acesso você usará sua matrícula para
                criar suas credenciais.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Disponível em breve)
              </p>
            </div>

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

export default ServiceDeskLogin;
