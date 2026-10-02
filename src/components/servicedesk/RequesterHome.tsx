import { useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, ShieldCheck, Mail, AlertTriangle, ClipboardList, Users, Home, Bell, UserCircle } from "lucide-react";
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
import { StatusBadge, notify, isOpen, fmtDate as fmt, fmtDT } from "./sd-requests";
import { SdShell, SdArea, KpiCard, useSdNotifications } from "./sd-ui";

const db = supabase as any;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const useRequester = (userId?: string) =>
  useQuery({
    queryKey: ["sd-requester", userId], enabled: !!userId,
    queryFn: async () => {
      const { data: st } = await db.from("sd_students").select("*, sd_programs(name, sigla), advisor:sd_faculty(full_name)").eq("user_id", userId).maybeSingle();
      if (st) return { kind: "aluno" as const, row: st };
      const { data: fa } = await db.from("sd_faculty").select("*, sd_faculty_programs(relationship_type, sd_programs(name, sigla))").eq("user_id", userId).maybeSingle();
      if (fa) return { kind: "professor" as const, row: fa };
      return null;
    },
  });

interface Props { userId: string; onSignOut: () => void; noAccessMessage: string; areas?: SdArea[] }

const BASE = "/servicedesk/portal";

/** Portal do Solicitante: uma única experiência para aluno e professor, adaptada ao vínculo. */
const RequesterHome = ({ userId, onSignOut, noAccessMessage, areas = [] }: Props) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useRequester(userId);
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
  const { data: notifs } = useSdNotifications(userId);

  const [service, setService] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
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
  const progs = (r.sd_faculty_programs || []).map((p: any) => `${p.sd_programs?.sigla || p.sd_programs?.name}${p.relationship_type ? " · " + p.relationship_type : ""}`).join(", ");

  const fields: [string, string][] = isStudent
    ? [
        ["Nome", r.full_name], ["Matrícula", r.enrollment], ["Programa", r.sd_programs?.name || "-"],
        ["Nível", r.level || "-"], ["Turma", r.turma || "-"], ["Ingresso", fmt(r.entry_date)],
        ["Orientador(a)", r.advisor?.full_name || "-"], ["Prazo regular", fmt(r.regular_deadline)],
        ["Prazo vigente", fmt(r.current_deadline)], ["Situação", r.status || "-"],
      ]
    : [
        ["Nome", r.full_name], ["Matrícula", r.enrollment], ["Tipo de contrato", r.contract_type || "-"],
        ["Programas", progs || "-"], ["Situação do vínculo", r.status || "-"],
        ...(r.bond_deadline ? [["Prazo do vínculo", fmt(r.bond_deadline)] as [string, string]] : []),
      ];

  const openReqs = (requests || []).filter((q: any) => isOpen(q.status));
  const pendencias: { text: string; tone: "alert" | "warn" }[] = [
    ...(!c.email ? [{ text: "Informe seu e-mail pessoal em Meu cadastro.", tone: "alert" as const }] : []),
    ...(!r.phone ? [{ text: "Informe seu celular com WhatsApp em Meu cadastro.", tone: "alert" as const }] : []),
    ...(suspended ? [{ text: "Seu acesso a novas solicitações está suspenso. Fale com a secretaria do programa.", tone: "warn" as const }] : []),
  ];
  const unread = (notifs || []).filter((n: any) => !n.read_at).length;

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
    const { data: id, error } = await db.rpc("sd_create_request", { _service_id: service.id, _terms_hash: hash, _form: form });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada");
    notify({ request_id: id, event: "criada" });
    setService(null); setAccepted(false); setForm({});
    qc.invalidateQueries({ queryKey: ["sd-my-requests", userId] });
    qc.invalidateQueries({ queryKey: ["sd-notif", userId] });
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

  const ServicesList = () => (
    <div className="space-y-2">
      {!services?.length && <p className="text-sm text-muted-foreground">Nenhum serviço disponível.</p>}
      {services?.map((s: any) => {
        const open = requests?.some((q: any) => q.service_id === s.id && isOpen(q.status));
        return (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
            <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.description}</p></div>
            <Button size="sm" disabled={suspended || open} onClick={() => { setService(s); setAccepted(false); setForm({}); }}>{open ? "Pedido em aberto" : "Solicitar"}</Button>
          </div>
        );
      })}
    </div>
  );

  const actionNeeded = (requests || []).filter((q: any) => q.status === "correcao");
  const ActionNeeded = () => !actionNeeded.length ? null : (
    <div className="space-y-2">
      {actionNeeded.map((q: any) => (
        <div key={q.id} className="border border-destructive/50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <p className="font-semibold text-destructive">Ação necessária</p>
            <p className="font-medium">{q.sd_services?.name} · {q.protocol}</p>
            <p className="text-xs text-muted-foreground">Correção #{q.correction_cycle} pedida por {q.correction_requested_by} em {fmt(q.correction_requested_at)}</p>
            <p className="text-xs mt-1 line-clamp-2">{q.correction_note}</p>
          </div>
          <Button size="sm" asChild><Link to={`/servicedesk/solicitacao/${q.id}`}>Corrigir solicitação</Link></Button>
        </div>
      ))}
    </div>
  );

  const RequestsList = ({ rows }: { rows: any[] }) => (
    <div className="space-y-2">
      {!rows.length && <p className="text-sm text-muted-foreground">Você ainda não fez solicitações.</p>}
      {rows.map((q: any) => (
        <div key={q.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{q.sd_services?.name}</p>
            <p className="text-xs text-muted-foreground">Protocolo {q.protocol} · enviada em {fmt(q.created_at)}{q.sd_groups && isOpen(q.status) ? ` · com ${q.sd_groups.code}` : ""}</p>
          </div>
          <div className="flex items-center gap-2"><StatusBadge status={q.status} /><Button size="sm" variant="outline" asChild><Link to={`/servicedesk/solicitacao/${q.id}`}>Acompanhar</Link></Button></div>
        </div>
      ))}
    </div>
  );

  const nav = [
    { to: `${BASE}`, label: "Início", icon: Home },
    { to: `${BASE}/servicos`, label: "Serviços", icon: ShieldCheck },
    { to: `${BASE}/solicitacoes`, label: "Minhas solicitações", icon: ClipboardList, count: openReqs.length },
    { to: `${BASE}/notificacoes`, label: "Notificações", icon: Bell, count: unread },
    { to: `${BASE}/cadastro`, label: "Meu cadastro", icon: UserCircle },
  ];
  const first = r.full_name?.split(" ")[0];
  const subtitle = isStudent ? `${r.level ? r.level[0].toUpperCase() + r.level.slice(1) : ""} em ${r.sd_programs?.name || "-"} · Matrícula ${r.enrollment}` : `Vínculo: ${r.contract_type || "-"} · Situação: ${r.status} · Matrícula ${r.enrollment}`;

  return (
    <SdShell title="Meu Service Desk" subtitle={isStudent ? "Área do aluno" : "Área do professor"} userId={userId} areas={areas} nav={nav} onSignOut={onSignOut}>
      <Routes>
        <Route index element={
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold font-heading">Olá, {isStudent ? "" : "Professor(a) "}{first}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button className="text-left" onClick={() => navigate(`${BASE}/solicitacoes`)}><KpiCard label="Minhas solicitações em aberto" value={openReqs.length} /></button>
              <button className="text-left" onClick={() => navigate(`${BASE}/servicos`)}><KpiCard label="Serviços disponíveis" value={services?.length || 0} /></button>
              <KpiCard label="Pendências" value={pendencias.length} tone={pendencias.length ? "alert" : "default"} />
              <button className="text-left" onClick={() => navigate(`${BASE}/notificacoes`)}><KpiCard label="Notificações não lidas" value={unread} /></button>
            </div>
            <ActionNeeded />
            {!!pendencias.length && (
              <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Minha caixa</CardTitle></CardHeader><CardContent className="space-y-1">
                {pendencias.map((p, i) => <p key={i} className="text-sm flex gap-2"><AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${p.tone === "alert" ? "text-destructive" : "text-muted-foreground"}`} />{p.text}</p>)}
              </CardContent></Card>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Serviços disponíveis</CardTitle></CardHeader><CardContent><ServicesList /></CardContent></Card>
              <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Solicitações recentes</CardTitle></CardHeader><CardContent><RequestsList rows={(requests || []).slice(0, 3)} /></CardContent></Card>
            </div>
            <Card className="rounded-xl"><CardHeader><CardTitle className="text-base">Prazos</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
              {isStudent ? <><p>Prazo regular: <b>{fmt(r.regular_deadline)}</b></p><p>Prazo vigente: <b>{fmt(r.current_deadline)}</b></p></> : <p>Prazo do vínculo: <b>{r.contract_type === "CLT" ? "Indeterminado" : fmt(r.bond_deadline)}</b></p>}
              <p className="text-xs text-muted-foreground">A validade de acessos (como a VPN) aparecerá aqui quando estiverem ativos.</p>
            </CardContent></Card>
          </div>
        } />
        <Route path="servicos" element={<><h1 className="text-2xl font-bold font-heading">Serviços</h1><ServicesList /></>} />
        <Route path="solicitacoes" element={<><h1 className="text-2xl font-bold font-heading">Minhas solicitações</h1><ActionNeeded /><RequestsList rows={requests || []} /></>} />
        <Route path="notificacoes" element={
          <><h1 className="text-2xl font-bold font-heading">Notificações</h1>
            <div className="space-y-2">{!notifs?.length && <p className="text-sm text-muted-foreground">Nenhuma notificação.</p>}
              {notifs?.map((n: any) => (
                <div key={n.id} className={`border rounded-lg p-3 ${n.read_at ? "" : "bg-muted/40"}`}>
                  <p className="text-sm font-medium">{n.title}</p>{n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}<p className="text-[11px] text-muted-foreground">{fmtDT(n.created_at)}</p>
                </div>
              ))}</div></>
        } />
        <Route path="cadastro" element={
          <div className="space-y-4">
            <h1 className="text-2xl font-bold font-heading">Meu cadastro</h1>
            <Card className="rounded-xl">
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">Dados institucionais</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setDivOpen(true)}><AlertTriangle className="w-4 h-4 mr-1" />Informar divergência</Button>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fields.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm font-medium">{v || "-"}</dd></div>)}
                </dl>
                <p className="text-xs text-muted-foreground mt-4">Estes dados vêm da base oficial da instituição e não podem ser editados aqui. Se algo estiver errado, use "Informar divergência".</p>
                {!!divergences?.length && (
                  <div className="mt-3 space-y-1">
                    {divergences.map((d: any) => (
                      <div key={d.id} className="text-xs flex flex-wrap gap-2 items-center">
                        <Badge variant={d.status === "resolvida" ? "secondary" : "outline"}>{d.status === "resolvida" ? "Resolvida" : "Em revisão"}</Badge>
                        <span>{d.field}: {d.description}</span>
                        {d.resolution_note && <span className="text-muted-foreground">- {d.resolution_note}</span>}
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
        } />
        <Route path="*" element={<Navigate to={BASE} replace />} />
      </Routes>

      <Dialog open={!!service} onOpenChange={(o) => !o && setService(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{service?.name}</DialogTitle></DialogHeader>
          {(service?.form_fields || []).map((f: any) => (
            <div key={f.key}><Label>{f.label}{f.required ? " *" : ""}</Label>
              {f.type === "textarea" ? <Textarea rows={3} maxLength={4000} value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : <Input maxLength={4000} value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </div>
          ))}
          <div className="text-sm whitespace-pre-line border rounded-lg p-3 max-h-64 overflow-y-auto bg-muted/30">{service?.terms_text}</div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} />Li e aceito o termo de uso.</label>
          <DialogFooter><Button variant="outline" onClick={() => setService(null)}>Cancelar</Button><Button disabled={!accepted || busy || (service?.form_fields || []).some((f: any) => f.required && (form[f.key] || "").trim().length < 3)} onClick={sendRequest}>Enviar solicitação</Button></DialogFooter>
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
            <p className="text-xs text-muted-foreground">A equipe responsável vai revisar. Seus dados só mudam depois da correção na base oficial.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDivOpen(false)}>Cancelar</Button><Button disabled={!divField || divText.trim().length < 5 || busy} onClick={sendDivergence}>Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SdShell>
  );
};

export default RequesterHome;
