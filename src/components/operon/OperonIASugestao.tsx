import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import type { SugestaoIA } from "@/lib/operon-ia";

export default function OperonIASugestao({ sugestao, aceitar, descartar, disabled = false }: {
  sugestao?: SugestaoIA; aceitar: () => void; descartar: () => void; disabled?: boolean;
}) {
  if (!sugestao) return null;
  return <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
    <Badge variant="outline">Sugerido pela IA</Badge>
    <details><summary className="cursor-pointer text-primary">Trecho de origem</summary><blockquote className="mt-2 whitespace-pre-line text-muted-foreground border-l-2 border-border pl-3">{sugestao.trecho_origem}</blockquote></details>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={aceitar} disabled={disabled}><Check className="mr-1 h-4 w-4" />Aceitar</Button>
      <Button type="button" variant="ghost" size="sm" onClick={descartar} disabled={disabled}><X className="mr-1 h-4 w-4" />Descartar</Button>
    </div>
  </div>;
}