import { curadorSimulado } from "@/lib/view-as";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Check, ExternalLink, Download, Loader2 } from "lucide-react";
import { oe, fmtData, rodadaVigente, SITUACOES, situacaoEdital, semNumero, exigeConfirmacaoSemRodadas, type EditalRow, type Rodada } from "@/pages/editais/CuradoriaPage";
import { supabase } from "@/integrations/supabase/client";
import { atualizarEditalNaLista, transicaoCuradoria, type AcaoCuradoria } from "@/lib/operon-curadoria-state";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge, { ABRANGENCIAS } from "@/components/operon/AbrangenciaBadge";
import { Switch } from "@/components/ui/switch";
import { Sparkles } from "lucide-react";
import { gerarSugestoes, type CampoIA, type SugestoesIA } from "@/lib/operon-ia";
import OperonIASugestao from "@/components/operon/OperonIASugestao";
import OperonIARodadas from "@/components/operon/OperonIARodadas";
import ValorCuradoria from "@/components/operon/ValorCuradoria";
import { confirmacaoAoPublicar, type EntradaValor } from "@/lib/operon-valores";

type Campo = "objetivo" | "recursos" | "quem_pode" | "requisitos_ies" | "contrapartida" | "areas";
const CAMPOS: { key: Campo; label: string }[] = [
  { key: "objetivo", label: "Objetivo" },
  { key: "recursos", label: "Recursos" },
  { key: "quem_pode", label: "Quem pode participar" },
  { key: "requisitos_ies", label: "Da Instituição de Ensino Superior" },
  { key: "contrapartida", label: "Contrapartida" },
  { key: "areas", label: "Áreas (separadas por vírgula)" },
];
const CONF: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  alta: { label: "Confiança alta", variant: "default" },
  media: { label: "Confiança média", variant: "secondary" },
  baixa: { label: "Confiança baixa", variant: "outline" },
};
const DESTAQUE = ["retificacao", "retificação", "errata", "adendo"];
const EVENTOS: Record<string, string> = {
  novo_edital: "Novo edital", prazo_alterado: "Prazo alterado", retificacao: "Retificação", errata: "Errata",
  adendo: "Adendo", anexo_novo: "Novo anexo", versao_atualizada: "Versão atualizada", rodada_aberta: "Rodada aberta",
  status_mudou: "Situação alterada", resultado_preliminar: "Resultado preliminar", resultado_final: "Resultado final",
  resultado_retificado: "Resultado retificado", resultado_sem_efeito: "Resultado sem efeito", edital_revogado: "Edital revogado",
  prazo_de_recurso: "Prazo de recurso",
};

interface Extracao { id: string; campo: string; valor: string | null; trecho_origem: string | null; confianca: string | null; status: string; created_at: string }

const useLista = <T,>(key: string, id: string, table: string, order: string, asc: boolean, extra?: (q: any) => any) =>
  useQuery({
    queryKey: [key, id],
    queryFn: async () => {
      let q = oe.from(table).select("*").eq("edital_id", id);
      if (extra) q = extra(q);
      const { data, error } = await q.order(order, { ascending: asc });
      if (error) throw error;
      return data as T[];
    },
  });

const Bloco = ({ q, vazio, children }: { q: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; data?: unknown[] }; vazio: string; children: React.ReactNode }) => {
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  if (q.isError) return <div className="space-y-2"><Placeholder title="Não foi possível carregar" text={(q.error as Error)?.message ?? ""} /><Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button></div>;
  if (!q.data?.length) return <Placeholder title={vazio} text="" />;
  return <>{children}</>;
};

const toText = (e: EditalRow, k: Campo) => (k === "areas" ? (e.areas ?? []).join(", ") : (e[k] ?? ""));

