import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, LogOut, Search, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge, { ABRANGENCIAS } from "@/components/operon/AbrangenciaBadge";
import { ErroOperon, RodapeOperon, RestricaoIes, SituacaoEdital, PrazoTexto } from "@/components/operon/PortalEditalUI";
import { fmtData } from "./CuradoriaPage";
import { carregarFontesOperon, mostrarFiltroUf, ufsDisponiveis } from "@/lib/operon-fontes";
import { logoutOperon } from "@/lib/operon-access";
import { ABAS_OPERON, carregarPainel, carregarSeguidos, filtrarPainel, numeroEdital, rotuloEvento, type AbaOperon, type EditalPublicado } from "@/lib/operon-portal";

const NONE = "__none__";
const Conferido = ({ e }: { e: EditalPublicado }) => e.verificado_em ? <div className="space-y-1"><Badge variant="outline" className="gap-1 whitespace-normal"><CheckCircle2 className="h-3 w-3 shrink-0" />Conferido pela curadoria</Badge><p className="text-xs text-muted-foreground">{fmtData(e.verificado_em)}</p></div> : <span className="text-xs text-muted-foreground">Conferência não informada</span>;
const IdentidadeEdital = ({ e, seguindo }: { e: EditalPublicado; seguindo: boolean }) => <div className="space-y-2 min-w-0">
  <div className="flex flex-wrap gap-1.5"><FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} /><AbrangenciaBadge abrangencia={e.abrangencia} />{seguindo && <Badge variant="secondary">Seguindo</Badge>}</div>
  <Button variant="link" asChild className="p-0 h-auto text-left whitespace-normal justify-start"><Link to={`/editais/${e.id}`} className="font-semibold break-words">{e.titulo}</Link></Button>
  <p className="text-xs text-muted-foreground break-words">{numeroEdital(e)} · {e.ultimo_evento ? `${rotuloEvento(e.ultimo_evento.tipo)} em ${fmtData(e.ultimo_evento.ocorrido_em)}` : "Nenhum evento registrado ainda"}</p>
  <RestricaoIes e={e} />
</div>;

