import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import FonteBadge from "@/components/operon/FonteBadge";
import { ErroOperon } from "@/components/operon/PortalEditalUI";
import { usePortalOperon } from "@/components/operon/usePortalOperon";
import { situacaoEdital } from "./CuradoriaPage";

export default function FontesPage() {
  const { fontes, lista } = usePortalOperon();
  const rows = lista.data ?? [];
  return <>
    <div className="space-y-1"><h1 className="text-2xl md:text-3xl font-bold font-heading">Fontes</h1><p className="text-sm text-muted-foreground">Agências de fomento acompanhadas para a sua instituição.</p></div>
    {fontes.isLoading || lista.isLoading ? <Skeleton className="h-40 rounded-xl" /> : fontes.isError || lista.isError ? <ErroOperon retry={() => { fontes.refetch(); lista.refetch(); }} />
      : !fontes.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma fonte liberada para a sua instituição.</p>
        : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fontes.data.map(f => {
          const daFonte = rows.filter(e => e.fonte_id === f.id);
          const abertos = daFonte.filter(e => situacaoEdital(e) === "aberto").length;
          return <article key={f.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2"><FonteBadge slug={f.slug} nome={f.nome} /><span className="text-xs text-muted-foreground">{f.esfera === "nacional" ? "Nacional" : f.esfera === "estadual" ? `Estadual${f.uf ? `, ${f.uf}` : ""}` : "Esfera não informada"}</span></div>
            <h2 className="font-semibold">{f.nome}</h2>
            <p className="text-sm text-muted-foreground tabular-nums">{daFonte.length} publicados, {abertos} abertos agora</p>
            <Button asChild variant="outline" size="sm"><Link to={`/editais/chamadas?fonte=${f.id}`}>Ver chamadas</Link></Button>
          </article>;
        })}</div>}
  </>;
}
