import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import FonteBadge from "@/components/operon/FonteBadge";
import { ErroOperon } from "@/components/operon/PortalEditalUI";
import { carregarSaudeColetas, ROTULO_SITUACAO_COLETA, type SaudeFonte, type SituacaoColeta } from "@/lib/operon-coletas";
import { fmtData } from "@/pages/editais/CuradoriaPage";

const varianteSituacao = (s: SituacaoColeta) =>
  s === "ok" ? "border-success/30 bg-success-light text-success"
    : s === "atencao" ? "border-warning/30 bg-warning-light text-warning-foreground"
      : s === "falha" ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

const truncar = (texto: string, limite = 160) => texto.length > limite ? `${texto.slice(0, limite)}…` : texto;

function LinhaFonte({ s }: { s: SaudeFonte }) {
  return <TableRow>
    <TableCell><FonteBadge slug={s.fonte.slug} nome={s.fonte.nome} /></TableCell>
    <TableCell><Badge variant="outline" className={varianteSituacao(s.situacao)}>{ROTULO_SITUACAO_COLETA[s.situacao]}</Badge></TableCell>
    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{s.ultimaColeta ? fmtData(s.ultimaColeta, true) : "Nunca"}</TableCell>
    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{s.ultimoOk ? fmtData(s.ultimoOk, true) : "Nunca"}</TableCell>
    <TableCell className="text-sm tabular-nums">{s.falhasSeguidas}</TableCell>
    <TableCell className="text-sm tabular-nums">{s.total} / {s.falhas}</TableCell>
    <TableCell className="max-w-56">
      {s.ultimoErro
        ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer select-none text-foreground">Último erro</summary><p className="mt-1 break-words">{truncar(s.ultimoErro)}</p></details>
        : <span className="text-xs text-muted-foreground">—</span>}
    </TableCell>
  </TableRow>;
}

export default function ColetasPage() {
  const saudeQ = useQuery({ queryKey: ["oe-saude-coletas"], queryFn: carregarSaudeColetas });
  return <>
    <div className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-bold font-heading">Saúde das coletas</h1>
      <p className="text-sm text-muted-foreground">Situação das coletas automáticas por fonte. A CAPES é coletada pelo Hermes sob demanda, por isso pode aparecer como "Sem coleta registrada".</p>
    </div>
    {saudeQ.isLoading ? <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      : saudeQ.isError ? <ErroOperon retry={() => saudeQ.refetch()} />
        : !saudeQ.data?.length ? <Placeholder title="Nenhuma fonte ativa" text="Não há fontes ativas para acompanhar." />
          : <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fonte</TableHead><TableHead>Situação</TableHead><TableHead>Última coleta</TableHead><TableHead>Última bem-sucedida</TableHead><TableHead>Falhas seguidas</TableHead><TableHead>Coletas / falhas</TableHead><TableHead>Detalhe</TableHead>
              </TableRow></TableHeader>
              <TableBody>{saudeQ.data.map(s => <LinhaFonte key={s.fonte.id} s={s} />)}</TableBody>
            </Table>
          </div>}
  </>;
}
