import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { simulando, useModoVisualizacao } from "@/lib/view-as";
import OperonIASugestao from "@/components/operon/OperonIASugestao";
import type { SugestaoIA } from "@/lib/operon-ia";
import { oe, fmtData, type EditalRow } from "@/pages/editais/CuradoriaPage";
import { entradaDoEdital, montarPayloadValor, validarValor, situacaoValor, ROTULO_TIPO_VALOR, type EntradaValor, type TipoValor } from "@/lib/operon-valores";

/** Grava somente os cinco campos de valor do edital. O id de quem confirma vem da sessão. */
export async function salvarValorEdital(editalId: string, entrada: EntradaValor, confirmar: boolean) {
  if (simulando()) throw new Error("Modo visualização: gravação bloqueada.");
  const erro = validarValor(entrada); if (erro) throw new Error(erro);
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  if (simulando()) throw new Error("Modo visualização: gravação bloqueada.");
  const payload = montarPayloadValor(entrada, { confirmar, userId: data.user.id });
  const { error } = await oe.from("oe_edital").update(payload).eq("id", editalId);
  if (error) throw error;
  return payload;
}

export function aplicarSugestaoValor(v: EntradaValor, valor?: SugestaoIA, tipo?: SugestaoIA): EntradaValor {
  const n = typeof valor?.valor === "string" ? Number(valor.valor) : NaN;
  const t = typeof tipo?.valor === "string" && tipo.valor in ROTULO_TIPO_VALOR ? tipo.valor as TipoValor : null;
  return {
    ...v,
    ...(Number.isFinite(n) ? { valor: n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } : {}),
    ...(t ? { tipo: t } : {}),
    ...(t === "nao_informado" ? { valor: "" } : {}),
  };
}

export default function ValorCuradoria({ edital, onDirtyChange, onEntradaChange, sugestaoValor, sugestaoTipo, concluirSugestoes }: {
  edital: EditalRow; onDirtyChange?: (d: boolean) => void; onEntradaChange?: (v: EntradaValor) => void;
  sugestaoValor?: SugestaoIA; sugestaoTipo?: SugestaoIA; concluirSugestoes?: () => void;
}) {
  const { globalRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const modoVisualizacao = useModoVisualizacao();
  const inicial = useMemo(() => entradaDoEdital(edital), [edital]);
  const [v, setV] = useState<EntradaValor>(inicial);
  const [base, setBase] = useState(edital);
  useEffect(() => { setV(entradaDoEdital(edital)); setBase(edital); }, [edital]);
  const dirty = JSON.stringify(v) !== JSON.stringify(entradaDoEdital(base));
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => { onEntradaChange?.(v); }, [v, onEntradaChange]);
  const [anterior, setAnterior] = useState<EntradaValor | null>(null);
  const temSugestao = !!(sugestaoValor || sugestaoTipo);
  useEffect(() => {
    if (!temSugestao) return;
    setV(atual => { setAnterior(atual); return aplicarSugestaoValor(atual, sugestaoValor, sugestaoTipo); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestaoValor, sugestaoTipo]);
  const sugestaoUnica: SugestaoIA | undefined = temSugestao ? {
    valor: "", atual_vazio: true, atual_cortado: false,
    trecho_origem: [sugestaoValor?.trecho_origem, sugestaoTipo?.trecho_origem].filter((t, i, a) => t && a.indexOf(t) === i).join("\n\n"),
  } : undefined;
  const erro = validarValor(v);
  const confirmadoAntes = situacaoValor(base) === "confirmado" || (base.valor_tipo === "por_agencia" && !!base.valor_confirmado_em);

  const m = useMutation({
    mutationFn: (confirmar: boolean) => salvarValorEdital(edital.id, v, confirmar),
    onSuccess: (payload, confirmar) => {
      setBase({ ...base, ...payload });
      ["oe-editais", "oe-portal-painel", "oe-portal-ficha"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast({ title: confirmar ? "Valor confirmado" : "Valor salvo sem confirmação", description: confirmar ? "O valor passa a contar nos totais do portal." : "O valor aparece como aguardando confirmação." });
    },
    onError: (e: Error) => toast({ title: "Não foi possível salvar o valor", description: e.message, variant: "destructive" }),
  });

  if (globalRole !== "icca_admin") return null;
  const bloqueado = m.isPending || modoVisualizacao;
  return <Card className="rounded-xl">
    <CardHeader><CardTitle className="text-base">Valor do edital</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">Ao aprovar e publicar, o valor preenchido aqui é confirmado automaticamente.</p>
      <p className="text-sm text-muted-foreground">{base.valor_confirmado_em ? `Confirmado em ${fmtData(base.valor_confirmado_em, true)}.` : "Valor ainda não confirmado pela curadoria."}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="valor-reais">Valor (R$)</Label>
          <Input id="valor-reais" inputMode="decimal" placeholder="1.500.000,00" value={v.valor} onChange={e => setV({ ...v, valor: e.target.value })} aria-invalid={!!erro} aria-describedby="valor-erro" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="valor-tipo">Tipo</Label>
          <Select value={v.tipo} onValueChange={t => setV({ ...v, tipo: t as TipoValor | "__none__" })}>
            <SelectTrigger id="valor-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(ROTULO_TIPO_VALOR) as [TipoValor, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              <SelectItem value="__none__">A definir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="valor-obs">Observação</Label>
        <Textarea id="valor-obs" rows={3} value={v.observacao} onChange={e => setV({ ...v, observacao: e.target.value })} />
      </div>
      <OperonIASugestao sugestao={sugestaoUnica} disabled={m.isPending}
        aceitar={() => { setAnterior(null); concluirSugestoes?.(); }}
        descartar={() => { if (anterior) setV(anterior); setAnterior(null); concluirSugestoes?.(); }} />
      {erro && <p id="valor-erro" className="text-sm text-destructive" role="alert">{erro}</p>}
      {dirty && confirmadoAntes && <p className="text-sm text-muted-foreground" role="status">Ao salvar sem confirmar, a confirmação anterior é removida.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={bloqueado || !!erro || !dirty} onClick={() => m.mutate(false)}>Salvar sem confirmar</Button>
        <Button disabled={bloqueado || !!erro || v.tipo === "__none__"} onClick={() => m.mutate(true)}>{m.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar valor</Button>
        {modoVisualizacao && <span className="text-sm text-muted-foreground">Modo visualização</span>}
      </div>
    </CardContent>
  </Card>;
}
