import { lazy, Suspense } from "react";
import { CalendarClock, Gavel, Rocket, DoorOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import KpiCard from "@/components/operon/indicadores/KpiCard";
import Bloco from "@/components/operon/indicadores/Bloco";
import ProximosPrazos from "@/components/operon/indicadores/ProximosPrazos";
import { usePortalOperon } from "@/components/operon/usePortalOperon";
import { fmtReais, resumoValores } from "@/lib/operon-valores";
import { Link } from "react-router-dom";
import { calcularIndicadores, prazosProximos } from "@/lib/operon-indicadores";

const Graficos = lazy(() => import("@/components/operon/indicadores/GraficosVisaoGeral"));

export default function VisaoGeralPage() {
  const { lista } = usePortalOperon();
  const rows = lista.data ?? [];
  const agora = Date.now();
  const ind = lista.data ? calcularIndicadores(rows, agora) : null;
  const carregando = lista.isLoading;
  return <>
    <div className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-bold font-heading">Chamadas de fomento ligadas ao seu perfil</h1>
      <p className="text-muted-foreground">Panorama dos editais publicados pela curadoria, com prazos e lançamentos recentes.</p>
    </div>
    {lista.isError ? <Bloco titulo="Indicadores" erro retry={() => lista.refetch()}>{null}</Bloco> :
      <div className="grid gap-3 grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Abertos agora" valor={ind?.abertos ?? null} carregando={carregando} icone={DoorOpen} descricao="Inscrições abertas ou com rodada futura" para="/editais/chamadas?aba=abertos" />
        <KpiCard titulo="Encerram em 7 dias" valor={ind?.encerram7 ?? null} carregando={carregando} icone={CalendarClock} descricao="Prazo de submissão nesta semana" para="/editais/chamadas?aba=abertos&prazo=7d" />
        <KpiCard titulo="Lançados em 30 dias" valor={ind?.lancados30 ?? null} carregando={carregando} icone={Rocket} descricao="Publicados no último mês" para="/editais/chamadas?aba=abertos&publicados=30d" />
        <KpiCard titulo="Em julgamento" valor={ind?.emJulgamento ?? null} carregando={carregando} icone={Gavel} descricao="Inscrições encerradas, aguardando resultado" para="/editais/chamadas?aba=em_julgamento" />
      </div>}
    {lista.data && (() => { const v = resumoValores(rows); return <Link to="/editais/valores" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span><span className="block text-sm text-muted-foreground">Valor confirmado</span><span className="text-2xl font-bold font-heading tabular-nums">{fmtReais(v.total)}</span></span>
      <span className="text-xs text-muted-foreground">{v.semValor.length} sem valor · {v.naoConfirmados.length} não confirmado(s) · {v.porAgencia.length} por agência</span>
    </Link>; })()}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
      <div className="space-y-4 min-w-0">
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}><Graficos rows={rows} carregando={carregando} erro={lista.isError} retry={() => lista.refetch()} /></Suspense>
      </div>
      <Bloco titulo="Próximos prazos" descricao="Os 5 prazos de submissão mais próximos." carregando={carregando} erro={lista.isError} retry={() => lista.refetch()} vazio={!prazosProximos(rows, agora).length}>
        <ProximosPrazos itens={prazosProximos(rows, agora).slice(0, 5)} />
      </Bloco>
    </div>
  </>;
}
