import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { ArrowLeft, ExternalLink, FileText, LogOut } from "lucide-react";
import { oe, EditalRow, Rodada, fmtData, rodadaVigente, ehVigente, diasAte, semNumero } from "./CuradoriaPage";
import { logoutOperon } from "@/lib/operon-access";

const NONE = "__none__";
const DESTAQUE = ["retificacao", "retificação", "errata", "adendo"];
const tm = (v: string | null) => (v ? new Date(v).getTime() : null);
const AvisoIes = ({ e }: { e: EditalRow }) => (
  e.restricao_ies === "exclui_privadas_com_fins_lucrativos" || e.restricao_ies === "somente_publicas"
) ? <div className="space-y-1"><Badge variant="destructive">Atenção: restrição para IES</Badge><p className="text-sm text-muted-foreground">Confirme se a sua instituição pode participar.</p></div> : null;

interface Documento { id: string; tipo: string | null; rotulo: string | null; url: string; versao: string | null }

const Erro = ({ msg, retry }: { msg: string; retry: () => void }) => (
  <div className="space-y-2">
    <Placeholder title="Não foi possível carregar" text={msg} />
    <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button>
  </div>
);

const PrazoBadge = ({ prazo }: { prazo: string | null | undefined }) => {
  const dias = diasAte(prazo);
  if (dias == null || dias < 0) return null;
  return <Badge variant={dias <= 7 ? "default" : "outline"}>{dias === 0 ? "Fecha hoje" : `Faltam ${dias} dias`}</Badge>;
};

