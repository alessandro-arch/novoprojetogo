import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Chip, FiltrosChamadas } from "@/lib/operon-chamadas";

export default function FiltrosChips({ chips, onRemover, onLimpar }: { chips: Chip[]; onRemover: (c: keyof FiltrosChamadas) => void; onLimpar: () => void }) {
  if (!chips.length) return null;
  return <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
    {chips.map(c => <span key={c.chave} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 pl-3 pr-1 py-0.5 text-sm">
      {c.rotulo}
      <button type="button" onClick={() => onRemover(c.chave)} aria-label={`Remover filtro ${c.rotulo}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-3.5 w-3.5" /></button>
    </span>)}
    <Button variant="ghost" size="sm" onClick={onLimpar}>Limpar tudo</Button>
  </div>;
}
