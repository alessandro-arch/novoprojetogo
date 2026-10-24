import { Badge } from "@/components/ui/badge";
import { fmtData } from "@/pages/editais/CuradoriaPage";
import { rotuloTipoValor, situacaoValor, textoValor, type CamposValor } from "@/lib/operon-valores";

/** Célula compacta: valor e tipo. */
export function ValorCompacto({ e }: { e: CamposValor }) {
  const s = situacaoValor(e);
  if (s === "sem_valor") return <span className="text-sm text-muted-foreground">Valor não informado</span>;
  return <span className="inline-flex flex-col gap-0.5">
    <span className="text-sm font-medium tabular-nums whitespace-nowrap">{textoValor(e)}</span>
    <span className="flex flex-wrap gap-1">
      <Badge variant="outline" className="text-xs">{rotuloTipoValor(e)}</Badge>
      {s === "nao_confirmado" && <Badge variant="secondary" className="text-xs">Aguardando confirmação</Badge>}
    </span>
  </span>;
}

/** Bloco completo para drawer e ficha. */
export function ValorBloco({ e }: { e: CamposValor }) {
  const s = situacaoValor(e);
  return <section aria-labelledby="valor-edital-titulo" className="space-y-1">
    <h3 id="valor-edital-titulo" className="text-sm font-semibold">Valor</h3>
    {s === "sem_valor" ? <p className="text-sm text-muted-foreground">Valor não informado</p> : <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold tabular-nums">{textoValor(e)}</span>
        <Badge variant="outline">{rotuloTipoValor(e)}</Badge>
      </div>
      {s === "nao_confirmado" && <p className="text-xs text-muted-foreground">Aguardando confirmação da curadoria.</p>}
      {s === "confirmado" && e.valor_confirmado_em && <p className="text-xs text-muted-foreground">Confirmado pela curadoria em {fmtData(e.valor_confirmado_em)}.</p>}
    </>}
    {e.valor_observacao?.trim() && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{e.valor_observacao}</p>}
  </section>;
}
