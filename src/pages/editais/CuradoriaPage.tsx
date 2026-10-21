import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, Placeholder } from "@/components/servicedesk/sd-ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, FileText } from "lucide-react";
import EditalCuradoriaDetail from "@/components/operon/EditalCuradoriaDetail";

// Tabelas oe_* ainda não estão nos tipos gerados: cast pontual.
export const oe = supabase as any;

export interface Rodada { id?: string; ordem: number; abertura: string | null; prazo_fim: string | null; texto_original?: string | null }
export interface EditalRow {
  id: string; fonte_id: string; numero: string | null; ano: number | null; titulo: string; categoria: string | null;
  situacao: string | null; status_curadoria: string; url_oficial: string | null; visto_ultima_vez_em: string | null;
  objetivo: string | null; recursos: string | null; quem_pode: string | null; contrapartida: string | null; areas: string[] | null;
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
    .sort((a, b) => (t(a.abertura) ?? t(a.prazo_fim)!) - (t(b.abertura) ?? t(b.prazo_fim)!))[0];
  return futura ?? ord[ord.length - 1];
};

/** Vigente hoje: situação aberta ou alguma rodada em andamento; descartado nunca é vigente. */
export const ehVigente = (e: EditalRow, agora = Date.now()): boolean => {
  if (e.status_curadoria === "descartado") return false;
  if (e.situacao === "aberto") return true;
  return (e.oe_rodada ?? []).some((r) => (t(r.abertura) ?? -Infinity) <= agora && (t(r.prazo_fim) ?? Infinity) >= agora);
};

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
export const semNumero = (n: string | null) => !n || n.trim().toLowerCase().replace(/\s/g, "") === "s/n";

