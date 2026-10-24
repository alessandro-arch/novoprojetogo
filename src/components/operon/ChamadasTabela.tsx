import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FonteBadge from "@/components/operon/FonteBadge";
import AbrangenciaBadge from "@/components/operon/AbrangenciaBadge";
import RestricaoIesIcone from "@/components/operon/RestricaoIesIcone";
import { SeguirEditalCompacto } from "@/components/operon/SeguirEditalButton";
import { PrazoTexto } from "@/components/operon/PortalEditalUI";
import { Badge } from "@/components/ui/badge";
import { fmtData, situacaoEdital } from "@/pages/editais/CuradoriaPage";
import { numeroEdital, type EditalPublicado } from "@/lib/operon-portal";
import { dataPublicacao, valorEdital, ROTULO_SITUACAO, type ColunaOrdem, type Ordem } from "@/lib/operon-chamadas";

interface Props { lista: EditalPublicado[]; seguidos: Set<string>; ordem: Ordem; onOrdenar: (c: ColunaOrdem) => void; onAbrir: (e: EditalPublicado) => void }

const Situacao = ({ e }: { e: EditalPublicado }) => <Badge variant="secondary" className="whitespace-nowrap">{ROTULO_SITUACAO[situacaoEdital(e) ?? ""] ?? "A confirmar"}</Badge>;

function Cabecalho({ coluna, titulo, ordem, onOrdenar, className }: { coluna: ColunaOrdem; titulo: string; ordem: Ordem; onOrdenar: (c: ColunaOrdem) => void; className?: string }) {
  const ativo = ordem.coluna === coluna;
  const Icone = !ativo ? ArrowUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return <TableHead className={className} aria-sort={ativo ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" onClick={() => onOrdenar(coluna)} className="inline-flex items-center gap-1 font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {titulo}<Icone className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </TableHead>;
}

export default function ChamadasTabela({ lista, seguidos, ordem, onOrdenar, onAbrir }: Props) {
  const mostrarValor = lista.some(e => valorEdital(e) !== null);
  return <div className="hidden md:block rounded-xl border border-border overflow-hidden">
    <Table>
      <TableHeader className="bg-muted/50"><TableRow>
        <TableHead>Edital</TableHead>
        <Cabecalho coluna="fonte" titulo="Fonte" ordem={ordem} onOrdenar={onOrdenar} />
        <TableHead>Situação</TableHead>
        <Cabecalho coluna="prazo" titulo="Prazo" ordem={ordem} onOrdenar={onOrdenar} />
        <Cabecalho coluna="publicacao" titulo="Publicação" ordem={ordem} onOrdenar={onOrdenar} />
        {mostrarValor && <TableHead>Valor</TableHead>}
        <TableHead className="w-28"><span className="sr-only">Ações</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{lista.map(e => <TableRow key={e.id} className="cursor-pointer" onClick={() => onAbrir(e)}>
        <TableCell className="py-2.5 max-w-md">
          <div className="flex items-start gap-1">
            <button type="button" onClick={ev => { ev.stopPropagation(); onAbrir(e); }} className="text-left font-medium hover:underline break-words rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{e.titulo}</button>
            <RestricaoIesIcone e={e} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground"><span>{numeroEdital(e)}</span><AbrangenciaBadge abrangencia={e.abrangencia} /></div>
        </TableCell>
        <TableCell className="py-2.5"><FonteBadge slug={e.oe_fonte?.slug} nome={e.oe_fonte?.nome} /></TableCell>
        <TableCell className="py-2.5"><Situacao e={e} /></TableCell>
        <TableCell className="py-2.5"><PrazoTexto e={e} /></TableCell>
        <TableCell className="py-2.5 text-sm text-muted-foreground whitespace-nowrap">{dataPublicacao(e) ? fmtData(dataPublicacao(e)) : "Não informada"}</TableCell>
        {mostrarValor && <TableCell className="py-2.5" />}
        <TableCell className="py-2.5 text-right"><SeguirEditalCompacto editalId={e.id} seguindo={seguidos.has(e.id)} titulo={e.titulo} /></TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>;
}
