import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Download, Loader2 } from "lucide-react";
import { oe, fmtData, rodadaVigente, SITUACOES, semNumero, type EditalRow, type Rodada } from "@/pages/editais/CuradoriaPage";

type Campo = "objetivo" | "recursos" | "quem_pode" | "contrapartida" | "areas";
const CAMPOS: { key: Campo; label: string }[] = [
  { key: "objetivo", label: "Objetivo" },
  { key: "recursos", label: "Recursos" },
  { key: "quem_pode", label: "Quem pode participar" },
  { key: "contrapartida", label: "Contrapartida" },
  { key: "areas", label: "Áreas (separadas por vírgula)" },
];
const CONF: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  alta: { label: "Confiança alta", variant: "default" },
  media: { label: "Confiança média", variant: "secondary" },
  baixa: { label: "Confiança baixa", variant: "outline" },
};
const DESTAQUE = ["retificacao", "retificação", "errata", "adendo"];
const EVENTOS: Record<string, string> = {
  novo_edital: "Novo edital", prazo_alterado: "Prazo alterado", retificacao: "Retificação", errata: "Errata",
  adendo: "Adendo", anexo_novo: "Novo anexo", versao_atualizada: "Versão atualizada", rodada_aberta: "Rodada aberta",
  status_mudou: "Situação alterada", resultado_preliminar: "Resultado preliminar", resultado_final: "Resultado final",
  resultado_retificado: "Resultado retificado", resultado_sem_efeito: "Resultado sem efeito", edital_revogado: "Edital revogado",
  prazo_de_recurso: "Prazo de recurso",
};

interface Extracao { id: string; campo: string; valor: string | null; trecho_origem: string | null; confianca: string | null; status: string; created_at: string }

const useLista = <T,>(key: string, id: string, table: string, order: string, asc: boolean, extra?: (q: any) => any) =>
  useQuery({
    queryKey: [key, id],
    queryFn: async () => {
      let q = oe.from(table).select("*").eq("edital_id", id);
      if (extra) q = extra(q);
      const { data, error } = await q.order(order, { ascending: asc });
      if (error) throw error;
      return data as T[];
    },
  });

const Bloco = ({ q, vazio, children }: { q: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; data?: unknown[] }; vazio: string; children: React.ReactNode }) => {
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  if (q.isError) return <div className="space-y-2"><Placeholder title="Não foi possível carregar" text={(q.error as Error)?.message ?? ""} /><Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button></div>;
  if (!q.data?.length) return <Placeholder title={vazio} text="" />;
  return <>{children}</>;
};

const toText = (e: EditalRow, k: Campo) => (k === "areas" ? (e.areas ?? []).join(", ") : (e[k] ?? ""));

