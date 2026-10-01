import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Headset, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";

const ServiceDeskFirstAccess = () => {
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"aluno" | "professor">("aluno");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "As senhas não conferem", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("sd-first-access", {
      body: {
        tipo,
        matricula: matricula.trim(),
        email: email.trim(),
        password,
        redirectTo: `${window.location.origin}/servicedesk/login`,
      },
    });
    let msg: string | undefined = data?.error;
    if (error && !msg) {
      try {
        msg = (await (error as { context?: Response }).context?.json())?.error;
      } catch { /* ignore */ }
    }
    if (error || msg) {
      setLoading(false);
      toast({ title: "Não foi possível concluir", description: msg ?? "Tente novamente.", variant: "destructive" });
      return;
    }
    setLoading(false);
    if (data?.needsConfirmation) {
      setSentTo(email.trim().toLowerCase());
      return;
    }
    toast({ title: "Cadastro concluído", description: "Entre com seu e-mail e senha." });
    navigate("/servicedesk/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Seo
        title="Primeiro acesso — Service Desk Acadêmico | ProjetoGO"
        description="Crie seu acesso ao Service Desk Acadêmico com sua matrícula."
        path="/servicedesk/primeiro-acesso"
        noindex
      />
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-card-hover p-6 md:p-8 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Headset className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Primeiro acesso</h1>
          </div>
          {sentTo ? (
            <div className="mt-4 space-y-4">
              <p className="text-foreground">Quase pronto! Enviamos um link de confirmação para <strong>{sentTo}</strong>.</p>
              <p className="text-sm text-muted-foreground">Abra o e-mail e clique no link. Depois, entre sempre com seu e-mail e senha. Se não encontrar, verifique a caixa de spam.</p>
              <Button asChild className="w-full min-h-[44px]"><Link to="/servicedesk/login">Ir para o login</Link></Button>
            </div>
          ) : (<>
          <p className="text-muted-foreground mb-6 mt-2">
            Informe seu vínculo, sua matrícula, seu e-mail pessoal e crie uma senha. Depois, o login será sempre com e-mail e senha.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4" role="radiogroup" aria-label="Vínculo">
            {(["aluno", "professor"] as const).map((t) => (
              <Button key={t} type="button" role="radio" aria-checked={tipo === t}
                variant={tipo === t ? "default" : "outline"} className="min-h-[44px]" onClick={() => setTipo(t)}>
                {t === "aluno" ? "Sou aluno" : "Sou professor"}
              </Button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="mat">Matrícula</Label>
              <Input id="mat" value={matricula} onChange={(e) => setMatricula(e.target.value)} required maxLength={40} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="em">E-mail pessoal</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} autoComplete="email" placeholder="seu@email.com" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Será usado para entrar no Service Desk.</p>
            </div>
            <div>
              <Label htmlFor="pw">Senha</Label>
              <PasswordInput id="pw" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="pw2">Confirmar senha</Label>
              <PasswordInput id="pw2" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className="mt-1" />
            </div>
            <Button type="submit" className="w-full min-h-[44px]" size="lg" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar acesso
            </Button>
          </form>
          </>)}
          <Link to="/servicedesk/login" className="flex items-center gap-1 text-sm text-muted-foreground mt-6 hover:text-foreground justify-center">
            <ArrowLeft className="w-4 h-4" /> Já tenho cadastro — entrar
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ServiceDeskFirstAccess;
