import { ROTULO_SITUACAO_VALOR } from "@/lib/operon-valores";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import FonteBadge from "@/components/operon/FonteBadge";
import { ABRANGENCIAS } from "@/components/operon/AbrangenciaBadge";
import { ErroOperon } from "@/components/operon/PortalEditalUI";
import ChamadasTabela from "@/components/operon/ChamadasTabela";
import ChamadasCartoes from "@/components/operon/ChamadasCartoes";
import FiltrosChips from "@/components/operon/FiltrosChips";
import EditalDrawer from "@/components/operon/EditalDrawer";
import { usePortalOperon } from "@/components/operon/usePortalOperon";
import { ABAS_OPERON, filtrarPainel, type AbaOperon, type EditalPublicado } from "@/lib/operon-portal";
import { FILTROS_VAZIOS, ORDEM_PADRAO, aplicarFiltrosExtras, baixarCsv, chipsAtivos, filtrosDaUrl, lerFiltrosSalvos, ordenarChamadas, removerChip, salvarFiltros, type ColunaOrdem, type FiltrosChamadas, type Ordem } from "@/lib/operon-chamadas";

const NONE = "__none__";

export default function ChamadasPage() {
  const { user, lista: listaQ, fontes: fontesQ, seguidos: seguidosQ, seguidosIds } = usePortalOperon();
  const [params, setParams] = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosChamadas>(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState<Ordem>(ORDEM_PADRAO);
  const [aba, setAba] = useState<AbaOperon>("abertos");
  const [pronto, setPronto] = useState(false);
  const [aberto, setAberto] = useState<EditalPublicado | null>(null);

  // A URL (aprofundamento da Visão geral) tem prioridade sobre os filtros salvos.
  useEffect(() => {
    if (!user?.id || pronto) return;
    const salvo = lerFiltrosSalvos(user.id);
    const url = filtrosDaUrl(params);
    if (url) { setFiltros({ ...FILTROS_VAZIOS, ...url.filtros }); if (url.aba) setAba(url.aba); setParams({}, { replace: true }); }
    else if (salvo) setFiltros(salvo.filtros);
    if (salvo) setOrdem(salvo.ordem);
    setPronto(true);
  }, [user?.id, pronto, params, setParams]);
  useEffect(() => { if (pronto) salvarFiltros(user?.id, filtros, ordem); }, [pronto, user?.id, filtros, ordem]);

  const agora = Date.now();
  const abas = useMemo(() => {
    const porAba = filtrarPainel(listaQ.data ?? [], filtros, agora);
    return Object.fromEntries(ABAS_OPERON.map(([k]) => [k, aplicarFiltrosExtras(porAba[k], filtros, agora)])) as Record<AbaOperon, EditalPublicado[]>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaQ.data, filtros]);
  const lista = useMemo(() => ordenarChamadas(abas[aba], ordem), [abas, aba, ordem]);
  const nomeFonte = (id: string) => fontesQ.data?.find(f => f.id === id)?.nome;
  const chips = chipsAtivos(filtros, nomeFonte);
  const set = (k: keyof FiltrosChamadas) => (v: string) => setFiltros(f => ({ ...f, [k]: v }));
  const ordenar = (c: ColunaOrdem) => setOrdem(o => o.coluna === c ? { coluna: c, direcao: o.direcao === "asc" ? "desc" : "asc" } : { coluna: c, direcao: "asc" });

  return <>
    <div className="space-y-1"><h1 className="text-2xl md:text-3xl font-bold font-heading">Chamadas</h1><p className="text-sm text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p></div>
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] items-end">
        <div className="space-y-1"><Label htmlFor="busca">Buscar</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="busca" placeholder="Título, número, categoria ou área" className="pl-9" value={filtros.busca} onChange={e => set("busca")(e.target.value)} /></div></div>
        <div className="space-y-1"><Label htmlFor="fonte">Fonte</Label><Select value={filtros.fonte} onValueChange={set("fonte")}><SelectTrigger id="fonte"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todas as fontes</SelectItem>{(fontesQ.data ?? []).map(f => <SelectItem key={f.id} value={f.id}><FonteBadge slug={f.slug} nome={f.nome} /></SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="esfera">Esfera</Label><Select value={filtros.esfera} onValueChange={set("esfera")}><SelectTrigger id="esfera"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todas</SelectItem><SelectItem value="estadual">Estadual</SelectItem><SelectItem value="nacional">Nacional</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="abrangencia">Abrangência</Label><Select value={filtros.abrangencia} onValueChange={set("abrangencia")}><SelectTrigger id="abrangencia"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todas</SelectItem>{ABRANGENCIAS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="valor">Valor</Label><Select value={filtros.valor} onValueChange={set("valor")}><SelectTrigger id="valor"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todos</SelectItem>{Object.entries(ROTULO_SITUACAO_VALOR).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <FiltrosChips chips={chips} onRemover={c => setFiltros(f => removerChip(f, c))} onLimpar={() => setFiltros(FILTROS_VAZIOS)} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={aba} onValueChange={v => { if (ABAS_OPERON.some(([k]) => k === v)) setAba(v as AbaOperon); }}>
        <TabsList className="h-auto min-h-11 flex-wrap gap-1">{ABAS_OPERON.map(([k, t]) => <TabsTrigger key={k} value={k} className="gap-2 min-h-10">{t}<span className="text-xs tabular-nums">{listaQ.isLoading ? "…" : abas[k].length}</span></TabsTrigger>)}</TabsList>
      </Tabs>
      <Button variant="outline" size="sm" disabled={!lista.length} onClick={() => baixarCsv(lista)}><Download />Exportar CSV</Button>
    </div>
    {fontesQ.isError && <ErroOperon retry={() => fontesQ.refetch()} />}
    {seguidosQ.isError && <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><p>Não foi possível consultar seus editais seguidos.</p><Button variant="outline" size="sm" onClick={() => seguidosQ.refetch()}>Tentar novamente</Button></div>}
    {listaQ.isLoading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      : listaQ.isError ? <ErroOperon retry={() => listaQ.refetch()} />
        : !lista.length ? <div className="space-y-3"><Placeholder title="Nenhum edital encontrado" text="Não há editais publicados nesta aba com os filtros selecionados." />{chips.length > 0 && <Button variant="outline" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar filtros</Button>}</div>
          : <>
            <ChamadasTabela lista={lista} seguidos={seguidosIds} ordem={ordem} onOrdenar={ordenar} onAbrir={setAberto} />
            <div className="md:hidden flex items-center gap-2"><Label htmlFor="ordem-m" className="shrink-0">Ordenar por</Label><Select value={`${ordem.coluna}:${ordem.direcao}`} onValueChange={v => { const [coluna, direcao] = v.split(":") as [ColunaOrdem, "asc" | "desc"]; setOrdem({ coluna, direcao }); }}><SelectTrigger id="ordem-m"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="prazo:asc">Prazo mais próximo</SelectItem><SelectItem value="publicacao:desc">Publicação mais recente</SelectItem><SelectItem value="fonte:asc">Fonte (A a Z)</SelectItem></SelectContent></Select></div>
            <ChamadasCartoes lista={lista} seguidos={seguidosIds} onAbrir={setAberto} />
          </>}
    <EditalDrawer edital={aberto} onClose={() => setAberto(null)} />
  </>;
}
