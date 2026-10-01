import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const STATUS_LABEL: Record<string, string> = {
  em_analise: "Em análise", aprovado: "Aprovado — aguardando execução", em_andamento: "Em andamento", concluido: "Concluído", recusado: "Recusado",
};
export const ACTION_LABEL: Record<string, string> = {
  criada: "Solicitação enviada", aprovar: "Aprovada", iniciar: "Execução iniciada", concluir: "Concluída", recusar: "Recusada",
};
export const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "concluido" ? "default" : s === "recusado" ? "destructive" : s === "em_analise" ? "outline" : "secondary";

export const notify = (body: Record<string, unknown>) => {
  supabase.functions.invoke("sd-notify", { body }).catch(() => {});
};

const fmtDT = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const RequestTimeline = ({ requestId }: { requestId: string }) => {
  const { data } = useQuery({
    queryKey: ["sd-req-events", requestId],
    queryFn: async () => (await db.from("sd_request_events").select("*").eq("request_id", requestId).order("created_at")).data || [],
  });
  if (!data?.length) return null;
  return (
    <ol className="text-xs space-y-1 border-l pl-3">
      {data.map((e: any) => (
        <li key={e.id}><span className="text-muted-foreground">{fmtDT(e.created_at)}</span> · {ACTION_LABEL[e.action] || e.action}{e.actor_name ? ` por ${e.actor_name}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
      ))}
    </ol>
  );
};
