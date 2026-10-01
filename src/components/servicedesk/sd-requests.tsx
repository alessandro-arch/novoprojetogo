import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, XCircle } from "lucide-react";

const db = supabase as any;

export const STATUS_LABEL: Record<string, string> = {
  em_analise: "Aguardando análise", aprovado: "Autorizado — aguardando execução", em_andamento: "Em execução",
  concluido: "Concluído", recusado: "Indeferido", correcao: "Correção solicitada",
};
export const ACTION_LABEL: Record<string, string> = {
  criada: "Solicitação enviada", aprovar: "Autorizada", iniciar: "Execução iniciada", concluir: "Concluída",
  recusar: "Indeferida", corrigir: "Correção solicitada",
};
export const OPEN_STATUSES = ["em_analise", "aprovado", "em_andamento", "correcao"];
export const isOpen = (s: string) => OPEN_STATUSES.includes(s);

export const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "concluido" ? "default" : s === "recusado" ? "destructive" : s === "em_analise" || s === "correcao" ? "outline" : "secondary";

/** Etiqueta de situação com as mesmas cores em todas as áreas. */
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={statusVariant(status)}>{STATUS_LABEL[status] || status}</Badge>
);

export const notify = (body: Record<string, unknown>) => {
  supabase.functions.invoke("sd-notify", { body }).catch(() => {});
};

export const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
export const fmtDT = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtDur = (ms: number) => {
  const h = Math.round(ms / 36e5);
  return h < 1 ? "menos de 1 h" : h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`;
};

/** Linha do tempo visual: cada etapa com data/hora, responsável e tempo decorrido desde a etapa anterior. */
export const RequestTimeline = ({ requestId, status }: { requestId: string; status?: string }) => {
  const { data } = useQuery({
    queryKey: ["sd-req-events", requestId],
    queryFn: async () => (await db.from("sd_request_events").select("*").eq("request_id", requestId).order("created_at")).data || [],
  });
  if (!data?.length) return null;
  return (
    <ol className="space-y-3">
      {data.map((e: any, i: number) => {
        const prev = data[i - 1];
        const bad = e.action === "recusar";
        return (
          <li key={e.id} className="flex gap-3">
            {bad ? <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />}
            <div className="text-sm">
              <p className="font-medium">{ACTION_LABEL[e.action] || e.action}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDT(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ""}{prev ? ` · após ${fmtDur(new Date(e.created_at).getTime() - new Date(prev.created_at).getTime())}` : ""}
              </p>
              {e.note && <p className="text-xs mt-0.5">{e.note}</p>}
            </div>
          </li>
        );
      })}
      {status && isOpen(status) && (
        <li className="flex gap-3"><Circle className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" /><p className="text-sm font-medium">{STATUS_LABEL[status]}</p></li>
      )}
    </ol>
  );
};
