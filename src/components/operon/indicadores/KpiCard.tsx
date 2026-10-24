import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function KpiCard({ titulo, valor, descricao, para, icone: Icone, carregando }: { titulo: string; valor: number | null; descricao: string; para: string; icone: LucideIcon; carregando?: boolean }) {
  return <Link to={para} className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-2 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${titulo}: ${valor ?? "carregando"}. Ver chamadas`}>
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span className="flex items-center gap-2"><Icone className="h-4 w-4" aria-hidden="true" />{titulo}</span><ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" /></div>
    {carregando || valor === null ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-bold font-heading tabular-nums">{valor}</p>}
    <p className="text-xs text-muted-foreground">{descricao}</p>
  </Link>;
}
