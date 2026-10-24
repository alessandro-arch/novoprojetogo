import { Link } from "react-router-dom";
import FonteBadge from "@/components/operon/FonteBadge";
import { diasAte, fmtData } from "@/pages/editais/CuradoriaPage";
import type { PrazoProximo } from "@/lib/operon-indicadores";

export default function ProximosPrazos({ itens }: { itens: PrazoProximo[] }) {
  return <ol className="divide-y divide-border">{itens.map(({ edital, prazo }) => {
    const dias = diasAte(prazo);
    return <li key={edital.id} className="py-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1"><Link to={`/editais/${edital.id}`} className="font-medium text-sm hover:underline break-words">{edital.titulo}</Link><FonteBadge slug={edital.oe_fonte?.slug} nome={edital.oe_fonte?.nome} /></div>
      <div className="text-right shrink-0"><p className="text-sm font-medium tabular-nums">{fmtData(prazo)}</p><p className="text-xs text-muted-foreground">{dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `Em ${dias} dias`}</p></div>
    </li>;
  })}</ol>;
}
