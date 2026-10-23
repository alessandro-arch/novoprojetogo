import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { alterarCanalTelegram, alterarSeguimento, carregarSeguidor } from "@/lib/operon-portal";
import { mensagemErroTelegram } from "@/lib/operon-telegram";
import { useStatusTelegram } from "@/components/operon/TelegramAlertas";
import { simulando, useModoVisualizacao } from "@/lib/view-as";

function CanalTelegram({ editalId, ativo, onChange }: { editalId: string; ativo: boolean; onChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const status = useStatusTelegram();
  const modoVisualizacao = useModoVisualizacao();
  const m = useMutation({
    mutationFn: (v: boolean) => alterarCanalTelegram(editalId, user?.id ?? "", v).then(() => v),
    onSuccess: v => { onChange(v); toast({ title: v ? "Avisos deste edital também pelo Telegram" : "Avisos pelo Telegram desligados para este edital" }); },
    onError: e => toast({ title: "Não foi possível atualizar", description: mensagemErroTelegram(e), variant: "destructive" }),
  });
  if (status.isLoading) return <Skeleton className="h-6 w-48" />;
  if (!status.data?.conectado) return <div className="space-y-2">
    <div className="flex items-center gap-2"><Switch id={`tg-${editalId}`} checked={false} disabled aria-describedby={`tg-dica-${editalId}`} /><Label htmlFor={`tg-${editalId}`}>Também pelo Telegram</Label></div>
    <p id={`tg-dica-${editalId}`} className="text-sm text-muted-foreground">{status.isError ? "Não foi possível consultar sua conexão. Tente novamente em Meus alertas." : "Conecte seu Telegram em Meus alertas"}</p>
  </div>;
  return <div className="flex items-center gap-2">
    <Switch id={`tg-${editalId}`} checked={ativo} disabled={m.isPending || modoVisualizacao} onCheckedChange={v => { if (!simulando()) m.mutate(v); }} />
    <Label htmlFor={`tg-${editalId}`}>Também pelo Telegram</Label>
    {modoVisualizacao && <span className="text-sm text-muted-foreground">Modo visualização</span>}
  </div>;
}

export default function SeguirEditalButton({ editalId }: { editalId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const modoVisualizacao = useModoVisualizacao();
  const key = ["oe-seguidor", user?.id, editalId];
  const q = useQuery({ queryKey: key, enabled: !!user, queryFn: () => carregarSeguidor(editalId, user?.id ?? "") });
  const mutation = useMutation({
    mutationFn: () => alterarSeguimento(editalId, user?.id ?? "", !!q.data),
    onSuccess: (registro) => {
      qc.setQueryData(key, registro);
      qc.invalidateQueries({ queryKey: ["oe-seguidos", user?.id] });
      toast({ title: registro ? "Você está seguindo este edital" : "Você deixou de seguir este edital" });
    },
    onError: () => toast({ title: "Não foi possível atualizar o acompanhamento", description: "Tente novamente. Sua escolha anterior foi mantida.", variant: "destructive" }),
  });
  if (!user) return null;
  if (q.isLoading) return <Skeleton className="h-10 w-56" />;
  if (q.isError) return <div className="space-y-2"><p className="text-sm text-muted-foreground">Não foi possível consultar seu acompanhamento.</p><Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button></div>;
  return <div className="space-y-2 max-w-xl">
    <Button variant={q.data ? "secondary" : "default"} disabled={mutation.isPending || modoVisualizacao} aria-pressed={!!q.data} onClick={() => { if (!simulando()) mutation.mutate(); }}>
      {mutation.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : q.data ? <BellRing /> : <Bell />}
      {q.data ? "Seguindo este edital" : "Seguir este edital"}
    </Button>
    {modoVisualizacao && <p className="text-sm text-muted-foreground">Modo visualização</p>}
    <p className="text-sm text-muted-foreground">{q.data ? "Você receberá por e-mail toda alteração, retificação, errata, novo anexo, resultado preliminar e resultado final. Deixe de seguir quando quiser." : "Siga para receber por e-mail todas as alterações deste edital e os resultados."}</p>
    {q.data && <CanalTelegram editalId={editalId} ativo={q.data.canal_telegram} onChange={v => qc.setQueryData(key, { ...q.data, canal_telegram: v })} />}
  </div>;
}
