import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge from "@/components/operon/AbrangenciaBadge";
import SeguirEditalButton from "@/components/operon/SeguirEditalButton";
import { RestricaoIes, SituacaoEdital, PrazoTexto } from "@/components/operon/PortalEditalUI";
import { ValorBloco } from "@/components/operon/ValorEdital";
import { fmtData } from "@/pages/editais/CuradoriaPage";
import { numeroEdital, type EditalPublicado } from "@/lib/operon-portal";

export default function EditalDrawer({ edital, onClose }: { edital: EditalPublicado | null; onClose: () => void }) {
  return <Sheet open={!!edital} onOpenChange={v => { if (!v) onClose(); }}>
    <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
      {edital && <div className="space-y-5">
        <SheetHeader className="text-left space-y-3">
          <div className="flex flex-wrap gap-1.5"><FonteBadge slug={edital.oe_fonte?.slug} nome={edital.oe_fonte?.nome} /><AbrangenciaBadge abrangencia={edital.abrangencia} /></div>
          <SheetTitle className="font-heading break-words">{edital.titulo}</SheetTitle>
          <SheetDescription>{numeroEdital(edital)}</SheetDescription>
        </SheetHeader>
        <SituacaoEdital e={edital} />
        <div><p className="text-sm font-medium">Prazo</p><PrazoTexto e={edital} /></div>
        <ValorBloco e={edital} />
        {edital.resumo_tldr?.trim() && <section className="border-l-2 border-primary pl-4 space-y-1"><h3 className="text-sm font-semibold">Em resumo</h3><p className="text-sm whitespace-pre-line">{edital.resumo_tldr}</p></section>}
        {!!edital.oe_rodada?.length && <section className="space-y-2"><h3 className="text-sm font-semibold">Rodadas</h3><ul className="space-y-1 text-sm">{[...edital.oe_rodada].sort((a, b) => a.ordem - b.ordem).map(r => <li key={r.ordem}>Rodada {r.ordem}: {r.abertura ? fmtData(r.abertura) : "abertura a confirmar"} até {r.prazo_fim ? fmtData(r.prazo_fim, true) : "prazo a confirmar"}</li>)}</ul></section>}
        <RestricaoIes e={edital} aviso />
        <SeguirEditalButton editalId={edital.id} />
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button asChild><Link to={`/editais/${edital.id}`}>Ver ficha completa</Link></Button>
          {edital.url_oficial && <Button asChild variant="outline"><a href={edital.url_oficial} target="_blank" rel="noopener noreferrer"><ExternalLink />Texto oficial</a></Button>}
        </div>
        <p className="text-xs text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
      </div>}
    </SheetContent>
  </Sheet>;
}