const Detalhe = ({ e }: { e: EditalRow }) => {
  const docsQ = useQuery({
    queryKey: ["oe-publico-docs", e.id],
    queryFn: async () => {
      const { data, error } = await oe.from("oe_documento").select("id,tipo,rotulo,url,versao").eq("edital_id", e.id);
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });
  const agora = Date.now();
  const vig = rodadaVigente(e.oe_rodada);
  const rodadas = [...(e.oe_rodada ?? [])].sort((a, b) => a.ordem - b.ordem);
  const campos: [string, string | null][] = [
    [e.oe_fonte?.slug === "fapes" ? "Finalidade" : "Objetivo", e.objetivo], ["Recursos", e.recursos], ["Quem pode participar", e.quem_pode], ["Da Instituição de Ensino Superior", e.requisitos_ies], ["Contrapartida", e.contrapartida],
  ];

  return (
    <div className="space-y-5">
      <AvisoIes e={e} />
      {e.url_oficial && (
        <a href={e.url_oficial} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1"><ExternalLink className="w-4 h-4" /> Abrir no site oficial</Button>
        </a>
      )}
      {campos.filter(([, v]) => v && v.trim()).map(([k, v]) => (
        <div key={k}>
          <p className="text-sm font-semibold text-foreground">{k}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{v}</p>
        </div>
      ))}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Datas das rodadas</p>
        {rodadas.length === 0 ? <Placeholder title="Datas ainda não extraídas" text="Consulte o site oficial." />
          : rodadas.map((r: Rodada) => {
            const atual = vig && vig.ordem === r.ordem && (tm(r.abertura) ?? -Infinity) <= agora && (tm(r.prazo_fim) ?? Infinity) >= agora;
            const futura = (tm(r.abertura) ?? -Infinity) > agora;
            return (
              <div key={r.ordem} className={`rounded-xl border p-3 text-sm ${atual ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium">{r.ordem}ª rodada</span>
                  {atual && <Badge>Vigente</Badge>}
                  {futura && <Badge variant="outline">Inscrições abrem em {fmtData(r.abertura)}</Badge>}
                </div>
                <p className="text-muted-foreground">Abertura: {fmtData(r.abertura, true)} · Prazo final: {fmtData(r.prazo_fim, true)}</p>
                {r.texto_original && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line break-words">{r.texto_original}</p>}
              </div>
            );
          })}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Documentos para baixar</p>
        {docsQ.isLoading ? <Skeleton className="h-16 rounded-xl" />
          : docsQ.isError ? <Erro msg={(docsQ.error as Error)?.message ?? ""} retry={() => docsQ.refetch()} />
          : !docsQ.data?.length ? <Placeholder title="Nenhum documento" text="Ainda não há documentos para este edital." />
          : docsQ.data.map((d) => {
            const dest = DESTAQUE.includes((d.tipo ?? "").toLowerCase());
            return (
              <div key={d.id} className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${dest ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium whitespace-pre-line break-words">{d.rotulo ?? "Documento"}</p>
                  <div className="flex gap-2 mt-1">
                    {d.tipo && <Badge variant={dest ? "default" : "secondary"}>{d.tipo}</Badge>}
                    {d.versao && <span className="text-xs text-muted-foreground">Versão {d.versao}</span>}
                  </div>
                </div>
                <a href={d.url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline">Baixar</Button></a>
              </div>
            );
          })}
      </div>
    </div>
  );
};

const EditaisPage = () => {
  const [fonte, setFonte] = useState(NONE);
  const [sel, setSel] = useState<EditalRow | null>(null);
  const [saindo, setSaindo] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    setSaindo(true);
    try {
      await logoutOperon(navigate);
    } catch {
      toast({ title: "Erro ao sair", description: "Não foi possível sair. Tente novamente.", variant: "destructive" });
    } finally {
      setSaindo(false);
    }
  };

  const fontesQ = useQuery({
    queryKey: ["oe-fontes"],
    queryFn: async () => {
      const { data, error } = await oe.from("oe_fonte").select("id,slug,nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; slug: string; nome: string }[];
    },
  });

  const listaQ = useQuery({
    queryKey: ["oe-publicos", fonte],
    queryFn: async () => {
      let q = oe.from("oe_edital")
        .select("*, oe_fonte(slug,nome), oe_rodada(ordem,abertura,prazo_fim,texto_original)")
        .eq("status_curadoria", "publicado");
      if (fonte !== NONE) q = q.eq("fonte_id", fonte);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EditalRow[];
    },
  });

  const lista = useMemo(() => {
    const agora = Date.now();
    return (listaQ.data ?? []).filter((e) => ehVigente(e, agora))
      .map((e) => ({ e, v: rodadaVigente(e.oe_rodada) }))
      .sort((a, b) => (tm(a.v?.prazo_fim ?? null) ?? Infinity) - (tm(b.v?.prazo_fim ?? null) ?? Infinity));
  }, [listaQ.data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold font-heading text-foreground">Operon Fomento</h1>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button></Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={saindo}><LogOut className="w-4 h-4 mr-1" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground">Editais vigentes</h2>
          <p className="text-sm text-muted-foreground">Resumos feitos pela curadoria. Confirme no texto oficial do edital.</p>
        </div>

        <div className="space-y-1 w-full sm:w-56">
          <Label className="text-xs">Fonte</Label>
          <Select value={fonte} onValueChange={setFonte}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todos</SelectItem>
              {(fontesQ.data ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {listaQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : listaQ.isError ? (
          <Erro msg={(listaQ.error as Error)?.message ?? ""} retry={() => listaQ.refetch()} />
        ) : lista.length === 0 ? (
          <Placeholder title="Nenhum edital vigente" text="Nenhum edital vigente publicado ainda. Os editais aparecem aqui depois da conferência da curadoria." />
        ) : (
          <div className="space-y-3">
            {lista.map(({ e, v }) => (
              <button key={e.id} onClick={() => setSel(e)}
                className="w-full text-left bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="secondary">{e.oe_fonte?.nome ?? "Fonte"}</Badge>
                  {semNumero(e.numero) ? <Badge variant="outline">Sem número</Badge>
                    : <span className="text-xs text-muted-foreground">{e.numero}{e.ano ? `/${e.ano}` : ""}</span>}
                  <PrazoBadge prazo={v?.prazo_fim} />
                </div>
                <p className="font-medium text-foreground text-sm">{e.titulo}</p>
                <AvisoIes e={e} />
                <p className="text-xs text-muted-foreground mt-1">
                  {e.categoria ?? "Sem categoria"} · Prazo: {v ? fmtData(v.prazo_fim, true) : "Datas ainda não extraídas"}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {sel && (<>
            <DialogHeader>
              <DialogTitle className="font-heading">{sel.titulo}</DialogTitle>
              <DialogDescription>
                {sel.oe_fonte?.nome ?? ""} · {sel.categoria ?? "Sem categoria"} · {semNumero(sel.numero) ? "Sem número" : sel.numero}
              </DialogDescription>
            </DialogHeader>
            <Detalhe e={sel} />
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditaisPage;
