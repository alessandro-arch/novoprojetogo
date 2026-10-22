import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, Check, FileText, LogOut } from "lucide-react";
import { logoutOperon } from "@/lib/operon-access";
import { useToast } from "@/hooks/use-toast";
import EditalCuradoriaDetail from "@/components/operon/EditalCuradoriaDetail";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge, { ABRANGENCIAS, correspondeAbrangencia } from "@/components/operon/AbrangenciaBadge";
import type { Tables } from "@/integrations/supabase/types";

// Tabelas oe_* ainda não estão nos tipos gerados: cast pontual.
export const oe = supabase as any;

export interface Rodada extends Partial<Pick<Tables<"oe_rodada">, "resultado_em">> { id?: string; ordem: number; abertura: string | null; prazo_fim: string | null; texto_original?: string | null }
export interface EditalRow extends Partial<Pick<Tables<"oe_edital">, "resumo_tldr" | "resumo_tldr_atualizado_em" | "publicado_em">> {
  id: string; fonte_id: string; numero: string | null; ano: number | null; titulo: string; categoria: string | null;
  situacao: string | null; status_curadoria: string; url_oficial: string | null; visto_ultima_vez_em: string | null;
  objetivo: string | null; recursos: string | null; quem_pode: string | null; contrapartida: string | null; areas: string[] | null;
  requisitos_ies: string | null; restricao_ies: string | null;
  abrangencia?: string | null;
  verificado_em?: string | null; verificado_por?: string | null;
  oe_fonte?: { slug: string; nome: string } | null; oe_rodada?: Rodada[];
}

export const fmtData = (v: string | null | undefined, hora = false) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}) });
};

const t = (v: string | null) => (v ? new Date(v).getTime() : null);

/** Em andamento hoje; senão a próxima futura; senão a última. */
export const rodadaVigente = (rodadas: Rodada[] = [], agora = Date.now()): Rodada | null => {
  if (!rodadas.length) return null;
  const ord = [...rodadas].sort((a, b) => a.ordem - b.ordem);
  const andamento = ord.find((r) => (t(r.abertura) ?? -Infinity) <= agora && (t(r.prazo_fim) ?? Infinity) >= agora);
  if (andamento) return andamento;
  const futura = ord.filter((r) => (t(r.abertura) ?? t(r.prazo_fim) ?? 0) > agora)
    .sort((a, b) => (t(a.abertura) ?? t(a.prazo_fim) ?? 0) - (t(b.abertura) ?? t(b.prazo_fim) ?? 0))[0];
  return futura ?? ord[ord.length - 1];
};

/** Aberto ou com rodada em andamento/futura; datas ausentes não comprovam vigência. */
export const ehVigente = (e: EditalRow, agora = Date.now()): boolean => {
  if (e.status_curadoria === "descartado") return false;
  if (e.situacao === "aberto") return true;
  return (e.oe_rodada ?? []).some((r) => {
    const abertura = t(r.abertura);
    const fim = t(r.prazo_fim);
    return (fim != null && fim >= agora && (abertura ?? -Infinity) <= agora)
      || (abertura != null && abertura > agora && (fim == null || fim >= abertura));
  });
};

export const exigeConfirmacaoSemRodadas = (situacao: string | null, rodadas: Rodada[]): boolean =>
  situacao === "aberto" && rodadas.length === 0;

