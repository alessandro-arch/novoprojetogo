import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { confirmarRodadasIA, RodadaIASchema, type RodadaIA, type SugestaoIA } from "@/lib/operon-ia";
import { Loader2, Check, X } from "lucide-react";

export default function OperonIARodadas({ editalId, sugestao, sobrescrever, concluir, onPending }: {
  editalId: string; sugestao: SugestaoIA; sobrescrever: boolean; concluir: () => void; onPending: (pending: boolean) => void;
}) {
  const [dates, setDates] = useState<RodadaIA[]>(Array.isArray(sugestao.valor) ? sugestao.valor : []);
  const [confirm, setConfirm] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => confirmarRodadasIA(editalId, dates, sobrescrever),
    onSuccess: () => {
      ["oe-rodadas", "oe-editais", "oe-portal-painel", "oe-portal-ficha"].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      toast({ title: "Datas das rodadas confirmadas e salvas" }); concluir();
    },
    onError: () => toast({ title: "Não foi possível salvar as rodadas", description: "Revise as datas em ISO, com fuso horário, e tente novamente.", variant: "destructive" }),
  });
  useEffect(() => { onPending(mutation.isPending); }, [mutation.isPending, onPending]);
  useEffect(() => () => onPending(false), [onPending]);
  const labels = { abertura: "Abertura", prazo_fim: "Prazo final", resultado_em: "Resultado" };
  return <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
    <Badge variant="outline">Sugerido pela IA</Badge>
    <p className="text-sm font-medium">Datas das rodadas para confirmação</p>
    {dates.map((r, i) => <div key={i} className="grid gap-3 md:grid-cols-3">
      {(Object.keys(labels) as (keyof RodadaIA)[]).map(k => <div key={k} className="space-y-1">
        <Label htmlFor={`ia-rodada-${i}-${k}`}>{i + 1}ª chamada: {labels[k]}</Label>
        <Input id={`ia-rodada-${i}-${k}`} value={r[k] ?? ""} placeholder="2026-12-01T18:00:00-03:00" disabled={mutation.isPending} onChange={event => setDates(current => current.map((d, index) => index === i ? { ...d, [k]: event.target.value || null } : d))} />
      </div>)}
    </div>)}
    <p className="text-xs text-muted-foreground">Datas em ISO com fuso explícito. Campos vazios permanecem sem data. {sobrescrever ? "Ao confirmar, as chamadas existentes serão atualizadas na mesma ordem; chamadas adicionais serão incluídas." : "As chamadas existentes serão preservadas; apenas datas novas serão incluídas."}</p>
    <details><summary className="cursor-pointer text-sm text-primary">Trecho de origem</summary><p className="whitespace-pre-line text-sm text-muted-foreground">{sugestao.trecho_origem}</p></details>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => {
        if (!dates.length || dates.some(r => !RodadaIASchema.safeParse(r).success)) { toast({ title: "Revise as datas", description: "Use datas ISO com fuso explícito e prazo final após a abertura.", variant: "destructive" }); return; }
        setConfirm(true);
      }}>{mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}Confirmar e salvar rodadas</Button>
      <Button variant="ghost" size="sm" onClick={concluir} disabled={mutation.isPending}><X className="mr-1 h-4 w-4" />Descartar datas sugeridas</Button>
    </div>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Confirmar as datas das rodadas?</AlertDialogTitle><AlertDialogDescription>Estas datas serão gravadas agora. Confira cada data com o edital. Os demais campos não serão salvos nem publicados.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Continuar revisando</AlertDialogCancel><AlertDialogAction onClick={() => mutation.mutate()}>Confirmar gravação das rodadas</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}