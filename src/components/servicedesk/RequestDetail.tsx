import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [corrFields, setCorrFields] = useState<string[]>([]);
  const [edit, setEdit] = useState<Record<string, string> | null>(null);

  const { data: r, isLoading } = useQuery({
    queryKey: ["sd-req", id],
    queryFn: async () => (await db.from("sd_requests").select("*, sd_services(name, steps, form_fields), sd_groups(id, code, name)").eq("id", id).maybeSingle()).data,
  });
  const { data: myGroupIds = [] } = useQuery({
    queryKey: ["sd-my-group-ids", userId],
    queryFn: async () => ((await db.from("sd_group_members").select("group_id").eq("user_id", userId)).data || []).map((x: any) => x.group_id),
  });
  const { data: student } = useQuery({
    queryKey: ["sd-req-student", r?.organization_id, r?.requester_enrollment], enabled: r?.requester_kind === "aluno",
    queryFn: async () => (await db.from("sd_students").select("level, entry_date, current_deadline, advisor:sd_faculty(full_name), sd_programs(name)").eq("organization_id", r.organization_id).eq("enrollment", r.requester_enrollment).maybeSingle()).data,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["sd-req-versions", id],
    queryFn: async () => (await db.from("sd_request_versions").select("*").eq("request_id", id).order("cycle", { ascending: false }).order("created_at")).data || [],
  });

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!r) return <div className="p-6 text-center"><p className="text-muted-foreground">Solicitação não encontrada ou sem permissão.</p><Button variant="outline" className="mt-3" onClick={() => navigate(-1)}>Voltar</Button></div>;

  const steps: string[] = r.sd_services?.steps || [];
  const last = r.step_index >= steps.length - 1;
  const canAct = isOpen(r.status) && r.requester_user_id !== userId && (isAdminOf(r.organization_id) || (r.current_group_id && myGroupIds.includes(r.current_group_id)));
  const actions = !canAct ? [] : last ? [...(r.status !== "em_andamento" ? ["iniciar"] : []), "concluir", "recusar"] : ["aprovar", ...(formFields.length ? ["corrigir"] : []), "recusar"];

  const formFields: any[] = r.sd_services?.form_fields || [];
  const labelOf = (k: string) => formFields.find((f) => f.key === k)?.label || k;
  const isOwner = r.requester_user_id === userId;
  const fixing = isOwner && r.status === "correcao";
  const ed = edit ?? Object.fromEntries((r.correction_fields || []).map((k: string) => [k, r.form_data?.[k] || ""]));
  const cycles = Array.from(new Set(versions.map((v: any) => v.cycle))) as number[];

  const resubmit = async () => {
    setBusy(true);
    const { error } = await db.rpc("sd_resubmit_request", { _id: r.id, _form: ed });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Correção reenviada para análise");
    notify({ request_id: r.id, event: "reenviar" });
    setEdit(null);
    ["sd-req", "sd-req-events", "sd-req-versions", "sd-my-requests", "sd-notif"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const run = async () => {
    if (!act) return;
    setBusy(true);
    const { error } = act === "corrigir"
      ? await db.rpc("sd_request_correction", { _id: r.id, _fields: corrFields, _note: note })
      : await db.rpc("sd_advance_request", { _id: r.id, _action: act, _note: note || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação atualizada");
    notify({ request_id: r.id, event: act });
    setAct(null); setNote(""); setCorrFields([]);
    ["sd-req", "sd-queue", "sd-req-events", "sd-notif", "sd-req-versions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
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

      {r.status === "correcao" && (
        <Card className="rounded-xl border-destructive/50"><CardContent className="py-4 space-y-1 text-sm">
          <p className="font-semibold flex items-center gap-2 text-destructive"><AlertTriangle className="w-4 h-4" />Correção solicitada (#{r.correction_cycle})</p>
          <p className="text-xs text-muted-foreground">Por {r.correction_requested_by} em {r.correction_requested_at && fmtDT(r.correction_requested_at)} · Campo(s): {(r.correction_fields || []).map(labelOf).join(", ")}</p>
          <p className="whitespace-pre-line">{r.correction_note}</p>
        </CardContent></Card>
      )}

      {fixing && (
        <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Corrigir solicitação</CardTitle></CardHeader><CardContent className="space-y-3">
          {(r.correction_fields || []).map((k: string) => {
            const f = formFields.find((x) => x.key === k);
            return <div key={k}><Label>{labelOf(k)}</Label>
              {f?.type === "textarea" || !f ? <Textarea rows={4} maxLength={4000} value={ed[k] || ""} onChange={(e) => setEdit({ ...ed, [k]: e.target.value })} />
                : <Input maxLength={4000} value={ed[k] || ""} onChange={(e) => setEdit({ ...ed, [k]: e.target.value })} />}</div>;
          })}
          <p className="text-xs text-muted-foreground">Só os campos indicados podem ser alterados. Dados institucionais (nome, matrícula, programa, nível, ingresso, orientador, contrato e prazos) não mudam aqui: use "Informar divergência" em Meu cadastro.</p>
          <Button disabled={busy || (r.correction_fields || []).some((k: string) => (ed[k] || "").trim().length < 3)} onClick={resubmit}>Reenviar para análise</Button>
        </CardContent></Card>
      )}

      {!!formFields.length && (
        <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Informações do pedido</CardTitle></CardHeader><CardContent className="space-y-2">
          {formFields.map((f) => <div key={f.key}><p className="text-xs text-muted-foreground">{f.label}</p><p className="text-sm whitespace-pre-line">{r.form_data?.[f.key] || "—"}</p></div>)}
        </CardContent></Card>
      )}

      {!!cycles.length && (
        <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Correções</CardTitle></CardHeader><CardContent className="space-y-4">
          {cycles.map((c) => (
            <div key={c} className="space-y-2">
              <p className="text-sm font-semibold">Correção #{c}</p>
              {versions.filter((v: any) => v.cycle === c).map((v: any) => (
                <div key={v.id} className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div className="border rounded-lg p-2 bg-muted/30"><p className="text-xs text-muted-foreground">{labelOf(v.field)} — valor anterior</p><p className="whitespace-pre-line">{v.old_value || "—"}</p></div>
                  <div className="border rounded-lg p-2"><p className="text-xs text-muted-foreground">Valor corrigido · {fmtDT(v.created_at)}</p><p className="whitespace-pre-line">{v.new_value || "—"}</p></div>
                </div>
              ))}
            </div>
          ))}
        </CardContent></Card>
      )}

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
          {act === "corrigir" && (
            <div className="space-y-1"><Label>Campo(s) a corrigir</Label>
              {formFields.map((f) => <label key={f.key} className="flex items-center gap-2 text-sm"><Checkbox checked={corrFields.includes(f.key)} onCheckedChange={(v) => setCorrFields(v ? [...corrFields, f.key] : corrFields.filter((x) => x !== f.key))} />{f.label}</label>)}
            </div>
          )}
          <Label>{act === "recusar" ? "Motivo (obrigatório)" : act === "corrigir" ? "Motivo / orientação da correção (obrigatório)" : "Observação (opcional)"}</Label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setAct(null)}>Cancelar</Button><Button disabled={busy || ((act === "recusar" || act === "corrigir") && note.trim().length < 3) || (act === "corrigir" && !corrFields.length)} onClick={run}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestDetail;
