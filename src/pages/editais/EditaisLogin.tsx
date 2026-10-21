import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Radar, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";
import Seo from "@/components/Seo";
import { oe } from "./CuradoriaPage";

const EditaisLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível confirmar seu acesso. Tente novamente.");

      const [rolesResult, configResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
        oe.from("oe_org_config").select("organization_id").eq("ativa", true).limit(1),
      ]);
      const isSuperadmin = (rolesResult.data ?? []).some((r) => r.role === "icca_admin");
      const hasAccess = (configResult.data ?? []).length > 0;

      if (!isSuperadmin && !hasAccess) {
        await supabase.auth.signOut();
        if (rolesResult.error || configResult.error) {
          toast({
            title: "Erro ao verificar acesso",
            description: "Não foi possível verificar seu acesso ao Operon Fomento. Tente novamente.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Acesso negado",
            description: "Você não tem acesso ao Operon Fomento. Entre em contato com o administrador da sua instituição.",
            variant: "destructive",
          });
        }
        return;
      }

      navigate("/editais", { replace: true });
    } catch (error) {
      toast({
        title: "Erro ao entrar",
        description: translateAuthError(error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Seo
        title="Entrar | Operon Fomento | ProjetoGO"
        description="Acesse o Operon Fomento para acompanhar as chamadas de fomento ligadas ao seu perfil."
        path="/editais/login"
        noindex
      />
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-primary flex items-center justify-center">
                <Radar className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-foreground">Operon Fomento</h1>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2 mt-6">Entrar</h2>
            <p className="text-muted-foreground mb-6">Acompanhe as chamadas de fomento ligadas ao seu perfil</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" className="mt-1" />
              </div>
              <div className="flex justify-end">
                <Link to="/forgot-password?back=/editais/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Esqueci minha senha</Link>
              </div>
              <Button type="submit" className="w-full min-h-[44px]" size="lg" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar
              </Button>
            </form>
            <p className="mt-6 text-sm text-muted-foreground text-center">O acesso é liberado pela sua instituição. Se ainda não tem acesso, fale com o administrador da sua instituição.</p>
            <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground mt-6 hover:text-foreground transition-colors justify-center">
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditaisLogin;