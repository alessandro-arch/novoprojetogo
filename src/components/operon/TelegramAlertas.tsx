import { useState } from "react";
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

export const AVISO_LGPD_TELEGRAM = "Seu chat do Telegram será usado apenas para enviar alertas do Operon Fomento. Você pode desconectar a qualquer momento.";

export function useStatusTelegram() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["oe-telegram", user?.id],
    enabled: !!user,
    queryFn: carregarStatusTelegram,
    refetchOnWindowFocus: true,
    refetchInterval: q => (q.state.data && !q.state.data.conectado && q.state.data.pendente_ate ? 5000 : false),
  });
}

/** Botão de conexão reutilizado em "Meus alertas" e na ficha do edital. */
export function ConectarTelegramButton({ rotulo = "Receber no Telegram" }: { rotulo?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bot = nomeBotTelegram();
  const gerar = useMutation({
    mutationFn: async () => {
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
  return <Button variant="outline" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
    {gerar.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Send />}{rotulo}
  </Button>;
}

const minutosRestantes = (ate: string) => Math.max(1, Math.ceil((new Date(ate).getTime() - Date.now()) / 60000));

export default function TelegramAlertas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState(false);
  const status = useStatusTelegram();
  const canal = useQuery({ queryKey: ["oe-telegram-canal", user?.id], enabled: !!user, queryFn: carregarCanalOrganizacao });
  const desconectar = useMutation({
    mutationFn: desconectarTelegram,
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
          <Button variant="ghost" size="sm" disabled={desconectar.isPending} onClick={() => setConfirmar(true)}>Desconectar</Button>
        </div>
        : <div className="space-y-3">
          <p className="text-sm text-muted-foreground max-w-2xl">{AVISO_LGPD_TELEGRAM}</p>
          {status.data?.pendente_ate && <p className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-muted-foreground" />Aguardando confirmação no Telegram (código válido por mais {minutosRestantes(status.data.pendente_ate)} min).</p>}
          <ConectarTelegramButton rotulo={status.data?.pendente_ate ? "Gerar novo código" : "Receber no Telegram"} />
        </div>}
      {canal.data && <Button asChild variant="outline"><a href={canal.data} target="_blank" rel="noopener noreferrer"><Users />Entrar no canal Operon Fomento</a></Button>}
    </CardContent>
    <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Desconectar o Telegram?</AlertDialogTitle><AlertDialogDescription>Você deixa de receber alertas por lá, inclusive dos editais que segue. Os avisos por e-mail continuam.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => desconectar.mutate()}>Desconectar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}