const CuradoriaPage = () => {
  const isMobile = useIsMobile();
  const [fonte, setFonte] = useState(NONE);
  const [situacao, setSituacao] = useState(NONE);
  const [vigencia, setVigencia] = useState("vigentes");
  const [status, setStatus] = useState(NONE);
  const [ano, setAno] = useState("2026");
  const [selId, setSelId] = useState<string | null>(null);

  const mudarVigencia = (v: string) => {
    setVigencia(v);
    setStatus(v === "vigentes" ? NONE : "rascunho");
  };

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
    queryKey: ["oe-editais", fonte, situacao, status, ano],
    queryFn: async () => {
      const { data, error } = await aplicar(
        oe.from("oe_edital").select("id, fonte_id, numero, ano, titulo, categoria, situacao, status_curadoria, url_oficial, visto_ultima_vez_em, objetivo, recursos, quem_pode, contrapartida, areas, oe_fonte(slug, nome), oe_rodada(id, ordem, abertura, prazo_fim)"),
        true,
      ).limit(1000);
      if (error) throw error;
      return data as EditalRow[];
    },
  });

  const contQ = useQuery({
    queryKey: ["oe-contadores", fonte, situacao, ano],
    queryFn: async () => {
      const r: Record<string, number> = {};
      for (const s of ["rascunho", "em_revisao", "publicado"]) {
        const { count, error } = await aplicar(oe.from("oe_edital").select("id", { count: "exact", head: true }), false).eq("status_curadoria", s);
        if (error) throw error;
        r[s] = count ?? 0;
      }
      return r;
    },
  });

  const lista = useMemo(() => {
    const agora = Date.now();
    const rows = (listaQ.data ?? [])
      .filter((e) => vigencia !== "vigentes" || ehVigente(e, agora))
      .map((e) => ({ e, v: rodadaVigente(e.oe_rodada) }));
    const prazo = (x: { v: Rodada | null }) => t(x.v?.prazo_fim ?? null);
    const futuros = rows.filter((x) => { const p = prazo(x); return p != null && p >= agora; }).sort((a, b) => prazo(a)! - prazo(b)!);
    const vencidos = rows.filter((x) => { const p = prazo(x); return p != null && p < agora; }).sort((a, b) => prazo(b)! - prazo(a)!);
    const semDatas = rows.filter((x) => prazo(x) == null)
      .sort((a, b) => (t(b.e.visto_ultima_vez_em) ?? 0) - (t(a.e.visto_ultima_vez_em) ?? 0));
    return [...futuros, ...vencidos, ...semDatas];
  }, [listaQ.data, vigencia]);

  const vigentesHoje = useMemo(() => lista.filter((x) => ehVigente(x.e)).length, [lista]);

  const selecionado = lista.find((x) => x.e.id === selId)?.e ?? null;
  const anoAtual = new Date().getFullYear();
  const anos = Array.from(new Set([anoAtual + 1, anoAtual, 2026, anoAtual - 1, anoAtual - 2])).sort((a, b) => b - a);

  const filtro = (label: string, value: string, set: (v: string) => void, opts: [string, string][]) => (
    <div className="space-y-1 min-w-[140px] flex-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={(v) => { set(v); setSelId(null); }}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Todos</SelectItem>
          {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const listaView = (
    <div className="space-y-2">
      {!listaQ.isLoading && !listaQ.isError && (
        <p className="text-sm text-muted-foreground">{vigentesHoje} editais vigentes hoje</p>
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
          <button
            key={e.id}
            onClick={() => setSelId(e.id)}
            className={`w-full text-left bg-card rounded-xl border p-4 transition-shadow hover:shadow-card ${selId === e.id ? "border-primary" : "border-border"}`}
          >
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge>{e.oe_fonte?.nome ?? e.oe_fonte?.slug ?? "Fonte"}</Badge>
              {semNumero(e.numero) ? <Badge variant="outline">Sem número</Badge> : <span className="text-xs text-muted-foreground">Nº {e.numero}</span>}
              {e.situacao && <Badge variant="secondary">{SITUACOES[e.situacao] ?? e.situacao}</Badge>}
              {(() => {
                const dias = diasAte(v?.prazo_fim);
                if (dias == null || dias < 0) return null;
                return <Badge variant={dias <= 7 ? "default" : "outline"}>{dias === 0 ? "Fecha hoje" : `Faltam ${dias} dias`}</Badge>;
              })()}
            </div>
            <p className="font-medium text-foreground text-sm line-clamp-2">{e.titulo}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {e.categoria ?? "Sem categoria"} · Prazo: {v ? fmtData(v.prazo_fim) : "Datas ainda não extraídas"}
            </p>
          </button>
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
          <Link to="/admin"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Painel admin</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground">Curadoria de editais</h2>
          <p className="text-sm text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {contQ.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            : contQ.isError ? <div className="col-span-3 space-y-2"><Placeholder title="Não foi possível carregar os contadores" text={(contQ.error as Error)?.message ?? ""} /><Button variant="outline" size="sm" onClick={() => contQ.refetch()}>Tentar novamente</Button></div>
            : (<>
              <KpiCard label="Rascunhos" value={contQ.data!.rascunho} />
              <KpiCard label="Em revisão" value={contQ.data!.em_revisao} />
              <KpiCard label="Publicados" value={contQ.data!.publicado} />
            </>)}
        </div>

        <div className="flex flex-wrap gap-3">
          {filtro("Vigência", vigencia, mudarVigencia, [["vigentes", "Vigentes hoje"]])}
          {filtro("Fonte", fonte, setFonte, (fontesQ.data ?? []).map((f) => [f.id, f.nome]))}
          {filtro("Situação", situacao, setSituacao, Object.entries(SITUACOES))}
          {filtro("Status de curadoria", status, setStatus, Object.entries(STATUS))}
          {filtro("Ano", ano, setAno, anos.map((a) => [String(a), String(a)]))}
        </div>
        {fontesQ.isError && <p className="text-xs text-destructive">Não foi possível carregar as fontes.</p>}

        {isMobile ? (
          selecionado ? (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setSelId(null)}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista</Button>
              <EditalCuradoriaDetail key={selecionado.id} edital={selecionado} />
            </div>
          ) : listaView
        ) : (
          <div className="grid grid-cols-[minmax(280px,380px)_1fr] gap-6 items-start">
            <div className="max-h-[calc(100vh-120px)] overflow-y-auto pr-1 sticky top-4">{listaView}</div>
            {selecionado ? <EditalCuradoriaDetail key={selecionado.id} edital={selecionado} />
              : <Placeholder title="Selecione um edital para revisar" text="Escolha um item na lista ao lado." />}
          </div>
        )}
      </main>
    </div>
  );
};

export default CuradoriaPage;
