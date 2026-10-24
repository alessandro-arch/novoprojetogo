import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { temRestricaoIes } from "@/lib/operon-portal";
import type { EditalRow } from "@/pages/editais/CuradoriaPage";

export default function RestricaoIesIcone({ e }: { e: EditalRow }) {
  if (!temRestricaoIes(e)) return null;
  const texto = e.restricao_ies === "somente_publicas" ? "Restrito a instituições públicas" : "Exclui instituições privadas com fins lucrativos";
  return <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" onClick={ev => ev.stopPropagation()} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Atenção: restrição para IES. {texto}</span>
      </button>
    </TooltipTrigger>
    <TooltipContent><p className="font-medium">Atenção: restrição para IES</p><p className="text-xs">{texto}. Confirme se a sua instituição pode participar.</p></TooltipContent>
  </Tooltip>;
}