/** Dias corridos até o prazo, no horário de Brasília (0 = fecha hoje). */
export const diasAte = (prazo: string | null | undefined, agora = new Date()): number | null => {
  if (!prazo) return null;
  const d = new Date(prazo);
  if (isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return Math.round((new Date(fmt.format(d)).getTime() - new Date(fmt.format(agora)).getTime()) / 86400000);
};

export const SITUACOES: Record<string, string> = { aberto: "Aberto", em_julgamento: "Em julgamento", encerrado: "Encerrado", resultado: "Resultado", revogado: "Revogado" };
export const STATUS: Record<string, string> = { rascunho: "Rascunho", em_revisao: "Em revisão", publicado: "Publicado", descartado: "Descartado" };
const NONE = "__none__";
export const StatusCuradoriaBadge = ({ status }: { status: string }) => (
  <Badge variant="outline" className={status === "publicado" ? "border-success/30 bg-success-light text-success" : status === "em_revisao" ? "border-warning/30 bg-warning-light text-warning-foreground" : "border-border bg-muted text-muted-foreground"}>
    {status === "publicado" && <Check className="mr-1 h-3 w-3" />}{STATUS[status] ?? status}
  </Badge>
);
export const semNumero = (n: string | null) => !n || n.trim().toLowerCase().replace(/\s/g, "") === "s/n";

const CuradoriaPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saindo, setSaindo] = useState(false);
  const handleLogout = async () => {
    setSaindo(true);
    try { await logoutOperon(navigate); }
    catch { toast({ title: "Erro ao sair", description: "Não foi possível encerrar sua sessão. Tente novamente.", variant: "destructive" }); }
    finally { setSaindo(false); }
  };
  const isMobile = useIsMobile();
  const [fonte, setFonte] = useState(NONE);
  const [abrangencia, setAbrangencia] = useState(NONE);
  const [situacao, setSituacao] = useState(NONE);
  const [vigencia, setVigencia] = useState("vigentes");
  const [status, setStatus] = useState(NONE);
  const [ano, setAno] = useState("2026");
  const [selId, setSelId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trocaPendente, setTrocaPendente] = useState<(() => void) | null>(null);
  const mudar = (acao: () => void) => {
    if (saving) return;
    if (dirty) setTrocaPendente(() => acao);
    else acao();
  };
  const acompanharAlteracoes = useCallback((valor: boolean) => setDirty(valor), []);
  const acompanharGravacao = useCallback((valor: boolean) => setSaving(valor), []);
  const manterVisivel = useCallback((novoStatus: string) => {
    setStatus((atual) => atual !== NONE && atual !== novoStatus ? NONE : atual);
  }, []);

  const fontesQ = useQuery({
    queryKey: ["oe-fontes"],
    queryFn: async () => {
      const { data, error } = await oe.from("oe_fonte").select("id, slug, nome").order("nome");
      if (error) throw error;
      return data as { id: string; slug: string; nome: string }[];
    },
  });

  const aplicar = (q: any, comStatus: boolean) => {
    if (comStatus && status !== NONE) q = q.eq("status_curadoria", status);
    if (situacao !== NONE) q = q.eq("situacao", situacao);
    if (fonte !== NONE) q = q.eq("fonte_id", fonte);
    if (ano !== NONE) q = q.eq("ano", Number(ano));
    return q;
  };

  const listaQ = useQuery({
    queryKey: ["oe-editais", fonte, situacao, ano],
    queryFn: async () => {
      const { data, error } = await aplicar(
        oe.from("oe_edital").select("id, fonte_id, numero, ano, titulo, categoria, situacao, status_curadoria, url_oficial, visto_ultima_vez_em, verificado_em, verificado_por, publicado_em, resumo_tldr, resumo_tldr_atualizado_em, objetivo, recursos, quem_pode, requisitos_ies, restricao_ies, abrangencia, contrapartida, areas, oe_fonte(slug, nome), oe_rodada(id, ordem, abertura, prazo_fim, resultado_em)"),
        false,
      ).limit(1000);
      if (error) throw error;
      return data as EditalRow[];
    },
  });

  const listaBase = useMemo(() => {
    const agora = Date.now();
    const rows = (listaQ.data ?? [])
      .filter((e) => correspondeAbrangencia(e.abrangencia, abrangencia))
      .filter((e) => vigencia === "vigentes" ? ehVigente(e, agora) : vigencia === "em_julgamento" ? e.situacao === "em_julgamento" : true)
      .map((e) => ({ e, v: rodadaVigente(e.oe_rodada) }));
    const prazo = (x: { v: Rodada | null }) => t(x.v?.prazo_fim ?? null);
    const futuros = rows.filter((x) => { const p = prazo(x); return p != null && p >= agora; }).sort((a, b) => (prazo(a) ?? 0) - (prazo(b) ?? 0));
    const vencidos = rows.filter((x) => { const p = prazo(x); return p != null && p < agora; }).sort((a, b) => (prazo(b) ?? 0) - (prazo(a) ?? 0));
    const semDatas = rows.filter((x) => prazo(x) == null)
      .sort((a, b) => (t(b.e.visto_ultima_vez_em) ?? 0) - (t(a.e.visto_ultima_vez_em) ?? 0));
    return [...futuros, ...vencidos, ...semDatas];
  }, [listaQ.data, vigencia, abrangencia]);

  const lista = useMemo(() => listaBase.filter(({ e }) => status === NONE || e.status_curadoria === status), [listaBase, status]);
  const contagens = Object.fromEntries(Object.keys(STATUS).map((s) => [s, listaBase.filter(({ e }) => e.status_curadoria === s).length]));
  const vigentesHoje = useMemo(() => lista.filter((x) => ehVigente(x.e)).length, [lista]);

  const selecionado = listaQ.data?.find((e) => e.id === selId) ?? null;
  const anoAtual = new Date().getFullYear();
  const anos = Array.from(new Set([anoAtual + 1, anoAtual, 2026, anoAtual - 1, anoAtual - 2])).sort((a, b) => b - a);

  const filtro = (label: string, value: string, set: (v: string) => void, opts: [string, string][], todos = "Todos") => (
    <div className="space-y-1 min-w-[140px] flex-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} disabled={saving} onValueChange={(v) => mudar(() => { set(v); setSelId(null); })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{todos}</SelectItem>
          {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const listaView = (
    <div className="space-y-2">
      {!listaQ.isLoading && !listaQ.isError && (
        <p className="text-sm text-muted-foreground">{vigencia === "em_julgamento" ? `${lista.length} editais em julgamento` : `${vigentesHoje} editais vigentes`}</p>
      )}
      {listaQ.isLoading ? (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
      ) : listaQ.isError ? (
        <div className="space-y-2">
          <Placeholder title="Não foi possível carregar os editais" text={(listaQ.error as Error)?.message ?? "Erro desconhecido"} />
          <Button variant="outline" size="sm" onClick={() => listaQ.refetch()}>Tentar novamente</Button>
        </div>
      ) : lista.length === 0 ? (
        <Placeholder title="Nenhum edital com esses filtros" text="Ajuste fonte, situação, status ou ano." />
      ) : (
        lista.map(({ e, v }) => (
          <Button
            variant="ghost"
            key={e.id}
            disabled={saving}
            onClick={() => { if (selId !== e.id) mudar(() => setSelId(e.id)); }}
            className={`h-auto block whitespace-normal w-full text-left bg-card rounded-xl border p-4 transition-shadow hover:shadow-card ${selId === e.id ? "border-primary" : "border-border"}`}
          >
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <StatusCuradoriaBadge status={e.status_curadoria} />
              <FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} />
              <AbrangenciaBadge abrangencia={e.abrangencia} curadoria />
              {semNumero(e.numero) ? <Badge variant="outline">Sem número</Badge> : <span className="text-xs text-muted-foreground">Nº {e.numero}</span>}
              {e.situacao && <Badge variant="secondary">{SITUACOES[e.situacao] ?? e.situacao}</Badge>}
              {!v && e.situacao === "aberto" && <Badge variant="destructive">Prazo a confirmar</Badge>}
              {(() => {
                const dias = diasAte(v?.prazo_fim);
                if (dias == null || dias < 0) return null;
                return <Badge variant={dias <= 7 ? "default" : "outline"}>{dias === 0 ? "Fecha hoje" : `Faltam ${dias} dias`}</Badge>;
              })()}
            </div>
            {e.status_curadoria === "publicado" && e.verificado_em && <p className="text-xs text-success mb-1">Publicado em {fmtData(e.verificado_em, true)}</p>}
            <p className="font-medium text-foreground text-sm line-clamp-2">{e.titulo}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {e.categoria ?? "Sem categoria"} · {!v && e.situacao === "em_julgamento" ? "Inscrições encerradas, acompanhe o resultado" : `Prazo: ${v ? fmtData(v.prazo_fim) : e.situacao === "aberto" ? "A confirmar" : "Datas ainda não extraídas"}`}
            </p>
          </Button>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading text-foreground">Operon Editais</h1>
              <p className="text-xs text-muted-foreground">Curadoria</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/editais"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link></Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={saindo}><LogOut className="w-4 h-4 mr-1" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground">Curadoria de editais</h2>
          <p className="text-sm text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
        </div>

        <Tabs value={status} onValueChange={(valor) => mudar(() => { setStatus(valor); setSelId(null); })}>
          <TabsList className="h-auto flex flex-wrap justify-start gap-1">
            {[["rascunho", "Rascunhos"], ["em_revisao", "Em revisão"], ["publicado", "Publicados"], ["descartado", "Descartados"], [NONE, "Todos"]].map(([valor, label]) => (
              <TabsTrigger key={valor} value={valor} disabled={saving}>
                {label} <span className="ml-2 tabular-nums">{listaQ.isLoading ? "…" : listaQ.isError ? "-" : valor === NONE ? listaBase.length : contagens[valor] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3">
          {filtro("Vigência", vigencia, setVigencia, [["vigentes", "Vigentes"], ["em_julgamento", "Em julgamento"]])}
          {filtro("Fonte", fonte, setFonte, (fontesQ.data ?? []).map((f) => [f.id, f.nome]))}
          {filtro("Abrangência", abrangencia, setAbrangencia, [...ABRANGENCIAS.map(([v, l]): [string, string] => [v, l]), ["a_definir", "A definir"]], "Todas")}
          {filtro("Situação", situacao, setSituacao, Object.entries(SITUACOES))}
          {filtro("Ano", ano, setAno, anos.map((a) => [String(a), String(a)]))}
        </div>
        {fontesQ.isError && <p className="text-xs text-destructive">Não foi possível carregar as fontes.</p>}

        {isMobile ? (
          selecionado ? (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" disabled={saving} onClick={() => mudar(() => setSelId(null))}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista</Button>
              <EditalCuradoriaDetail key={selecionado.id} edital={selecionado} onDirtyChange={acompanharAlteracoes} onPendingChange={acompanharGravacao} onStatusChange={manterVisivel} />
            </div>
          ) : listaView
        ) : (
          <div className="grid grid-cols-[minmax(280px,380px)_1fr] gap-6 items-start">
            <div className="max-h-[calc(100vh-120px)] overflow-y-auto pr-1 sticky top-4">{listaView}</div>
            {selecionado ? <EditalCuradoriaDetail key={selecionado.id} edital={selecionado} onDirtyChange={acompanharAlteracoes} onPendingChange={acompanharGravacao} onStatusChange={manterVisivel} />
              : <Placeholder title="Selecione um edital para revisar" text="Escolha um item na lista ao lado." />}
          </div>
        )}
      </main>
      <AlertDialog open={Boolean(trocaPendente)} onOpenChange={(aberto) => { if (!aberto) setTrocaPendente(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Alterações não salvas</AlertDialogTitle><AlertDialogDescription>Deseja descartar as alterações não salvas e trocar de edital ou filtro?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { trocaPendente?.(); setDirty(false); setTrocaPendente(null); }}>Descartar alterações e continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CuradoriaPage;
