import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Inbox, RefreshCw, CalendarClock, AlertTriangle, History, Wrench, ShieldCheck, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SdShell, SdArea, KpiCard, FilteredRequests, RequestTable, Placeholder, isStale } from "./sd-ui";
import { isOpen, fmtDate } from "./sd-requests";

const db = supabase as any;

export type PanelKind = "approver" | "executor";
export interface SdGroup { id: string; code: string; name: string; organization_id: string }

/**
 * Painel de um grupo responsável. O tipo (análise/autorização ou execução) é derivado
 * da posição do grupo nas etapas dos serviços — nada é fixo por nome de grupo.
 */
const GroupPanel = ({ group, kind, userId, areas, onSignOut, canResolveDivergences }: {
  group: SdGroup; kind: PanelKind; userId: string; areas: SdArea[]; onSignOut: () => void; canResolveDivergences: boolean;
}) => {
  const base = `/servicedesk/${group.code.toLowerCase()}`;
  const { data: reqs = [] } = useQuery({
    queryKey: ["sd-queue", group.organization_id],
    queryFn: async () => (await db.from("sd_requests").select("*, sd_services(name, steps)").eq("organization_id", group.organization_id).order("created_at", { ascending: false })).data || [],
  });
  const { data: divs = [] } = useQuery({
    queryKey: ["sd-divs", group.organization_id], enabled: canResolveDivergences,
    queryFn: async () => (await db.from("sd_divergences").select("*").eq("organization_id", group.organization_id).order("created_at", { ascending: false })).data || [],
  });
  const { data: soon = [] } = useQuery({
    queryKey: ["sd-deadlines", group.organization_id], enabled: kind === "approver",
    queryFn: async () => {
      const lim = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      return (await db.from("sd_students").select("enrollment, full_name, level, current_deadline, sd_programs(sigla, name)").eq("organization_id", group.organization_id).eq("status", "ativo").gte("current_deadline", today).lte("current_deadline", lim).order("current_deadline")).data || [];
    },
  });

  const touched = reqs.filter((r: any) => r.current_group_id === group.id || (r.sd_services?.steps || []).includes(group.code));
  const mine = reqs.filter((r: any) => r.current_group_id === group.id && isOpen(r.status));
  const correcao = mine.filter((r: any) => r.status === "correcao");
  const waiting = mine.filter((r: any) => r.status !== "correcao");
  const awaitingRequester = reqs.filter((r: any) => r.status === "correcao" && r.correction_return_group_id === group.id);
  const received = waiting.filter((r: any) => r.correction_cycle > 0 && r.resubmitted_at);
  const closed = touched.filter((r: any) => !isOpen(r.status));
  const active = touched.filter((r: any) => r.status === "concluido");
  const openDivs = divs.filter((d: any) => d.status !== "resolvida");

  const nav = kind === "approver"
    ? [
        { to: base, label: "Dashboard", icon: LayoutDashboard },
        { to: `${base}/solicitacoes`, label: "Solicitações", icon: Inbox, count: waiting.length },
        { to: `${base}/prorrogacoes`, label: "Prorrogações", icon: RefreshCw },
        { to: `${base}/prazos`, label: "Prazos", icon: CalendarClock, count: soon.length },
        ...(canResolveDivergences ? [{ to: `${base}/divergencias`, label: "Divergências", icon: AlertTriangle, count: openDivs.length }] : []),
        { to: `${base}/historico`, label: "Histórico", icon: History },
      ]
    : [
        { to: base, label: "Dashboard", icon: LayoutDashboard },
        { to: `${base}/aguardando`, label: "Aguardando configuração", icon: Wrench, count: mine.length },
        { to: `${base}/ativos`, label: "Acessos ativos", icon: ShieldCheck },
        { to: `${base}/revogacoes`, label: "Revogações", icon: Ban },
        { to: `${base}/historico`, label: "Histórico", icon: History },
      ];

  const inbox = kind === "approver"
    ? [
        { tone: "alert", n: waiting.length, t: "solicitações aguardando você" },
        { tone: "warn", n: received.length, t: "correções recebidas para nova análise" },
        { tone: "muted", n: awaitingRequester.length, t: "aguardando solicitante" },
        { tone: "muted", n: openDivs.length, t: "divergências em aberto" },
      ]
    : [
        { tone: "alert", n: mine.length, t: "acessos para configurar" },
        { tone: "warn", n: 0, t: "acessos para revogar" },
        { tone: "muted", n: 0, t: "vencimentos próximos" },
      ];

  const Dashboard = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Painel {group.code}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kind === "approver" ? <>
          <KpiCard label="Aguardando análise" value={waiting.length} tone={waiting.length ? "alert" : "default"} />
          <KpiCard label="Aguardando solicitante" value={awaitingRequester.length} hint={received.length ? `${received.length} correção(ões) recebida(s)` : undefined} />
          <KpiCard label="Prorrogações" value="—" tone="muted" hint="Disponível na próxima etapa" />
          <KpiCard label="Prazos acadêmicos em 90 dias" value={soon.length} />
        </> : <>
          <KpiCard label="Aguardando configuração" value={mine.length} tone={mine.length ? "alert" : "default"} />
          <KpiCard label="Acessos ativos" value={active.length} />
          <KpiCard label="Vencem em breve" value="—" tone="muted" hint="Disponível na próxima etapa" />
          <KpiCard label="Revogações pendentes" value="—" tone="muted" hint="Disponível na próxima etapa" />
        </>}
      </div>
      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Minha caixa</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {inbox.map((i) => <p key={i.t} className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${i.tone === "alert" ? "bg-destructive" : i.tone === "warn" ? "bg-primary" : "bg-muted-foreground"}`} /><b>{i.n}</b> {i.t}</p>)}
          {mine.filter(isStale).length > 0 && <p className="text-destructive">{mine.filter(isStale).length} parada(s) há mais de 5 dias nesta etapa</p>}
        </CardContent>
      </Card>
      <div><h2 className="font-semibold mb-2">Aguardando {group.code}</h2><RequestTable rows={mine.slice(0, 8)} empty={`Nada aguardando ${group.code}.`} /></div>
    </div>
  );

  return (
    <SdShell title={`Painel ${group.code}`} subtitle={group.name} userId={userId} areas={areas} nav={nav} onSignOut={onSignOut}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="solicitacoes" element={<><h1 className="text-2xl font-bold font-heading">Solicitações</h1><FilteredRequests rows={mine} empty={`Nada aguardando ${group.code}.`} />
          <h2 className="font-semibold mt-6">Aguardando solicitante</h2><RequestTable rows={awaitingRequester} empty="Nenhuma solicitação aguardando correção." /></>} />
        <Route path="aguardando" element={<><h1 className="text-2xl font-bold font-heading">Aguardando configuração</h1><FilteredRequests rows={mine} empty="Nada para configurar." /></>} />
        <Route path="ativos" element={<><h1 className="text-2xl font-bold font-heading">Acessos ativos</h1><FilteredRequests rows={active} empty="Nenhum acesso ativo." /></>} />
        <Route path="prorrogacoes" element={<Placeholder title="Prorrogações" text="Os pedidos de prorrogação aparecerão aqui quando o fluxo da VPN for ativado." />} />
        <Route path="revogacoes" element={<Placeholder title="Revogações pendentes" text="Acessos vencidos ou encerrados aparecerão aqui para revogação, com confirmação de remoção do acesso." />} />
        <Route path="prazos" element={
          <><h1 className="text-2xl font-bold font-heading">Prazos acadêmicos nos próximos 90 dias</h1>
            {!soon.length ? <p className="text-sm text-muted-foreground">Nenhum prazo próximo.</p> : (
              <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Matrícula</th><th className="p-2">Nome</th><th className="p-2">Programa</th><th className="p-2">Nível</th><th className="p-2">Prazo vigente</th></tr></thead>
                <tbody>{soon.map((s: any) => <tr key={s.enrollment} className="border-t"><td className="p-2">{s.enrollment}</td><td className="p-2">{s.full_name}</td><td className="p-2">{s.sd_programs?.sigla || s.sd_programs?.name}</td><td className="p-2 capitalize">{s.level}</td><td className="p-2">{fmtDate(s.current_deadline)}</td></tr>)}</tbody>
              </table></div>
            )}</>
        } />
        <Route path="divergencias" element={<Divergences divs={divs} orgId={group.organization_id} />} />
        <Route path="historico" element={<><h1 className="text-2xl font-bold font-heading">Histórico</h1><FilteredRequests rows={closed} empty="Nada no histórico." /></>} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </SdShell>
  );
};

export const Divergences = ({ divs, orgId }: { divs: any[]; orgId: string }) => {
  const [sel, setSel] = useState<any>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { refetch } = useQuery({ queryKey: ["sd-divs", orgId], enabled: false, queryFn: async () => [] });
  const resolve = async () => {
    setBusy(true);
    const { error } = await db.rpc("sd_resolve_divergence", { _id: sel.id, _note: note || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Divergência resolvida");
    setSel(null); setNote(""); refetch();
  };
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold font-heading">Divergências informadas</h1>
      {!divs.length && <p className="text-sm text-muted-foreground">Nenhuma divergência informada.</p>}
      {divs.map((d: any) => (
        <Card key={d.id} className="rounded-xl"><CardContent className="py-3 space-y-1 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{d.person_name} · {d.enrollment} ({d.person_kind})</span><Badge variant={d.status === "resolvida" ? "secondary" : "outline"}>{d.status === "resolvida" ? "Resolvida" : "Aberta"}</Badge></div>
          <p><span className="text-muted-foreground">{d.field}:</span> {d.description}</p>
          <p className="text-xs text-muted-foreground">Informada em {fmtDate(d.created_at)}{d.resolution_note ? ` · Resolução: ${d.resolution_note}` : ""}</p>
          {d.status !== "resolvida" && <Button size="sm" variant="outline" onClick={() => setSel(d)}>Marcar como resolvida</Button>}
        </CardContent></Card>
      ))}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolver divergência</DialogTitle></DialogHeader>
          <Textarea rows={3} placeholder="O que foi feito (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setSel(null)}>Cancelar</Button><Button disabled={busy} onClick={resolve}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupPanel;
