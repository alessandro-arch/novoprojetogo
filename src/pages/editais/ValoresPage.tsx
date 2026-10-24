import { Link } from "react-router-dom";
import { CircleDollarSign, CircleHelp, Clock, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Bloco from "@/components/operon/indicadores/Bloco";
import ValoresBarrasChart from "@/components/operon/indicadores/ValoresBarrasChart";
import FonteBadge from "@/components/operon/FonteBadge";
import { ValorCompacto } from "@/components/operon/ValorEdital";
import { usePortalOperon } from "@/components/operon/usePortalOperon";
import { numeroEdital, type EditalPublicado } from "@/lib/operon-portal";
import { fmtReais, resumoValores, valoresPorAgencia, valoresPorMes, valoresPorTipo } from "@/lib/operon-valores";

const fmtMes = (m: string) => { const [a, mm] = m.split("-").map(Number); return new Date(a, mm - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }); };

function Contagem({ titulo, n, icone: Icone, para, descricao }: { titulo: string; n: number | null; icone: typeof Clock; para: string; descricao: string }) {
  return <Link to={para} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${titulo}: ${n ?? "carregando"}. Ver chamadas`}>
    <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icone className="h-4 w-4" aria-hidden="true" />{titulo}</span>
    {n === null ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-bold font-heading tabular-nums">{n}</p>}
    <p className="text-xs text-muted-foreground">{descricao}</p>
  </Link>;
}

function ListaEditais({ itens }: { itens: EditalPublicado[] }) {
  if (!itens.length) return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum edital nesta situação.</p>;
  return <ul className="divide-y divide-border">{itens.map(e => <li key={e.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
    <div className="min-w-0"><Link to={`/editais/${e.id}`} className="font-medium hover:underline break-words">{e.titulo}</Link>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} /><span>{numeroEdital(e)}</span></div></div>
    <ValorCompacto e={e} />
  </li>)}</ul>;
}

export default function ValoresPage() {
  const { lista } = usePortalOperon();
  const rows = (lista.data ?? []).filter(e => e.status_curadoria === "publicado");
  const r = lista.data ? resumoValores(rows) : null;
  const estado = { carregando: lista.isLoading, erro: lista.isError, retry: () => lista.refetch() };
  const semConfirmados = !!r && r.confirmados.length === 0;
  const porAgencia = valoresPorAgencia(rows).map(a => ({ nome: a.agencia, valor: a.valor }));
  const porMes = valoresPorMes(rows).map(m => ({ nome: fmtMes(m.mes), valor: m.valor, nota: m.aproximados ? `${m.aproximados} com data aproximada` : undefined }));
  const porTipo = valoresPorTipo(rows).map(t => ({ nome: t.tipo, valor: t.valor }));

  return <>
    <div className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-bold font-heading">Valores</h1>
      <p className="text-sm text-muted-foreground">Somente valores confirmados pela curadoria entram nas somas. Valores por agência, não confirmados ou não informados aparecem separados.</p>
    </div>
    {lista.isError ? <Bloco titulo="Valores" {...estado}>{null}</Bloco> : <div className="grid gap-3 grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign className="h-4 w-4" aria-hidden="true" />Total confirmado</span>
        {!r ? <Skeleton className="h-9 w-32" /> : <p className="text-2xl font-bold font-heading tabular-nums break-words">{fmtReais(r.total)}</p>}
        <p className="text-xs text-muted-foreground">{r ? `${r.confirmados.length} edital(is) com valor total ou estimado confirmado` : "Carregando"}</p>
      </div>
      <Contagem titulo="Sem valor informado" n={r?.semValor.length ?? null} icone={CircleHelp} para="/editais/chamadas?valor=sem_valor" descricao="A agência ou a coleta ainda não informou" />
      <Contagem titulo="Valor não confirmado" n={r?.naoConfirmados.length ?? null} icone={Clock} para="/editais/chamadas?valor=nao_confirmado" descricao="Aguardando confirmação da curadoria" />
      <Contagem titulo="Por agência" n={r?.porAgencia.length ?? null} icone={Building2} para="/editais/chamadas?valor=por_agencia" descricao="Valor por agência, fora da soma" />
    </div>}

    {semConfirmados && <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">Ainda não há valores confirmados. Os valores chegam pela coleta e passam a contar aqui depois da confirmação da curadoria.</p>}

    {!semConfirmados && <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo="Por agência" descricao="Somente valores confirmados pela curadoria." {...estado} vazio={!porAgencia.length}><ValoresBarrasChart dados={porAgencia} titulo="Valor confirmado por agência" /></Bloco>
      <Bloco titulo="Por tipo" descricao="Total e Estimado confirmados, separados." {...estado} vazio={porTipo.every(t => !t.valor)}><ValoresBarrasChart dados={porTipo} titulo="Valor confirmado por tipo" /></Bloco>
      <div className="lg:col-span-2"><Bloco titulo="Por mês de lançamento" descricao="Mês pela data de publicação da agência; sem ela, a data da conferência (aproximada)." {...estado} vazio={!porMes.length}><ValoresBarrasChart dados={porMes} titulo="Valor confirmado por mês de lançamento" /></Bloco></div>
    </div>}

    <div className="grid gap-4 lg:grid-cols-3 items-start">
      <Bloco titulo="Sem valor informado" {...estado}><ListaEditais itens={r?.semValor ?? []} /></Bloco>
      <Bloco titulo="Valor não confirmado" {...estado}><ListaEditais itens={r?.naoConfirmados ?? []} /></Bloco>
      <Bloco titulo="Por agência" {...estado}><ListaEditais itens={r?.porAgencia ?? []} /></Bloco>
    </div>
  </>;
}