const EditalCuradoriaDetail = ({ edital, onDirtyChange, onPendingChange, onStatusChange }: {
  edital: EditalRow; onDirtyChange?: (dirty: boolean) => void; onPendingChange?: (pending: boolean) => void; onStatusChange?: (status: string) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<Campo, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.key, toText(edital, c.key)])) as Record<Campo, string>);
  const [restricaoIes, setRestricaoIes] = useState(edital.restricao_ies ?? "__none__");
  const [abrangencia, setAbrangencia] = useState(edital.abrangencia ?? "__none__");
  const [resumo, setResumo] = useState(edital.resumo_tldr ?? "");
  const [resumoSalvo, setResumoSalvo] = useState((edital.resumo_tldr ?? "").trim());
  const [confirmarPublicacao, setConfirmarPublicacao] = useState(false);
  const [estado, setEstado] = useState(edital);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [iaSobrescrever, setIaSobrescrever] = useState(false);
  const [sugestoes, setSugestoes] = useState<SugestoesIA>({});
  const [anterioresIA, setAnterioresIA] = useState<Partial<Record<CampoIA, string>>>({});
  const [salvandoRodadas, setSalvandoRodadas] = useState(false);
  const acompanharRodadas = useCallback((pending: boolean) => setSalvandoRodadas(pending), []);
  const curadorQ = useQuery({
    queryKey: ["oe-ia-curador", user?.id], enabled: Boolean(user), retry: false,
    queryFn: async () => { const sim = curadorSimulado(); if (sim !== null) return sim; const { data, error } = await supabase.rpc("oe_is_curador"); if (error) throw error; return data === true; },
  });
  const assinatura = JSON.stringify({ form, restricaoIes, abrangencia, resumo });
  const [salvo, setSalvo] = useState(assinatura);
  const sugestoesPendentes = Object.keys(sugestoes).length > 0;
  const [valorDirty, setValorDirty] = useState(false);
  const [entradaValor, setEntradaValor] = useState<EntradaValor | null>(null);
  const dirty = assinatura !== salvo || sugestoesPendentes;
  const escreverCampoIA = (key: CampoIA, value: string) => {
    if (key === "resumo_tldr") setResumo(value);
    else if (key === "restricao_ies") setRestricaoIes(value || "__none__");
    else if (key === "abrangencia") setAbrangencia(value || "__none__");
    else if (key !== "rodadas") setForm(current => ({ ...current, [key]: value }));
  };
  const concluirSugestao = (key: CampoIA, descartar = false) => {
    if (descartar && key !== "rodadas") escreverCampoIA(key, anterioresIA[key] ?? "");
    setSugestoes(current => { const next = { ...current }; delete next[key]; return next; });
  };
  const iaMut = useMutation({
    mutationFn: () => gerarSugestoes(edital.id, sobrescrever),
    onSuccess: result => {
      const anteriores: Partial<Record<CampoIA, string>> = {};
      for (const [key, suggestion] of Object.entries(result.propostas)) {
        const campo = key as CampoIA;
        if (typeof suggestion.valor !== "string" || campo === "rodadas" || campo === "valor_total_reais" || campo === "valor_tipo") continue;
        anteriores[campo] = campo === "resumo_tldr" ? resumo : campo === "restricao_ies" ? restricaoIes : campo === "abrangencia" ? abrangencia : form[campo];
        escreverCampoIA(campo, suggestion.valor);
      }
      setAnterioresIA(anteriores);
      setIaSobrescrever(sobrescrever);
      setSugestoes(result.propostas);
      toast({ title: Object.keys(result.propostas).length ? "Sugestões prontas para revisão" : "Nenhuma sugestão elegível", description: "Nada foi salvo ou publicado." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível gerar com IA", description: error.message, variant: "destructive" }),
  });
  useEffect(() => { setEstado(edital); }, [edital]);
  useEffect(() => { onDirtyChange?.(dirty || valorDirty); }, [dirty, valorDirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onPendingChange?.(false); }, [onDirtyChange, onPendingChange]);
  useEffect(() => {
    if (!dirty && !valorDirty) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [dirty, valorDirty]);
  const revisorQ = useQuery({
    queryKey: ["oe-revisor", estado.verificado_por], enabled: Boolean(estado.verificado_por),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, email").eq("user_id", estado.verificado_por ?? "").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const revisor = revisorQ.data?.full_name || revisorQ.data?.email || (estado.verificado_por === user?.id ? user?.user_metadata?.full_name || user?.email : null);

  const rodadasQ = useLista<Rodada>("oe-rodadas", edital.id, "oe_rodada", "ordem", true);
  const docsQ = useLista<any>("oe-docs", edital.id, "oe_documento", "publicado_em", false);
  const evQ = useLista<any>("oe-eventos", edital.id, "oe_evento", "ocorrido_em", false);
  const extQ = useLista<Extracao>("oe-extracoes", edital.id, "oe_extracao", "created_at", false,
    (q) => q.in("campo", CAMPOS.map((c) => c.key)));

  // Extração mais recente por campo (lista vem em created_at desc)
  const extPorCampo: Record<string, Extracao> = {};
  (extQ.data ?? []).forEach((x) => { if (!extPorCampo[x.campo]) extPorCampo[x.campo] = x; });

  const norm = (s: string | null | undefined) => (s ?? "").trim();
  const payloadCampos = (agora = new Date().toISOString()) => ({
    resumo_tldr: norm(resumo) || null,
    ...(norm(resumo) !== resumoSalvo ? { resumo_tldr_atualizado_em: agora } : {}),
    objetivo: norm(form.objetivo) || null,
    recursos: norm(form.recursos) || null,
    quem_pode: norm(form.quem_pode) || null,
    requisitos_ies: norm(form.requisitos_ies) || null,
    restricao_ies: restricaoIes === "__none__" ? null : restricaoIes,
    abrangencia: abrangencia === "__none__" ? null : abrangencia,
    contrapartida: norm(form.contrapartida) || null,
    areas: form.areas.split(",").map((s) => s.trim()).filter(Boolean),
  });

  const invalidar = () => {
    ["oe-editais", "oe-contadores", "oe-extracoes", "oe-eventos", "oe-rodadas", "oe-portal-painel", "oe-portal-ficha"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const mut = useMutation({
    onMutate: async (acao: AcaoCuradoria) => {
      await qc.cancelQueries({ queryKey: ["oe-editais"] });
      const anteriores = qc.getQueriesData<EditalRow[]>({ queryKey: ["oe-editais"] });
      const anterior = estado;
      const patch = transicaoCuradoria(acao, new Date().toISOString(), user?.id);
      const campos = acao === "descartar" || acao === "despublicar" ? {} : { ...payloadCampos(), ...(acao === "publicar" ? confirmacaoAoPublicar(entradaValor, user?.id, new Date().toISOString()) : {}) };
      const atualizado = { ...estado, ...campos, ...patch };
      qc.setQueriesData<EditalRow[]>({ queryKey: ["oe-editais"] }, (lista) => atualizarEditalNaLista(lista, edital.id, atualizado));
      setEstado(atualizado);
      onStatusChange?.(atualizado.status_curadoria);
      return { anteriores, anterior, assinatura, atualizado };
    },
    mutationFn: async (acao: AcaoCuradoria) => {
      const agora = new Date().toISOString();
      const campos = acao === "descartar" || acao === "despublicar" ? {} : { ...payloadCampos(agora), ...(acao === "publicar" ? confirmacaoAoPublicar(entradaValor, user?.id, agora) : {}) };
      const upd = { ...campos, ...transicaoCuradoria(acao, agora, user?.id) };
      const { error } = await oe.from("oe_edital").update(upd).eq("id", edital.id);
      if (error) throw error;
      let falhas = 0;
      if (acao === "publicar" || acao === "salvar_publicado") {
        for (const x of extQ.data ?? []) {
          const final = x.campo === "areas"
            ? form.areas.split(",").map((s) => s.trim()).filter(Boolean).join(",")
            : norm(form[x.campo as Campo]);
          const extraido = x.campo === "areas"
            ? (x.valor ?? "").split(",").map((s) => s.trim()).filter(Boolean).join(",")
            : norm(x.valor);
          try {
          const { error: e2 } = await oe.from("oe_extracao").update({
            status: final === extraido ? "aprovado" : "editado", revisado_por: user?.id, revisado_em: agora,
          }).eq("id", x.id);
          if (e2) falhas++;
          } catch { falhas++; }
        }
      }
      return { acao, falhas, upd };
    },
    onSuccess: ({ acao, falhas, upd }, _variavel, contexto) => {
      if (contexto) {
        setEstado({ ...contexto.atualizado, ...upd });
        if (acao !== "descartar" && acao !== "despublicar") {
          setSalvo(contexto.assinatura);
          setResumoSalvo(upd.resumo_tldr ?? "");
        }
      }
      if ((acao === "publicar" || acao === "salvar_publicado") && falhas > 0) {
        toast({
          title: "Edital publicado com ressalva",
          description: `O edital foi publicado, mas ${falhas} ${falhas === 1 ? "extração não foi marcada" : "extrações não foram marcadas"}. Revise as extrações manualmente.`,
          variant: "destructive",
        });
      } else {
        toast({ title: acao === "publicar" ? "Edital publicado" : acao === "revisao" ? "Salvo como em revisão" : acao === "despublicar" ? "Edital despublicado" : acao === "salvar_publicado" ? "Alterações publicadas salvas" : "Edital descartado" });
      }
    },
    onError: (e: Error, _acao, contexto) => {
      contexto?.anteriores.forEach(([key, data]) => qc.setQueryData(key, data));
      if (contexto) setEstado(contexto.anterior);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
    onSettled: invalidar,
  });

  const busy = mut.isPending || iaMut.isPending || salvandoRodadas;
  useEffect(() => { onPendingChange?.(busy); }, [busy, onPendingChange]);
  const publicado = estado.status_curadoria === "publicado";
  const vig = rodadaVigente(rodadasQ.data ?? []);
  const agora = Date.now();

  return (
    <div className="space-y-4 min-w-0">
      {publicado && !(mut.isPending && mut.variables === "publicar") && (
        <div role="status" className="sticky top-0 z-10 rounded-xl border border-success/30 bg-success-light p-4 text-foreground flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm min-w-0"><Check className="inline mr-2 h-4 w-4 text-success" />Publicado em {fmtData(estado.verificado_em, true)} por {revisor || "revisor identificado no registro"}. Já visível no portal dos usuários.</p>
          <Button asChild variant="outline" size="sm"><a href={`/editais/${edital.id}`} target="_blank" rel="noopener noreferrer">Ver no portal <ExternalLink className="ml-1 h-4 w-4" /></a></Button>
        </div>
      )}
      {curadorQ.data === true && <div className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={busy || sugestoesPendentes} onClick={() => iaMut.mutate()}>
            {iaMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{iaMut.isPending ? "Gerando sugestões…" : "Gerar com IA"}
          </Button>
          <div className="flex items-center gap-2"><Switch id="ia-sobrescrever" checked={sobrescrever} onCheckedChange={setSobrescrever} disabled={busy || sugestoesPendentes} /><Label htmlFor="ia-sobrescrever">Sobrescrever campos já preenchidos</Label></div>
          {iaMut.data?.free_model_daily_requests && <span className="text-xs text-muted-foreground tabular-nums">{iaMut.data.free_model_daily_requests.remaining} requisições gratuitas restantes</span>}
        </div>
        <p className="text-xs text-muted-foreground">Conteúdo gerado por IA, confira com o edital</p>
        {iaMut.data && <p className="text-xs text-muted-foreground break-all">Modelo utilizado: {iaMut.data.modelo}</p>}
        {sugestoesPendentes && <p className="text-sm text-primary">Aceite ou descarte cada sugestão antes de salvar. As datas exigem confirmação própria.</p>}
      </div>}
      <Card className="rounded-xl">
        <CardContent className="py-5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <FonteBadge slug={edital.oe_fonte?.slug} nome={edital.oe_fonte?.nome} />
            <AbrangenciaBadge abrangencia={abrangencia === "__none__" ? null : abrangencia} curadoria />
            {semNumero(edital.numero) ? <Badge variant="outline">Sem número</Badge> : <Badge variant="outline">Nº {edital.numero}</Badge>}
            {edital.categoria && <Badge variant="secondary">{edital.categoria}</Badge>}
            {situacaoEdital(edital) && <Badge variant="secondary">{SITUACOES[situacaoEdital(edital) ?? ""] ?? situacaoEdital(edital)}</Badge>}
          </div>
          <h3 className="text-lg font-bold font-heading text-foreground">{edital.titulo}</h3>
          {edital.url_oficial && (
            <a href={edital.url_oficial} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Abrir no site oficial <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <p className="text-xs text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Cartão público</CardTitle></CardHeader>
        <CardContent className="space-y-5"><fieldset disabled={busy} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="resumo-tldr">Em resumo (TL;DR)</Label>
            <Textarea id="resumo-tldr" rows={4} value={resumo} onChange={(event) => setResumo(event.target.value)} aria-describedby="resumo-tldr-dica resumo-tldr-contador" />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <p id="resumo-tldr-dica">3 a 4 frases, linguagem científica: objeto, público elegível, aporte, prazo, restrição de IES</p>
              <span id="resumo-tldr-contador" className="tabular-nums">{Array.from(resumo).length} caracteres</span>
            </div>
            <OperonIASugestao sugestao={sugestoes.resumo_tldr} aceitar={() => concluirSugestao("resumo_tldr")} descartar={() => concluirSugestao("resumo_tldr", true)} disabled={busy} />
          </div>
          {extQ.isError && <p className="text-xs text-destructive">Não foi possível carregar os valores extraídos.</p>}
          {CAMPOS.map(({ key, label }) => {
            const x = extPorCampo[key];
            return (
              <div key={key} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{key === "objetivo" && edital.oe_fonte?.slug === "fapes" ? "Finalidade" : label}</Label>
                  {key === "areas"
                    ? <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                    : <Textarea rows={4} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
                  {key !== "areas" && <OperonIASugestao sugestao={sugestoes[key]} aceitar={() => concluirSugestao(key)} descartar={() => concluirSugestao(key, true)} disabled={busy} />}
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 text-sm text-muted-foreground">
                  {extQ.isLoading ? <Skeleton className="h-16 w-full" /> : !x ? <p>Sem valor extraído.</p> : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">Valor extraído</span>
                        {x.confianca && CONF[x.confianca] && <Badge variant={CONF[x.confianca].variant}>{CONF[x.confianca].label}</Badge>}
                      </div>
                      <p className="whitespace-pre-wrap">{x.valor || "-"}</p>
                      {x.trecho_origem && <p className="text-xs italic border-l-2 border-border pl-2 whitespace-pre-wrap">"{x.trecho_origem}"</p>}
                      <Button type="button" variant="outline" size="sm" disabled={!x.valor}
                        onClick={() => setForm({ ...form, [key]: x.valor ?? "" })}>Usar valor extraído</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="space-y-1">
            <Label htmlFor="restricao-ies">Restrição para IES</Label>
            <Select value={restricaoIes} onValueChange={setRestricaoIes}>
              <SelectTrigger id="restricao-ies"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não analisado</SelectItem>
                <SelectItem value="sem_restricao">Sem restrição</SelectItem>
                <SelectItem value="exclui_privadas_com_fins_lucrativos">Exclui IES privadas com fins lucrativos</SelectItem>
                <SelectItem value="somente_publicas">Somente IES públicas</SelectItem>
                <SelectItem value="outra">Outra restrição</SelectItem>
                <SelectItem value="nao_informado">Edital não trata do tema</SelectItem>
              </SelectContent>
            </Select>
            <OperonIASugestao sugestao={sugestoes.restricao_ies} aceitar={() => concluirSugestao("restricao_ies")} descartar={() => concluirSugestao("restricao_ies", true)} disabled={busy} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="abrangencia">Abrangência</Label>
            <Select value={abrangencia} onValueChange={setAbrangencia}>
              <SelectTrigger id="abrangencia"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ABRANGENCIAS.map(([valor, label]) => <SelectItem key={valor} value={valor}>{label}</SelectItem>)}
                <SelectItem value="__none__">A definir</SelectItem>
              </SelectContent>
            </Select>
            <OperonIASugestao sugestao={sugestoes.abrangencia} aceitar={() => concluirSugestao("abrangencia")} descartar={() => concluirSugestao("abrangencia", true)} disabled={busy} />
          </div>
        </fieldset></CardContent>
      </Card>

      <ValorCuradoria edital={estado} onDirtyChange={setValorDirty} onEntradaChange={setEntradaValor}
        sugestaoValor={sugestoes.valor_total_reais} sugestaoTipo={sugestoes.valor_tipo}
        concluirSugestoes={() => setSugestoes(c => { const n = { ...c }; delete n.valor_total_reais; delete n.valor_tipo; return n; })} />

      {sugestoes.rodadas && <OperonIARodadas editalId={edital.id} sugestao={sugestoes.rodadas} sobrescrever={iaSobrescrever} concluir={() => concluirSugestao("rodadas")} onPending={acompanharRodadas} />}

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Datas das rodadas</CardTitle></CardHeader>
        <CardContent>
          <Bloco q={rodadasQ} vazio="Datas ainda não extraídas">
            <div className="space-y-2">
              {(rodadasQ.data ?? []).map((r) => {
                const emAndamento = vig === r && (r.abertura ? new Date(r.abertura).getTime() <= agora : true) && (r.prazo_fim ? new Date(r.prazo_fim).getTime() >= agora : true);
                const futura = r.abertura && new Date(r.abertura).getTime() > agora;
                return (
                  <div key={r.id ?? r.ordem} className={`rounded-xl border p-3 ${emAndamento ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{r.ordem}ª chamada</span>
                      {emAndamento && <Badge>Vigente</Badge>}
                      {futura && <Badge variant="outline">Inscrições abrem em {fmtData(r.abertura)}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Abertura: {fmtData(r.abertura, true)} · Prazo final: {fmtData(r.prazo_fim, true)}</p>
                    {r.texto_original && <p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap">"{r.texto_original}"</p>}
                  </div>
                );
              })}
            </div>
          </Bloco>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
        <CardContent>
          <Bloco q={docsQ} vazio="Nenhum documento">
            <div className="space-y-2">
              {(docsQ.data ?? []).map((d) => {
                const dest = DESTAQUE.includes(String(d.tipo ?? "").toLowerCase());
                return (
                  <div key={d.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${dest ? "border-destructive/50" : "border-border"}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={dest ? "destructive" : "secondary"}>{d.tipo ?? "Documento"}</Badge>
                        {d.versao != null && <span className="text-xs text-muted-foreground">v{d.versao}</span>}
                        {d.substituido && <Badge variant="outline">Substituído</Badge>}
                      </div>
                      <p className="text-sm text-foreground mt-1 break-words">{d.rotulo ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{fmtData(d.publicado_em)}</p>
                    </div>
                    {d.url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={d.url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-1" /> Baixar</a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Bloco>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
        <CardContent>
          <Bloco q={evQ} vazio="Nenhum evento">
            <ol className="space-y-3 border-l border-border pl-4">
              {(evQ.data ?? []).map((ev) => (
                <li key={ev.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">{EVENTOS[ev.tipo] ?? ev.tipo}</span>
                    {ev.origem === "carga_inicial" && <Badge variant="outline">Carga inicial</Badge>}
                    <span className="text-xs text-muted-foreground">{fmtData(ev.ocorrido_em, true)}</span>
                  </div>
                  {(ev.valor_anterior || ev.valor_novo) && (
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {ev.valor_anterior ?? "-"} → {ev.valor_novo ?? "-"}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Bloco>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 sticky bottom-0 bg-background py-3">
        {dirty && <span className="w-full text-sm text-warning-foreground" role="status">Alterações não salvas</span>}
        <Button variant={publicado && !dirty ? "outline" : "default"} disabled={busy || sugestoesPendentes || (publicado ? !dirty : rodadasQ.isLoading || rodadasQ.isError)} onClick={() => {
          if (publicado) { mut.mutate("salvar_publicado"); return; }
          if (exigeConfirmacaoSemRodadas(edital.situacao, rodadasQ.data ?? [])) setConfirmarPublicacao(true);
          else mut.mutate("publicar");
        }}>
          {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{publicado ? dirty ? "Salvar alterações publicadas" : "Publicado ✓" : "Aprovar e publicar"}
        </Button>
        <AlertDialog open={confirmarPublicacao} onOpenChange={setConfirmarPublicacao}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Publicar sem datas de inscrição?</AlertDialogTitle>
              <AlertDialogDescription>Este edital está sem datas de inscrição. Publicar mesmo assim?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => mut.mutate("publicar")}>Publicar mesmo assim</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {publicado ? <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" disabled={busy || sugestoesPendentes}>Despublicar</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Despublicar este edital?</AlertDialogTitle><AlertDialogDescription>O edital deixa de aparecer no portal dos usuários. Alterações não salvas permanecem no formulário.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => mut.mutate("despublicar")}>Despublicar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog> : <Button variant="outline" disabled={busy || sugestoesPendentes} onClick={() => mut.mutate("revisao")}>
          {mut.isPending && mut.variables === "revisao" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar como em revisão
        </Button>}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={busy || sugestoesPendentes}>Descartar</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar este edital?</AlertDialogTitle>
              <AlertDialogDescription>Ele sai da fila de curadoria, mas nenhum dado é apagado.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => mut.mutate("descartar")}>Descartar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default EditalCuradoriaDetail;