const EditalCuradoriaDetail = ({ edital }: { edital: EditalRow }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<Campo, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.key, toText(edital, c.key)])) as Record<Campo, string>);

  const rodadasQ = useLista<Rodada>("oe-rodadas", edital.id, "oe_rodada", "ordem", true);
  const docsQ = useLista<any>("oe-docs", edital.id, "oe_documento", "publicado_em", false);
  const evQ = useLista<any>("oe-eventos", edital.id, "oe_evento", "ocorrido_em", false);
  const extQ = useLista<Extracao>("oe-extracoes", edital.id, "oe_extracao", "created_at", false,
    (q) => q.in("campo", CAMPOS.map((c) => c.key)));

  // Extração mais recente por campo (lista vem em created_at desc)
  const extPorCampo: Record<string, Extracao> = {};
  (extQ.data ?? []).forEach((x) => { if (!extPorCampo[x.campo]) extPorCampo[x.campo] = x; });

  const norm = (s: string | null | undefined) => (s ?? "").trim();
  const payloadCampos = () => ({
    objetivo: norm(form.objetivo) || null,
    recursos: norm(form.recursos) || null,
    quem_pode: norm(form.quem_pode) || null,
    contrapartida: norm(form.contrapartida) || null,
    areas: form.areas.split(",").map((s) => s.trim()).filter(Boolean),
  });

  const invalidar = () => {
    ["oe-editais", "oe-contadores", "oe-extracoes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const mut = useMutation({
    mutationFn: async (acao: "publicar" | "revisao" | "descartar") => {
      const agora = new Date().toISOString();
      let upd: Record<string, unknown>;
      if (acao === "descartar") upd = { status_curadoria: "descartado" };
      else if (acao === "revisao") upd = { ...payloadCampos(), status_curadoria: "em_revisao" };
      else upd = { ...payloadCampos(), status_curadoria: "publicado", verificado_em: agora, verificado_por: user?.id };
      const { error } = await oe.from("oe_edital").update(upd).eq("id", edital.id);
      if (error) throw error;
      let falhas = 0;
      if (acao === "publicar") {
        for (const x of extQ.data ?? []) {
          const final = x.campo === "areas"
            ? form.areas.split(",").map((s) => s.trim()).filter(Boolean).join(",")
            : norm(form[x.campo as Campo]);
          const extraido = x.campo === "areas"
            ? (x.valor ?? "").split(",").map((s) => s.trim()).filter(Boolean).join(",")
            : norm(x.valor);
          const { error: e2 } = await oe.from("oe_extracao").update({
            status: final === extraido ? "aprovado" : "editado", revisado_por: user?.id, revisado_em: agora,
          }).eq("id", x.id);
          if (e2) falhas++;
        }
      }
      return { acao, falhas };
    },
    onSuccess: ({ acao, falhas }) => {
      if (acao === "publicar" && falhas > 0) {
        toast({
          title: "Edital publicado com ressalva",
          description: `O edital foi publicado, mas ${falhas} ${falhas === 1 ? "extração não foi marcada" : "extrações não foram marcadas"}. Revise as extrações manualmente.`,
          variant: "destructive",
        });
      } else {
        toast({ title: acao === "publicar" ? "Edital publicado" : acao === "revisao" ? "Salvo como em revisão" : "Edital descartado" });
      }
      invalidar();
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const vig = rodadaVigente(rodadasQ.data ?? []);
  const agora = Date.now();

  return (
    <div className="space-y-4 min-w-0">
      <Card className="rounded-xl">
        <CardContent className="py-5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{edital.oe_fonte?.nome ?? edital.oe_fonte?.slug}</Badge>
            {semNumero(edital.numero) ? <Badge variant="outline">Sem número</Badge> : <Badge variant="outline">Nº {edital.numero}</Badge>}
            {edital.categoria && <Badge variant="secondary">{edital.categoria}</Badge>}
            {edital.situacao && <Badge variant="secondary">{SITUACOES[edital.situacao] ?? edital.situacao}</Badge>}
          </div>
          <h3 className="text-lg font-bold font-heading text-foreground">{edital.titulo}</h3>
          {edital.url_oficial && (
            <a href={edital.url_oficial} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Abrir no site oficial <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <p className="text-xs text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Cartão público</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {extQ.isError && <p className="text-xs text-destructive">Não foi possível carregar os valores extraídos.</p>}
          {CAMPOS.map(({ key, label }) => {
            const x = extPorCampo[key];
            return (
              <div key={key} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{label}</Label>
                  {key === "areas"
                    ? <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                    : <Textarea rows={4} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 text-sm text-muted-foreground">
                  {extQ.isLoading ? <Skeleton className="h-16 w-full" /> : !x ? <p>Sem valor extraído.</p> : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">Valor extraído</span>
                        {x.confianca && CONF[x.confianca] && <Badge variant={CONF[x.confianca].variant}>{CONF[x.confianca].label}</Badge>}
                      </div>
                      <p className="whitespace-pre-wrap">{x.valor || "-"}</p>
                      {x.trecho_origem && <p className="text-xs italic border-l-2 border-border pl-2 whitespace-pre-wrap">"{x.trecho_origem}"</p>}
                      <Button type="button" variant="outline" size="sm" disabled={!x.valor}
                        onClick={() => setForm({ ...form, [key]: x.valor ?? "" })}>Usar valor extraído</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Datas das rodadas</CardTitle></CardHeader>
        <CardContent>
          <Bloco q={rodadasQ} vazio="Datas ainda não extraídas">
            <div className="space-y-2">
              {(rodadasQ.data ?? []).map((r) => {
                const emAndamento = vig === r && (r.abertura ? new Date(r.abertura).getTime() <= agora : true) && (r.prazo_fim ? new Date(r.prazo_fim).getTime() >= agora : true);
                const futura = r.abertura && new Date(r.abertura).getTime() > agora;
                return (
                  <div key={r.id ?? r.ordem} className={`rounded-xl border p-3 ${emAndamento ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{r.ordem}ª chamada</span>
                      {emAndamento && <Badge>Vigente</Badge>}
                      {futura && <Badge variant="outline">Inscrições abrem em {fmtData(r.abertura)}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Abertura: {fmtData(r.abertura, true)} · Prazo final: {fmtData(r.prazo_fim, true)}</p>
                    {r.texto_original && <p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap">"{r.texto_original}"</p>}
                  </div>
                );
              })}
            </div>
          </Bloco>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
        <CardContent>
          <Bloco q={docsQ} vazio="Nenhum documento">
            <div className="space-y-2">
              {(docsQ.data ?? []).map((d) => {
                const dest = DESTAQUE.includes(String(d.tipo ?? "").toLowerCase());
                return (
                  <div key={d.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${dest ? "border-destructive/50" : "border-border"}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={dest ? "destructive" : "secondary"}>{d.tipo ?? "Documento"}</Badge>
                        {d.versao != null && <span className="text-xs text-muted-foreground">v{d.versao}</span>}
                        {d.substituido && <Badge variant="outline">Substituído</Badge>}
                      </div>
                      <p className="text-sm text-foreground mt-1 break-words">{d.rotulo ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{fmtData(d.publicado_em)}</p>
                    </div>
                    {d.url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={d.url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-1" /> Baixar</a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Bloco>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
        <CardContent>
          <Bloco q={evQ} vazio="Nenhum evento">
            <ol className="space-y-3 border-l border-border pl-4">
              {(evQ.data ?? []).map((ev) => (
                <li key={ev.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">{EVENTOS[ev.tipo] ?? ev.tipo}</span>
                    {ev.origem === "carga_inicial" && <Badge variant="outline">Carga inicial</Badge>}
                    <span className="text-xs text-muted-foreground">{fmtData(ev.ocorrido_em, true)}</span>
                  </div>
                  {(ev.valor_anterior || ev.valor_novo) && (
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {ev.valor_anterior ?? "-"} → {ev.valor_novo ?? "-"}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Bloco>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 sticky bottom-0 bg-background py-3">
        <Button disabled={mut.isPending} onClick={() => mut.mutate("publicar")}>
          {mut.isPending && mut.variables === "publicar" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Aprovar e publicar
        </Button>
        <Button variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("revisao")}>
          {mut.isPending && mut.variables === "revisao" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar como em revisão
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={mut.isPending}>Descartar</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar este edital?</AlertDialogTitle>
              <AlertDialogDescription>Ele sai da fila de curadoria, mas nenhum dado é apagado.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => mut.mutate("descartar")}>Descartar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default EditalCuradoriaDetail;
