import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Headset, ArrowLeft, Loader2, AlertTriangle, MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import { isCommonPassword, COMMON_PASSWORD_WARNING } from "@/lib/common-passwords";

const ServiceDeskFirstAccess = () => {
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"aluno" | "professor">("aluno");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (isCommonPassword(password)) {
      toast({ title: "Senha muito comum", description: COMMON_PASSWORD_WARNING, variant: "destructive" });
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
      setResent(!!data?.resent);
      setSentTo(email.trim().toLowerCase());
      toast({ title: "Cadastro feito! Agora confirme seu e-mail", description: "Você só consegue entrar depois de clicar no link que enviamos." });
      return;
    }
    toast({ title: "Cadastro concluído", description: "Entre com seu e-mail e senha." });
    navigate("/servicedesk/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Seo
        title="Primeiro acesso | Service Desk Acadêmico | ProjetoGO"
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
              <Alert className="border-primary/40 bg-primary/5">
                <MailCheck className="h-5 w-5" />
                <AlertTitle className="text-base font-semibold">Falta só confirmar seu e-mail</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Seu cadastro foi feito. Enviamos um link de confirmação para <strong className="break-all">{sentTo}</strong>.</p>
                  <p className="font-medium">Você só consegue entrar depois de clicar nesse link.</p>
                </AlertDescription>
              </Alert>
              {resent && (
                <p className="text-sm text-foreground">Você já tinha começado o cadastro, mas o e-mail não foi confirmado. Enviamos um novo link, e a senha que você acabou de criar passa a valer.</p>
              )}
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-foreground">
                <li>Abra a caixa de entrada desse e-mail.</li>
                <li>Procure a mensagem do ProjetoGO. Se não encontrar, olhe a caixa de spam ou lixo eletrônico.</li>
                <li>Clique no link de confirmação. Use sempre o e-mail mais recente.</li>
                <li>Volte aqui e entre com seu e-mail e a senha que você criou.</li>
              </ol>
              <p className="text-xs text-muted-foreground">Não chegou ou o link venceu? Faça o primeiro acesso de novo com os mesmos dados e enviaremos um novo link.</p>
              <Button asChild className="w-full min-h-[44px]"><Link to="/servicedesk/login">Já confirmei, ir para o login</Link></Button>
            </div>
          ) : (<>
          <p className="text-muted-foreground mb-6 mt-2">
            Informe seu vínculo, sua matrícula, o e-mail já cadastrado na sua instituição e crie uma senha. Caso o e-mail esteja ausente ou desatualizado, procure a secretaria. Depois, o login será sempre com e-mail e senha.
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
              <PasswordInput id="pw" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="mt-1" aria-describedby="pw-warning" />
              {isCommonPassword(password) && (
                <p id="pw-warning" role="alert" className="flex items-start gap-1.5 text-xs text-destructive mt-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {COMMON_PASSWORD_WARNING}
                </p>
              )}
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
            <ArrowLeft className="w-4 h-4" /> Já tenho cadastro, entrar
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ServiceDeskFirstAccess;
