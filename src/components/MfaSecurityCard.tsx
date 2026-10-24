import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";

type Fator = { id: string; friendly_name?: string | null; status: string };

const MfaSecurityCard = () => {
  const { toast } = useToast();
  const [fatores, setFatores] = useState<Fator[]>([]);
  const [novo, setNovo] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFatores((data?.totp ?? []) as Fator[]);
  };
  useEffect(() => { carregar(); }, []);

  const erro = (e: unknown) => toast({ title: "Erro", description: (e as Error)?.message ?? "Tente novamente.", variant: "destructive" });

  const iniciar = async () => {
    setOcupado(true);
    // Remove cadastros não concluídos antes de criar outro.
    for (const f of fatores.filter((f) => f.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Autenticador ${Date.now()}` });
    setOcupado(false);
    if (error) return erro(error);
    setNovo({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verificar = async () => {
    if (!novo || !/^\d{6}$/.test(codigo)) return toast({ title: "Informe o código de 6 dígitos", variant: "destructive" });
    setOcupado(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: novo.id, code: codigo });
    setOcupado(false);
    if (error) return erro(error);
    setNovo(null); setCodigo("");
    toast({ title: "Verificação em duas etapas ativada" });
    carregar();
  };

  const remover = async (id: string) => {
    if (!window.confirm("Remover este autenticador?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return erro(error);
    toast({ title: "Autenticador removido" });
    carregar();
  };

  const verificados = fatores.filter((f) => f.status === "verified");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Segurança</CardTitle>
        <CardDescription>Verificação em duas etapas com aplicativo autenticador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verificados.length === 0 && !novo && <p className="text-sm text-muted-foreground">Nenhum autenticador cadastrado.</p>}
        {verificados.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm">Autenticador ativo</span>
            <Button variant="outline" size="sm" onClick={() => remover(f.id)}>Remover</Button>
          </div>
        ))}
        {novo ? (
          <div className="space-y-3">
            <p className="text-sm">Escaneie o QR code no aplicativo autenticador e digite o código gerado.</p>
            <img src={novo.qr} alt="QR code para o aplicativo autenticador" className="w-44 h-44 bg-card rounded-xl border" />
            <p className="text-xs text-muted-foreground break-all">Chave manual: {novo.secret}</p>
            <Label htmlFor="mfa-code">Código</Label>
            <Input id="mfa-code" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
            <Button onClick={verificar} disabled={ocupado}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Ativar</Button>
          </div>
        ) : verificados.length === 0 && (
          <Button onClick={iniciar} disabled={ocupado}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Cadastrar autenticador</Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MfaSecurityCard;
