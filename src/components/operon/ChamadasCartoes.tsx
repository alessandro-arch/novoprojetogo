import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge from "@/components/operon/AbrangenciaBadge";
import RestricaoIesIcone from "@/components/operon/RestricaoIesIcone";
import { SeguirEditalCompacto } from "@/components/operon/SeguirEditalButton";
import { PrazoTexto } from "@/components/operon/PortalEditalUI";
import { situacaoEdital } from "@/pages/editais/CuradoriaPage";
import { numeroEdital, type EditalPublicado } from "@/lib/operon-portal";
import { ValorCompacto } from "@/components/operon/ValorEdital";
import { ROTULO_SITUACAO } from "@/lib/operon-chamadas";

export default function ChamadasCartoes({ lista, seguidos, onAbrir }: { lista: EditalPublicado[]; seguidos: Set<string>; onAbrir: (e: EditalPublicado) => void }) {
  return <div className="md:hidden space-y-3">{lista.map(e => <Card key={e.id} className="rounded-xl">
    <CardContent className="p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5"><FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} /><Badge variant="secondary">{ROTULO_SITUACAO[situacaoEdital(e) ?? ""] ?? "A confirmar"}</Badge><RestricaoIesIcone e={e} /></div>
      <button type="button" onClick={() => onAbrir(e)} className="text-left font-semibold break-words rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{e.titulo}</button>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{numeroEdital(e)}</span><AbrangenciaBadge abrangencia={e.abrangencia} /></div>
      <ValorCompacto e={e} />
      <div className="flex items-center justify-between gap-2"><PrazoTexto e={e} /><SeguirEditalCompacto editalId={e.id} seguindo={seguidos.has(e.id)} titulo={e.titulo} /></div>
    </CardContent>
  </Card>)}</div>;
}
