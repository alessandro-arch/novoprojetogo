import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, CheckCircle2, Clock, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { carregarCanalOrganizacao, carregarStatusTelegram, desconectarTelegram, gerarCodigoTelegram, linkVinculo, mensagemErroTelegram, nomeBotTelegram } from "@/lib/operon-telegram";
import { simulando, useModoVisualizacao } from "@/lib/view-as";

export const AVISO_LGPD_TELEGRAM = "Seu chat do Telegram será usado apenas para enviar alertas do Operon Fomento. Você pode desconectar a qualquer momento.";

export function useStatusTelegram() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["oe-telegram", user?.id],
    enabled: !!user,
    queryFn: carregarStatusTelegram,
    refetchOnWindowFocus: true,
    refetchInterval: q => (q.state.data && !q.state.data.conectado && q.state.data.pendente_ate && new Date(q.state.data.pendente_ate).getTime() > Date.now() ? 5000 : false),
  });
}

/** Botão de conexão reutilizado em "Meus alertas" e na ficha do edital. */
export function ConectarTelegramButton({ rotulo = "Receber no Telegram" }: { rotulo?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bot = nomeBotTelegram();
  const modoVisualizacao = useModoVisualizacao();
  const gerar = useMutation({
    mutationFn: async () => {
      if (simulando()) return;
      // Abre a aba no clique para não ser bloqueada; o endereço chega depois.
      const aba = window.open("about:blank", "_blank");
      try {
        const codigo = await gerarCodigoTelegram();
        const url = linkVinculo(bot ?? "", codigo);
        if (aba) { aba.opener = null; aba.location.href = url; } else window.open(url, "_blank", "noopener");
      } catch (e) { aba?.close(); throw e; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["oe-telegram", user?.id] }); toast({ title: "Confirme no Telegram", description: "Toque em Iniciar na conversa com o bot. O código vale por 15 minutos." }); },
    onError: e => toast({ title: "Não foi possível conectar", description: mensagemErroTelegram(e), variant: "destructive" }),
  });
  if (!bot) return <p className="text-sm text-muted-foreground">Telegram indisponível no momento.</p>;
  return <div className="space-y-2">
    <p className="text-sm text-muted-foreground">Para receber alertas no Telegram você precisa de uma conta no Telegram (app gratuito). <a className="underline underline-offset-4" href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer">Baixar Telegram</a></p>
    <p className="text-sm text-muted-foreground">O Telegram é opcional e adicional. O e-mail continua sendo o canal padrão.</p>
    <Button variant="outline" disabled={gerar.isPending || modoVisualizacao} onClick={() => { if (!simulando()) gerar.mutate(); }}>
      {gerar.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Send />}{rotulo}
    </Button>
    {modoVisualizacao && <p className="text-sm text-muted-foreground">Modo visualização</p>}
  </div>;
}

const minutosRestantes = (ate: string) => Math.max(1, Math.ceil((new Date(ate).getTime() - Date.now()) / 60000));

export default function TelegramAlertas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState(false);
  const modoVisualizacao = useModoVisualizacao();
  const status = useStatusTelegram();
  const [ultimoCodigo, setUltimoCodigo] = useState<{ userId: string; ate: string } | null>(null);
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    if (!user || status.data?.conectado) { setUltimoCodigo(null); return; }
    if (status.data?.pendente_ate) setUltimoCodigo({ userId: user.id, ate: status.data.pendente_ate });
  }, [user?.id, status.data?.conectado, status.data?.pendente_ate]);
  const pendenteAte = status.data?.pendente_ate ?? (ultimoCodigo?.userId === user?.id ? ultimoCodigo?.ate : null);
  const expirado = !!pendenteAte && new Date(pendenteAte).getTime() <= agora;
  useEffect(() => {
    setAgora(Date.now());
    if (!pendenteAte || status.data?.conectado) return;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendenteAte, status.data?.conectado]);
  const canal = useQuery({ queryKey: ["oe-telegram-canal", user?.id], enabled: !!user, queryFn: carregarCanalOrganizacao });
  const desconectar = useMutation({
    mutationFn: async () => { if (!simulando()) await desconectarTelegram(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["oe-telegram", user?.id] }); qc.invalidateQueries({ queryKey: ["oe-seguidos", user?.id] }); qc.invalidateQueries({ queryKey: ["oe-seguidor"] }); toast({ title: "Telegram desconectado" }); },
    onError: e => toast({ title: "Não foi possível desconectar", description: mensagemErroTelegram(e), variant: "destructive" }),
  });
  if (!user) return null;
  return <Card className="rounded-xl">
    <CardHeader className="pb-3"><CardTitle className="text-lg font-heading">Meus alertas</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {status.isLoading ? <Skeleton className="h-10 w-56" /> : status.isError ? <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><p>Não foi possível consultar sua conexão com o Telegram.</p><Button variant="outline" size="sm" onClick={() => status.refetch()}>Tentar novamente</Button></div>
        : status.data?.conectado ? <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Telegram conectado</Badge>
          <Button variant="ghost" size="sm" disabled={desconectar.isPending || modoVisualizacao} onClick={() => setConfirmar(true)}>Desconectar</Button>
          {modoVisualizacao && <p className="text-sm text-muted-foreground">Modo visualização</p>}
        </div>
        : <div className="space-y-3">
          <p className="text-sm text-muted-foreground max-w-2xl">{AVISO_LGPD_TELEGRAM}</p>
          {expirado ? <p role="status" className="text-sm text-muted-foreground">O código de vínculo expirou. Conecte seu Telegram novamente para receber avisos por lá. Os avisos por e-mail continuam.</p>
            : pendenteAte && <p className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-muted-foreground" />Aguardando confirmação no Telegram (código válido por mais {minutosRestantes(pendenteAte)} min).</p>}
          <ConectarTelegramButton />
        </div>}
      {canal.data && <Button asChild variant="outline"><a href={canal.data} target="_blank" rel="noopener noreferrer"><Users />Entrar no canal Operon Fomento</a></Button>}
    </CardContent>
    <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Desconectar o Telegram?</AlertDialogTitle><AlertDialogDescription>Você deixa de receber alertas por lá, inclusive dos editais que segue. Os avisos por e-mail continuam.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={modoVisualizacao} onClick={() => { if (!simulando()) desconectar.mutate(); }}>Desconectar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}
