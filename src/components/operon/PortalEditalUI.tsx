import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { diasAte, fmtData, SITUACOES, type EditalRow } from "@/pages/editais/CuradoriaPage";
import { prazoEdital, temRestricaoIes } from "@/lib/operon-portal";

export const RodapeOperon = () => <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">Informações resumidas com fins de divulgação. Confirme sempre no texto oficial do edital.</footer>;
export const ErroOperon = ({ retry }: { retry: () => void }) => <div className="space-y-3"><Placeholder title="Não foi possível carregar" text="Tente novamente em instantes." /><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>;
export const RestricaoIes = ({ e, aviso = false }: { e: EditalRow; aviso?: boolean }) => temRestricaoIes(e) ? <div className="space-y-1"><Badge variant="destructive">Atenção: restrição para IES</Badge>{aviso && <p className="text-sm text-muted-foreground">Confirme se a sua instituição pode participar.</p>}</div> : null;
export const PrazoBadge = ({ e }: { e: EditalRow }) => {
  const dias = diasAte(prazoEdital(e));
  return dias == null || dias < 0 ? null : <Badge variant={dias <= 7 ? "default" : "outline"}>{dias === 0 ? "Fecha hoje" : `Faltam ${dias} dias`}</Badge>;
};
export const SituacaoEdital = ({ e }: { e: EditalRow }) => <div className="flex flex-wrap gap-1.5"><Badge variant="secondary">{SITUACOES[e.situacao ?? ""] ?? "Situação a confirmar"}</Badge><PrazoBadge e={e} /></div>;
export const PrazoTexto = ({ e }: { e: EditalRow }) => <span className="text-sm text-muted-foreground">{e.situacao === "em_julgamento" ? "Inscrições encerradas, acompanhe o resultado" : e.situacao === "resultado" ? "Resultados divulgados" : prazoEdital(e) ? fmtData(prazoEdital(e), true) : "Prazo a confirmar"}</span>;