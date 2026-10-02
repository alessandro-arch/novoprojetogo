import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { StatusBadge, RequestTimeline, notify, isOpen, fmtDate, fmtDT } from "./sd-requests";

const db = supabase as any;

const ACT_TITLE: Record<string, string> = { aprovar: "Autorizar", corrigir: "Solicitar correção", recusar: "Indeferir", iniciar: "Marcar em execução", concluir: "Liberar / concluir" };

/** Detalhe da solicitação: uma única tela com dados, termo, linha do tempo e ações da etapa atual. */
const RequestDetail = ({ userId, isAdminOf }: { userId: string; isAdminOf: (orgId: string) => boolean }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [act, setAct] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: r, isLoading } = useQuery({
    queryKey: ["sd-req", id],
    queryFn: async () => (await db.from("sd_requests").select("*, sd_services(name, steps), sd_groups(id, code, name)").eq("id", id).maybeSingle()).data,
  });
  const { data: myGroupIds = [] } = useQuery({
    queryKey: ["sd-my-group-ids", userId],
    queryFn: async () => ((await db.from("sd_group_members").select("group_id").eq("user_id", userId)).data || []).map((x: any) => x.group_id),
  });
  const { data: student } = useQuery({
    queryKey: ["sd-req-student", r?.organization_id, r?.requester_enrollment], enabled: r?.requester_kind === "aluno",
    queryFn: async () => (await db.from("sd_students").select("level, entry_date, current_deadline, advisor:sd_faculty(full_name), sd_programs(name)").eq("organization_id", r.organization_id).eq("enrollment", r.requester_enrollment).maybeSingle()).data,
  });

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!r) return <div className="p-6 text-center"><p className="text-muted-foreground">Solicitação não encontrada ou sem permissão.</p><Button variant="outline" className="mt-3" onClick={() => navigate(-1)}>Voltar</Button></div>;

  const steps: string[] = r.sd_services?.steps || [];
  const last = r.step_index >= steps.length - 1;
  const canAct = isOpen(r.status) && r.requester_user_id !== userId && (isAdminOf(r.organization_id) || (r.current_group_id && myGroupIds.includes(r.current_group_id)));
  const actions = !canAct ? [] : last ? [...(r.status !== "em_andamento" ? ["iniciar"] : []), "concluir", "recusar"] : ["aprovar", "corrigir", "recusar"];

  const run = async () => {
    if (!act) return;
    setBusy(true);
    const { error } = await db.rpc("sd_advance_request", { _id: r.id, _action: act, _note: note || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação atualizada");
    notify({ request_id: r.id, event: act });
    setAct(null); setNote("");
    ["sd-req", "sd-queue", "sd-req-events", "sd-notif"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const info: [string, string][] = [
    ["Solicitante", r.requester_name], ["Matrícula", r.requester_enrollment], ["Tipo", r.requester_kind],
    ["Programa", student?.sd_programs?.name || r.requester_program || "—"],
    ...(student ? [["Nível", student.level || "—"], ["Orientador(a)", student.advisor?.full_name || "—"], ["Ingresso", fmtDate(student.entry_date)], ["Prazo vigente", fmtDate(student.current_deadline)]] as [string, string][] : []),
    ["E-mail", r.requester_email || "—"],
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{r.protocol}</p>
          <h1 className="text-2xl font-bold font-heading">{r.sd_services?.name}</h1>
          <p className="text-sm text-muted-foreground">Recebida em {fmtDT(r.created_at)}{r.sd_groups && isOpen(r.status) ? ` · etapa atual: ${r.sd_groups.code} desde ${fmtDT(r.stage_entered_at)}` : ""}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Solicitante</CardTitle></CardHeader><CardContent>
          <dl className="grid grid-cols-2 gap-3">{info.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm font-medium capitalize-first">{v}</dd></div>)}</dl>
          <div className="mt-4 space-y-1 text-sm">
            {r.terms_accepted_at && <p className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />Termo aceito em {fmtDT(r.terms_accepted_at)}</p>}
            {r.terms_hash && <p className="flex items-center gap-2 text-xs text-muted-foreground break-all"><Check className="w-4 h-4 text-primary shrink-0" />Assinatura registrada: {r.terms_hash.slice(0, 16)}…</p>}
          </div>
        </CardContent></Card>
        <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader><CardContent><RequestTimeline requestId={r.id} status={r.status} /></CardContent></Card>
      </div>

      {canAct && last && (
        <Card className="rounded-xl border-dashed"><CardHeader><CardTitle className="text-base">Dados da configuração</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-3 gap-3">
          <div><Label>IP VPN</Label><Input disabled placeholder="Na próxima etapa" /></div>
          <div><Label>PublicKey do Peer</Label><Input disabled placeholder="Na próxima etapa" /></div>
          <div><Label>Arquivo .conf</Label><Input disabled type="file" /></div>
          <p className="sm:col-span-3 text-xs text-muted-foreground">Estes campos serão ativados com o fluxo da VPN.</p>
        </CardContent></Card>
      )}

      {!!actions.length && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => <Button key={a} variant={a === "recusar" ? "destructive" : a === "corrigir" || a === "iniciar" ? "secondary" : "default"} onClick={() => setAct(a)}>{ACT_TITLE[a]}</Button>)}
        </div>
      )}

      <Dialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{act && ACT_TITLE[act]} — {r.protocol}</DialogTitle></DialogHeader>
          <Label>{act === "recusar" ? "Motivo (obrigatório)" : act === "corrigir" ? "O que precisa ser corrigido (obrigatório)" : "Observação (opcional)"}</Label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setAct(null)}>Cancelar</Button><Button disabled={busy || ((act === "recusar" || act === "corrigir") && note.trim().length < 3)} onClick={run}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestDetail;