export default function EditaisPage() {
  const [fonte, setFonte] = useState(NONE);
  const [esfera, setEsfera] = useState(NONE);
  const [uf, setUf] = useState(NONE);
  const [abrangencia, setAbrangencia] = useState(NONE);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<AbaOperon>("abertos");
  const [saindo, setSaindo] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const listaQ = useQuery({ queryKey: ["oe-portal-painel", user?.id], queryFn: carregarPainel });
  const fontesQ = useQuery({ queryKey: ["oe-fontes", user?.id], queryFn: carregarFontesOperon, enabled: !!user });
  const seguidosQ = useQuery({ queryKey: ["oe-seguidos", user?.id], enabled: !!user, queryFn: () => carregarSeguidos(user?.id ?? "") });
  const seguidos = new Set((seguidosQ.data ?? []).map(e => e.edital_id));
  const abas = useMemo(() => filtrarPainel(listaQ.data ?? [], { busca, fonte, esfera, uf, abrangencia }), [listaQ.data, busca, fonte, esfera, uf, abrangencia]);
  const lista = abas[aba];
  const semFiltros = filtrarPainel(listaQ.data ?? [], { busca: "", fonte: NONE, abrangencia: NONE });
  const ocultos = semFiltros[aba].length - lista.length;
  const limparFiltros = () => { setBusca(""); setFonte(NONE); setEsfera(NONE); setUf(NONE); setAbrangencia(NONE); };
  const handleLogout = async () => {
    setSaindo(true);
    try { await logoutOperon(navigate); }
    catch { toast({ title: "Erro ao sair", description: "Não foi possível sair. Tente novamente.", variant: "destructive" }); }
    finally { setSaindo(false); }
  };
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center"><FileText className="w-5 h-5 text-primary-foreground" /></div><h1 className="text-lg font-bold font-heading">Operon Fomento</h1></div>
        <div className="flex gap-1"><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft />Voltar</Link></Button><Button variant="ghost" size="sm" disabled={saindo} onClick={handleLogout}><LogOut />Sair</Button></div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2"><h2 className="text-2xl md:text-3xl font-bold font-heading">Chamadas de fomento ligadas ao seu perfil</h2><p className="text-muted-foreground">Acompanhe editais das agências de fomento, com avisos de prazo, retificações, errata e resultados.</p><p className="text-sm text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p></div>
      <div className="relative max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar editais" placeholder="Buscar por título, número, categoria ou área" className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} /></div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <Tabs value={aba} onValueChange={v => { if (ABAS_OPERON.some(([k]) => k === v)) setAba(v as AbaOperon); }} className="w-full sm:w-auto"><TabsList className="w-full sm:w-auto h-auto min-h-11 flex-wrap gap-1">{ABAS_OPERON.map(([k, titulo]) => <TabsTrigger key={k} value={k} className="gap-2 min-h-10">{titulo}<span className="text-xs tabular-nums">{listaQ.isLoading ? "…" : abas[k].length}</span></TabsTrigger>)}</TabsList></Tabs>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <div className="space-y-1"><Label htmlFor="fonte">Fonte</Label><Select value={fonte} onValueChange={setFonte}><SelectTrigger id="fonte"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todas as fontes</SelectItem>{(fontesQ.data ?? []).map(f => <SelectItem key={f.id} value={f.id}><FonteBadge slug={f.slug} nome={f.nome} /></SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="esfera">Esfera</Label><Select value={esfera} onValueChange={setEsfera}><SelectTrigger id="esfera"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todas</SelectItem><SelectItem value="estadual">Estadual</SelectItem><SelectItem value="nacional">Nacional</SelectItem></SelectContent></Select></div>
          {mostrarFiltroUf(fontesQ.data ?? []) && <div className="space-y-1"><Label htmlFor="uf">Estado (UF)</Label><Select value={uf} onValueChange={setUf}><SelectTrigger id="uf"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todos</SelectItem>{ufsDisponiveis(fontesQ.data ?? []).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>}
          <div className="space-y-1 sm:w-44"><Label htmlFor="abrangencia">Abrangência</Label><Select value={abrangencia} onValueChange={setAbrangencia}><SelectTrigger id="abrangencia"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Todas</SelectItem>{ABRANGENCIAS.map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </div>
      {!listaQ.isLoading && !listaQ.isError && ocultos > 0 && <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>{ocultos === 1 ? "1 edital oculto pelos filtros" : `${ocultos} editais ocultos pelos filtros`}</span><Button variant="outline" size="sm" onClick={limparFiltros}>Limpar filtros</Button></div>}
      {fontesQ.isError && <ErroOperon retry={() => fontesQ.refetch()} />}
      {seguidosQ.isError && <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><p>Não foi possível consultar seus editais seguidos.</p><Button variant="outline" size="sm" onClick={() => seguidosQ.refetch()}>Tentar novamente</Button></div>}
      {listaQ.isLoading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div> : listaQ.isError ? <ErroOperon retry={() => listaQ.refetch()} /> : !lista.length ? <Placeholder title="Nenhum edital encontrado" text="Não há editais publicados nesta aba com os filtros selecionados." /> : <>
        <div className="hidden md:block rounded-xl border border-border overflow-hidden"><Table className="table-fixed"><TableHeader className="bg-muted/50"><TableRow><TableHead className="w-[43%]">Edital</TableHead><TableHead className="w-[14%]">Tipo/categoria</TableHead><TableHead className="w-[15%]">Prazo</TableHead><TableHead className="w-[13%]">Situação</TableHead><TableHead className="w-[15%]">Conferido</TableHead></TableRow></TableHeader><TableBody>{lista.map(e => <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/editais/${e.id}`)}><TableCell className="align-top p-4"><IdentidadeEdital e={e} seguindo={seguidos.has(e.id)} /></TableCell><TableCell className="align-top p-4 break-words">{e.categoria ?? e.tipo ?? "Não informado"}</TableCell><TableCell className="align-top p-4"><PrazoTexto e={e} /></TableCell><TableCell className="align-top p-4"><SituacaoEdital e={e} /></TableCell><TableCell className="align-top p-4"><Conferido e={e} /></TableCell></TableRow>)}</TableBody></Table></div>
        <div className="md:hidden space-y-3">{lista.map(e => <Card key={e.id} className="rounded-xl"><CardContent className="p-4 space-y-3"><IdentidadeEdital e={e} seguindo={seguidos.has(e.id)} /><p className="text-sm text-muted-foreground break-words">{e.categoria ?? e.tipo ?? "Não informado"}</p><SituacaoEdital e={e} /><PrazoTexto e={e} /><Conferido e={e} /></CardContent></Card>)}</div>
      </>}
    </main>
    <RodapeOperon />
  </div>;
}
