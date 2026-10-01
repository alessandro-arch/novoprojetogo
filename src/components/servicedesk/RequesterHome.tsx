import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, ShieldCheck, Mail, AlertTriangle, ClipboardList, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { STATUS_LABEL, statusVariant, notify, RequestTimeline } from "./sd-requests";

const db = supabase as any;
const fmt = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Props { userId: string; onSignOut: () => void; noAccessMessage: string }

const RequesterHome = ({ userId, onSignOut, noAccessMessage }: Props) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sd-requester", userId],
    queryFn: async () => {
      const { data: st } = await db.from("sd_students").select("*, sd_programs(name, sigla), advisor:sd_faculty(full_name)").eq("user_id", userId).maybeSingle();
      if (st) return { kind: "aluno" as const, row: st };
      const { data: fa } = await db.from("sd_faculty").select("*, sd_faculty_programs(relationship_type, sd_programs(name, sigla))").eq("user_id", userId).maybeSingle();
      if (fa) return { kind: "professor" as const, row: fa };
      return null;
    },
  });
  const orgId = data?.row?.organization_id;

  const { data: services } = useQuery({
    queryKey: ["sd-services", orgId], enabled: !!orgId,
    queryFn: async () => (await db.from("sd_services").select("*").eq("organization_id", orgId).eq("is_active", true).order("name")).data || [],
  });
  const { data: requests } = useQuery({
    queryKey: ["sd-my-requests", userId], enabled: !!data,
    queryFn: async () => (await db.from("sd_requests").select("*, sd_services(name), sd_groups(code, name)").eq("requester_user_id", userId).order("created_at", { ascending: false })).data || [],
  });
  const { data: divergences } = useQuery({
    queryKey: ["sd-my-div", userId], enabled: !!data,
    queryFn: async () => (await db.from("sd_divergences").select("*").eq("user_id", userId).order("created_at", { ascending: false })).data || [],
  });
  const { data: advisees } = useQuery({
    queryKey: ["sd-advisees", data?.row?.id], enabled: data?.kind === "professor",
    queryFn: async () => (await db.from("sd_students").select("enrollment, full_name, level, status, current_deadline, sd_programs(sigla, name)").eq("advisor_id", data!.row.id).order("full_name")).data || [],
  });

  const [service, setService] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [divOpen, setDivOpen] = useState(false);
  const [divField, setDivField] = useState("");
  const [divText, setDivText] = useState("");
  const [contact, setContact] = useState<{ email: string; phone: string } | null>(null);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold font-heading">Service Desk Acadêmico</h1>
        <p className="text-muted-foreground mt-2">{noAccessMessage}</p>
        <Button variant="outline" className="mt-4" onClick={onSignOut}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
      </div>
    </div>
  );

  const r = data.row;
  const isStudent = data.kind === "aluno";
  const suspended = isStudent ? (r.status === "trancado" || !r.service_desk_access_active) : r.status !== "ativo";
  const currentEmail = isStudent ? r.email : r.personal_email;
  const c = contact ?? { email: currentEmail || "", phone: r.phone || "" };

  const fields: [string, string][] = isStudent
    ? [
        ["Matrícula", r.enrollment], ["Nome", r.full_name], ["Programa", r.sd_programs?.name || "—"],
        ["Nível", r.level || "—"], ["Turma", r.turma || "—"], ["Ingresso", fmt(r.entry_date)],
        ["Orientador(a)", r.advisor?.full_name || "—"], ["Prazo regular", fmt(r.regular_deadline)],
        ["Prazo vigente", fmt(r.current_deadline)], ["Situação", r.status || "—"],
      ]
    : [
        ["Matrícula", r.enrollment], ["Nome", r.full_name], ["Tipo de vínculo", r.contract_type || "—"],
        ["Programas", (r.sd_faculty_programs || []).map((p: any) => `${p.sd_programs?.sigla || p.sd_programs?.name}${p.relationship_type ? " · " + p.relationship_type : ""}`).join(", ") || "—"],
        ["Situação", r.status || "—"],
      ];

  const saveContact = async () => {
    setBusy(true);
    const { error } = await db.rpc("sd_update_my_contact", { _email: c.email || null, _phone: c.phone || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contato atualizado");
    setContact(null);
    qc.invalidateQueries({ queryKey: ["sd-requester", userId] });
  };

  const sendRequest = async () => {
    if (!service || !accepted) return;
    setBusy(true);
    const stamp = new Date().toISOString();
    const hash = await sha256(`${service.terms_text}|${userId}|${r.enrollment}|${stamp}`);
    const { data: id, error } = await db.rpc("sd_create_request", { _service_id: service.id, _terms_hash: hash });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada");
    notify({ request_id: id, event: "criada" });
    setService(null); setAccepted(false);
    qc.invalidateQueries({ queryKey: ["sd-my-requests", userId] });
  };

  const sendDivergence = async () => {
    setBusy(true);
    const { error } = await db.rpc("sd_report_divergence", { _field: divField, _description: divText });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Divergência enviada para revisão");
    setDivOpen(false); setDivField(""); setDivText("");
    qc.invalidateQueries({ queryKey: ["sd-my-div", userId] });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-heading">Service Desk Acadêmico</h1>
            <p className="text-sm text-muted-foreground">Olá, {r.full_name?.split(" ")[0]} — área do {isStudent ? "aluno" : "professor"}</p>
          </div>
          <Button variant="outline" onClick={onSignOut}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
        </div>

        {suspended && (
          <Card className="rounded-xl border-destructive/50">
            <CardContent className="py-4 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />Seu acesso a novas solicitações está suspenso. Fale com a secretaria do programa.</CardContent>
          </Card>
        )}

        <Card className="rounded-xl">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Meus dados institucionais</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setDivOpen(true)}><AlertTriangle className="w-4 h-4 mr-1" />Informar divergência</Button>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm font-medium">{v || "—"}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground mt-4">Estes dados vêm da base oficial da instituição. Se algo estiver errado, use "Informar divergência".</p>
            {!!divergences?.length && (
              <div className="mt-3 space-y-1">
                {divergences.map((d: any) => (
                  <div key={d.id} className="text-xs flex flex-wrap gap-2 items-center">
                    <Badge variant={d.status === "resolvida" ? "secondary" : "outline"}>{d.status === "resolvida" ? "Resolvida" : "Em revisão"}</Badge>
                    <span>{d.field}: {d.description}</span>
                    {d.resolution_note && <span className="text-muted-foreground">— {d.resolution_note}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />Meu contato</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div><Label>E-mail pessoal</Label><Input type="email" value={c.email} onChange={(e) => setContact({ ...c, email: e.target.value })} /></div>
            <div><Label>Celular com WhatsApp</Label><Input value={c.phone} placeholder="(27) 99999-9999" onChange={(e) => setContact({ ...c, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Button onClick={saveContact} disabled={busy || !contact}>Salvar contato</Button></div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Serviços disponíveis</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!services?.length && <p className="text-sm text-muted-foreground">Nenhum serviço disponível.</p>}
            {services?.map((s: any) => {
              const open = requests?.some((q: any) => q.service_id === s.id && ["em_analise", "aprovado", "em_andamento"].includes(q.status));
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
                  <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.description}</p></div>
                  <Button size="sm" disabled={suspended || open} onClick={() => { setService(s); setAccepted(false); }}>{open ? "Pedido em aberto" : "Solicitar"}</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4" />Minhas solicitações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!requests?.length && <p className="text-sm text-muted-foreground">Você ainda não fez solicitações.</p>}
            {requests?.map((q: any) => (
              <div key={q.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm">{q.sd_services?.name}</p>
                  <Badge variant={statusVariant(q.status)}>{STATUS_LABEL[q.status] || q.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Enviada em {fmt(q.created_at)}{q.sd_groups && !["concluido", "recusado"].includes(q.status) ? ` · com ${q.sd_groups.code}` : ""}</p>
                <RequestTimeline requestId={q.id} />
              </div>
            ))}
          </CardContent>
        </Card>

        {!isStudent && (
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Meus orientandos</CardTitle></CardHeader>
            <CardContent>
              {!advisees?.length ? <p className="text-sm text-muted-foreground">Nenhum orientando na base.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-2">Matrícula</th><th className="pr-2">Nome</th><th className="pr-2">Programa</th><th className="pr-2">Nível</th><th className="pr-2">Prazo vigente</th><th>Situação</th></tr></thead>
                  <tbody>{advisees.map((a: any) => (
                    <tr key={a.enrollment} className="border-t"><td className="py-1 pr-2">{a.enrollment}</td><td className="pr-2">{a.full_name}</td><td className="pr-2">{a.sd_programs?.sigla || a.sd_programs?.name}</td><td className="pr-2 capitalize">{a.level}</td><td className="pr-2">{fmt(a.current_deadline)}</td><td>{a.status}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!service} onOpenChange={(o) => !o && setService(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{service?.name}</DialogTitle></DialogHeader>
          <div className="text-sm whitespace-pre-line border rounded-lg p-3 max-h-64 overflow-y-auto bg-muted/30">{service?.terms_text}</div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} />Li e aceito o termo de uso.</label>
          <DialogFooter><Button variant="outline" onClick={() => setService(null)}>Cancelar</Button><Button disabled={!accepted || busy} onClick={sendRequest}>Enviar solicitação</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={divOpen} onOpenChange={setDivOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Informar divergência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Qual dado está incorreto?</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={divField} onChange={(e) => setDivField(e.target.value)}>
                <option value="">Selecione</option>
                {fields.map(([k]) => <option key={k} value={k}>{k}</option>)}
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div><Label>Explique o que está errado e qual seria o correto</Label><Textarea rows={4} value={divText} onChange={(e) => setDivText(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">A PRPPGE vai revisar. Seus dados só mudam depois da correção na base oficial.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDivOpen(false)}>Cancelar</Button><Button disabled={!divField || divText.trim().length < 5 || busy} onClick={sendDivergence}>Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequesterHome;
