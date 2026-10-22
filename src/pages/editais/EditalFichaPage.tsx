import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, ExternalLink, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge from "@/components/operon/AbrangenciaBadge";
import SeguirEditalButton from "@/components/operon/SeguirEditalButton";
import { ErroOperon, RodapeOperon, RestricaoIes, SituacaoEdital, PrazoTexto } from "@/components/operon/PortalEditalUI";
import { fmtData, rodadaVigente } from "./CuradoriaPage";
import { carregarFicha, carregarDocumentos, carregarEventosPublicados, numeroEdital, normalizarBusca, rotuloEvento, temRestricaoIes } from "@/lib/operon-portal";

export default function EditalFichaPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const editalQ = useQuery({ queryKey: ["oe-portal-ficha", user?.id, id], enabled: !!id, queryFn: () => carregarFicha(id ?? "") });
  const e = editalQ.data;
  const docsQ = useQuery({ queryKey: ["oe-portal-docs", user?.id, id], enabled: !!e, queryFn: () => carregarDocumentos(id ?? "") });
  const eventosQ = useQuery({ queryKey: ["oe-portal-eventos", user?.id, id], enabled: !!e, queryFn: () => carregarEventosPublicados(id) });
  const agora = Date.now();
  const vig = rodadaVigente(e?.oe_rodada, agora);
  const campos: [string, string | null | undefined][] = e ? [
    [e.oe_fonte?.slug?.toLowerCase() === "fapes" ? "Finalidade" : "Objetivo", e.objetivo],
    ["Recursos", e.recursos], ["Quem pode participar", e.quem_pode],
    ["Da Instituição de Ensino Superior", e.requisitos_ies], ["Contrapartida", e.contrapartida],
  ] : [];
  return <div className="min-h-screen bg-background text-foreground">
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <Button asChild variant="outline"><Link to="/editais"><ArrowLeft />Voltar ao painel</Link></Button>
      {editalQ.isLoading ? <div className="space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div> : editalQ.isError ? <ErroOperon retry={() => editalQ.refetch()} /> : !e ? <Placeholder title="Edital não encontrado" text="Este edital não existe ou não está publicado." /> : <>
        <header className="space-y-4 pb-6 border-b border-border">
          <div className="flex flex-wrap gap-2 items-center"><FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} /><AbrangenciaBadge abrangencia={e.abrangencia} /><SituacaoEdital e={e} /></div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading break-words">{e.titulo}</h1>
          <p className="text-sm text-muted-foreground">{numeroEdital(e)} · {e.verificado_em ? `Conferido pela curadoria em ${fmtData(e.verificado_em)}` : "Conferência não informada"}</p>
          {e.verificado_em && <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />Conferido pela curadoria</Badge>}
          <RestricaoIes e={e} aviso />
          <p className="text-sm text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
          {e.url_oficial && <Button asChild variant="outline"><a href={e.url_oficial} target="_blank" rel="noopener noreferrer"><ExternalLink />Ver texto oficial</a></Button>}
          <SeguirEditalButton editalId={e.id} />
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-8 items-start">
          <div className="min-w-0 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{campos.filter(([titulo, valor]) => valor?.trim() || (titulo === "Da Instituição de Ensino Superior" && temRestricaoIes(e))).map(([titulo, valor]) => <Card key={titulo} className={`rounded-xl ${titulo === "Finalidade" || titulo === "Objetivo" || titulo === "Da Instituição de Ensino Superior" ? "sm:col-span-2" : ""}`}><CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader><CardContent className="space-y-3">{titulo === "Da Instituição de Ensino Superior" && <RestricaoIes e={e} aviso />}<p className="whitespace-pre-line break-words text-sm text-muted-foreground">{valor}</p></CardContent></Card>)}</div>
            <section className="space-y-4" aria-labelledby="datas-titulo"><h2 id="datas-titulo" className="font-heading text-xl font-semibold">Quadro de datas</h2>
              {!e.oe_rodada?.length ? <><PrazoTexto e={e} /><Placeholder title="Datas ainda não disponíveis" text="Consulte o texto oficial do edital." /></> : <div className="space-y-3">{[...e.oe_rodada].sort((a, b) => a.ordem - b.ordem).map(r => {
                const abertura = r.abertura ? new Date(r.abertura).getTime() : null;
                const fim = r.prazo_fim ? new Date(r.prazo_fim).getTime() : null;
                const atual = vig?.ordem === r.ordem && (abertura != null || fim != null) && (abertura ?? -Infinity) <= agora && (fim ?? Infinity) >= agora;
                const futura = abertura != null && abertura > agora;
                return <div key={r.ordem} className={`rounded-xl border p-4 space-y-2 ${atual ? "border-primary bg-primary/5" : "border-border"}`}><div className="flex flex-wrap gap-2 items-center"><h3 className="font-semibold text-sm">{r.ordem}ª rodada</h3>{atual && <Badge>Vigente</Badge>}{futura && <Badge variant="outline">Inscrições abrem em {fmtData(r.abertura)}</Badge>}</div><p className="text-sm text-muted-foreground">Abertura: {fmtData(r.abertura, true)} · Prazo final: {fmtData(r.prazo_fim, true)}</p>{r.texto_original && <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{r.texto_original}</p>}</div>;
              })}</div>}
            </section>
            <section className="space-y-4" aria-labelledby="docs-titulo"><h2 id="docs-titulo" className="font-heading text-xl font-semibold">Documentos para baixar</h2>
              {docsQ.isLoading ? <Skeleton className="h-24 rounded-xl" /> : docsQ.isError ? <ErroOperon retry={() => docsQ.refetch()} /> : !docsQ.data?.length ? <Placeholder title="Nenhum documento" text="Ainda não há documentos para este edital." /> : <div className="space-y-3">{docsQ.data.map(d => {
                const tipo = normalizarBusca(d.tipo ?? "");
                const destaque = ["retificacao", "errata", "adendo"].includes(tipo);
                return <div key={d.id} className={`flex flex-wrap justify-between items-center gap-3 rounded-xl border p-4 ${destaque ? "border-primary bg-primary/5" : "border-border"}`}><div className="min-w-0 flex-1 space-y-2"><p className="font-medium text-sm whitespace-pre-line break-words">{d.rotulo ?? "Documento"}</p><div className="flex flex-wrap gap-2 items-center"><Badge variant={destaque ? "default" : "secondary"}>{rotuloEvento(tipo || "documento")}</Badge>{d.versao != null && <span className="text-xs text-muted-foreground">Versão {d.versao}</span>}{d.substituido && <Badge variant="outline">Substituído</Badge>}</div><p className="text-xs text-muted-foreground">{fmtData(d.publicado_em)}</p></div>{d.url && <Button asChild variant="outline" size="sm"><a href={d.url} target="_blank" rel="noopener noreferrer"><Download />Baixar</a></Button>}</div>;
              })}</div>}
            </section>
          </div>
          <aside className="min-w-0 lg:border-l lg:border-border lg:pl-6 space-y-4" aria-labelledby="eventos-titulo"><h2 id="eventos-titulo" className="font-heading text-xl font-semibold">Linha do tempo</h2>
            {eventosQ.isLoading ? <Skeleton className="h-48 rounded-xl" /> : eventosQ.isError ? <ErroOperon retry={() => eventosQ.refetch()} /> : !eventosQ.data?.length ? <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p> : <ol className="border-l border-border pl-4 space-y-6">{eventosQ.data.map(ev => <li key={ev.id} className="space-y-2 text-sm"><p className="font-semibold">{rotuloEvento(ev.tipo)}</p><p className="text-xs text-muted-foreground">{fmtData(ev.ocorrido_em, true)}</p>{ev.origem === "carga_inicial" && <Badge variant="outline">Carga inicial</Badge>}{(ev.valor_anterior != null || ev.valor_novo != null) && <p className="whitespace-pre-line break-words text-xs text-muted-foreground">{ev.valor_anterior ?? "Não informado"} → {ev.valor_novo ?? "Não informado"}</p>}</li>)}</ol>}
          </aside>
        </div>
      </>}
    </main>
    <RodapeOperon />
  </div>;
}