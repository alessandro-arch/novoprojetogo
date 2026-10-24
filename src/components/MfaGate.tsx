import { ReactNode, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { codigoValido, contaMfaObrigatoria, passoMfa, rotaPublica, type MfaPasso } from "@/lib/mfa-policy";

const chaveDispensa = (id: string) => `mfa-dispensado:${id}`;

const MfaGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const [passo, setPasso] = useState<MfaPasso | "carregando">("carregando");
  const [userId, setUserId] = useState<string | null>(null);
  const [obrigatorio, setObrigatorio] = useState(false);
  const [fatorId, setFatorId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ img: string; secret: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const avaliar = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id ?? null;
    setUserId(uid);
    if (!uid) return setPasso("liberado");
    const [{ data: f }, { data: a }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const verificados = (f?.totp ?? []).filter((x) => x.status === "verified");
    const obr = contaMfaObrigatoria(uid);
    setObrigatorio(obr);
    setFatorId(verificados[0]?.id ?? null);
    setPasso(passoMfa({
      fatoresVerificados: verificados.length,
      nivelAtual: a?.currentLevel ?? null,
      obrigatorio: obr,
      dispensado: localStorage.getItem(chaveDispensa(uid)) === "1",
    }));
  }, []);

  useEffect(() => {
    avaliar();
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(avaliar, 0); });
    return () => data.subscription.unsubscribe();
  }, [avaliar]);

  const iniciar = async () => {
    setOcupado(true); setErro("");
    const { data: f } = await supabase.auth.mfa.listFactors();
    for (const x of (f?.all ?? []).filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Autenticador ${Date.now()}` });
    setOcupado(false);
    if (error) return setErro("Não foi possível gerar o QR Code. Tente novamente.");
    setFatorId(data.id); setQr({ img: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirmar = async () => {
    if (!fatorId || !codigoValido(codigo)) return setErro("Digite os 6 números que aparecem no aplicativo.");
    setOcupado(true); setErro("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo });
    setOcupado(false); setCodigo("");
    if (error) return setErro("Código incorreto ou vencido. Confira o aplicativo e tente de novo.");
    setQr(null);
    avaliar();
  };

  const agoraNao = () => { if (userId) localStorage.setItem(chaveDispensa(userId), "1"); setPasso("liberado"); };
  const sair = async () => { await supabase.auth.signOut(); window.location.assign("/login"); };

  if (rotaPublica(pathname) || passo === "liberado") return <>{children}</>;
  if (passo === "carregando") return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const campoCodigo = (
    <div className="space-y-2">
      <Label htmlFor="mfa-gate-code">Código de 6 dígitos</Label>
      <Input id="mfa-gate-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && confirmar()} className="text-center text-lg tracking-widest" />
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button className="w-full" onClick={confirmar} disabled={ocupado}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Confirmar</Button>
    </div>
  );

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Verificação em duas etapas</CardTitle>
          <CardDescription>
            {passo === "desafio"
              ? "Abra o aplicativo autenticador no celular e digite o código que aparece."
              : "Uma proteção extra: além da senha, você confirma a entrada com um código do seu celular. Assim, ninguém entra só com a sua senha."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passo === "desafio" && campoCodigo}
          {passo === "configurar" && !qr && (
            <>
              <ol className="text-sm space-y-1 list-decimal pl-5">
                <li>Instale um aplicativo autenticador (Google Authenticator ou Microsoft Authenticator).</li>
                <li>Toque em "Mostrar QR Code" e aponte a câmera do aplicativo.</li>
                <li>Digite aqui o código de 6 números.</li>
              </ol>
              {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
              <Button className="w-full" onClick={iniciar} disabled={ocupado}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Mostrar QR Code</Button>
              {!obrigatorio && <Button variant="ghost" className="w-full" onClick={agoraNao}>Agora não</Button>}
              {obrigatorio && <p className="text-xs text-muted-foreground">Esta conta administrativa só abre os painéis com a verificação ativada.</p>}
            </>
          )}
          {passo === "configurar" && qr && (
            <>
              <img src={qr.img} alt="QR Code para o aplicativo autenticador" className="w-48 h-48 mx-auto bg-card rounded-xl border" />
              <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Não consegue ler o QR Code?</summary><p className="break-all mt-1">Digite esta chave no aplicativo: {qr.secret}</p></details>
              {campoCodigo}
            </>
          )}
          <Button variant="link" className="w-full" onClick={sair}>Sair</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaGate;
