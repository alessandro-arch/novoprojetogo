import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErroOperon } from "@/components/operon/PortalEditalUI";
import { usePortalOperon } from "@/components/operon/usePortalOperon";
import { prazoEdital, type EditalPublicado } from "@/lib/operon-portal";

const chaveDia = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function PrazosPage() {
  const { lista } = usePortalOperon();
  const hoje = new Date();
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const porDia = new Map<string, EditalPublicado[]>();
  (lista.data ?? []).forEach(e => { const p = prazoEdital(e); if (p) { const k = chaveDia(p); porDia.set(k, [...(porDia.get(k) ?? []), e]); } });
  const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - mes.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  const titulo = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mover = (n: number) => setMes(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  return <>
    <div className="space-y-1"><h1 className="text-2xl md:text-3xl font-bold font-heading">Prazos</h1><p className="text-sm text-muted-foreground">Prazos de submissão dos editais abertos, em horário de Brasília.</p></div>
    <div className="flex items-center justify-between gap-2">
      <Button variant="outline" size="icon" onClick={() => mover(-1)} aria-label="Mês anterior"><ChevronLeft /></Button>
      <h2 className="font-semibold font-heading capitalize" aria-live="polite">{titulo}</h2>
      <Button variant="outline" size="icon" onClick={() => mover(1)} aria-label="Próximo mês"><ChevronRight /></Button>
    </div>
    {lista.isLoading ? <Skeleton className="h-96 rounded-xl" /> : lista.isError ? <ErroOperon retry={() => lista.refetch()} /> : <>
      <div className="hidden md:grid grid-cols-7 gap-px rounded-xl border border-border bg-border overflow-hidden" role="grid" aria-label={`Calendário de ${titulo}`}>
        {SEMANA.map(d => <div key={d} role="columnheader" className="bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">{d}</div>)}
        {dias.map(d => { const k = chaveDia(d); const itens = porDia.get(k) ?? []; const fora = d.getMonth() !== mes.getMonth(); const eHoje = k === chaveDia(hoje);
          return <div key={k} role="gridcell" className={`bg-card min-h-24 p-1.5 space-y-1 ${fora ? "opacity-50" : ""}`}>
            <span className={`text-xs tabular-nums ${eHoje ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{d.getDate()}</span>
            {itens.map(e => <Link key={e.id} to={`/editais/${e.id}`} className="block truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs text-foreground hover:bg-primary/20" title={e.titulo}>{e.titulo}</Link>)}
          </div>; })}
      </div>
      <ul className="md:hidden space-y-2">{dias.filter(d => d.getMonth() === mes.getMonth() && porDia.has(chaveDia(d))).map(d => <li key={chaveDia(d)} className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-medium">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}</p>
        <ul className="mt-1 space-y-1">{(porDia.get(chaveDia(d)) ?? []).map(e => <li key={e.id}><Link to={`/editais/${e.id}`} className="text-sm hover:underline">{e.titulo}</Link></li>)}</ul>
      </li>)}</ul>
      {!dias.some(d => d.getMonth() === mes.getMonth() && porDia.has(chaveDia(d))) && <p className="text-sm text-muted-foreground">Nenhum prazo de submissão neste mês.</p>}
    </>}
  </>;
}
