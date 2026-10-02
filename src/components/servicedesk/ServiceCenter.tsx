import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Inbox, ListChecks, CalendarClock, AlertTriangle, History, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SdShell, SdArea, KpiCard, FilteredRequests, RequestTable, isStale } from "./sd-ui";
import { isOpen, fmtDate } from "./sd-requests";

const db = supabase as any;

export type PanelKind = "approver" | "executor";
export interface SdGroup { id: string; code: string; name: string; organization_id: string }

const BASE = "/servicedesk/atendimento";
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/**
 * Central de Atendimento: uma única estrutura operacional para todos os grupos responsáveis.
 * Indicadores e módulos vêm do papel do grupo nas etapas dos serviços (análise vs execução) — nunca do nome do grupo.
 */
const ServiceCenter = ({ groups, kindOf, userId, areas, onSignOut, canResolveDivergences }: {
  groups: SdGroup[]; kindOf: (g: SdGroup) => PanelKind; userId: string; areas: SdArea[]; onSignOut: () => void; canResolveDivergences: (g: SdGroup) => boolean;
}) => {
  const [params, setParams] = useSearchParams();
  const wanted = (params.get("grupo") || "").toLowerCase();
  const ctx = groups.filter((g) => !wanted || g.code.toLowerCase() === wanted);
  const active = ctx.length ? ctx : groups;
  const ids = active.map((g) => g.id);
  const codes = active.map((g) => g.code);
  const orgIds = Array.from(new Set(active.map((g) => g.organization_id)));
  const isApprover = active.some((g) => kindOf(g) === "approver");
  const isExecutor = active.some((g) => kindOf(g) === "executor");
  const canDiv = active.some(canResolveDivergences);
  const q = (p: string) => (wanted ? `${p}?grupo=${wanted}` : p);

  const { data: reqs = [] } = useQuery({
    queryKey: ["sd-queue", orgIds.join(",")], enabled: orgIds.length > 0,
    queryFn: async () => (await db.from("sd_requests").select("*, sd_services(name, steps)").in("organization_id", orgIds).order("created_at", { ascending: false })).data || [],
  });
  const { data: divs = [] } = useQuery({
    queryKey: ["sd-divs", orgIds.join(",")], enabled: canDiv && orgIds.length > 0,
    queryFn: async () => (await db.from("sd_divergences").select("*").in("organization_id", orgIds).order("created_at", { ascending: false })).data || [],
  });
  const { data: soon = [] } = useQuery({
    queryKey: ["sd-deadlines", orgIds.join(",")], enabled: isApprover && orgIds.length > 0,
    queryFn: async () => (await db.from("sd_students").select("enrollment, full_name, level, current_deadline, sd_programs(sigla, name)").in("organization_id", orgIds).eq("status", "ativo").gte("current_deadline", today()).lte("current_deadline", plusDays(90)).order("current_deadline")).data || [],
  });
  const { data: expiryDays = 7 } = useQuery({
    queryKey: ["sd-vpn-expiry", orgIds.join(",")], enabled: isExecutor && orgIds.length > 0,
    queryFn: async () => {
      const { data } = await db.from("sd_settings").select("value").in("organization_id", orgIds).eq("key", "alert_days").limit(1).maybeSingle();
      return Number(data?.value?.vpn_expiry) || 7;
    },
  });

  const touched = reqs.filter((r: any) => ids.includes(r.current_group_id) || (r.sd_services?.steps || []).some((c: string) => codes.includes(c)));
  const mine = reqs.filter((r: any) => ids.includes(r.current_group_id) && isOpen(r.status));
  const waiting = mine.filter((r: any) => r.status !== "correcao");
  const awaitingRequester = reqs.filter((r: any) => r.status === "correcao" && ids.includes(r.correction_return_group_id));
  const received = waiting.filter((r: any) => r.correction_cycle > 0 && r.resubmitted_at);
  const closed = touched.filter((r: any) => !isOpen(r.status));
  const analysis = waiting.filter((r: any) => r.step_index === 0);
  const toConfigure = waiting.filter((r: any) => r.step_index > 0);
  const vpnActive = touched.filter((r: any) => r.vpn_status === "ativo");
  const expiring = vpnActive.filter((r: any) => r.vpn_valid_until && r.vpn_valid_until >= today() && r.vpn_valid_until <= plusDays(expiryDays));
  const toRevoke = vpnActive.filter((r: any) => r.vpn_valid_until && r.vpn_valid_until < today());
  const openDivs = divs.filter((d: any) => d.status !== "resolvida");

  const nav = [
    { to: q(BASE), label: "Dashboard", icon: LayoutDashboard },
    { to: q(`${BASE}/caixa`), label: "Minha Caixa", icon: Inbox, count: waiting.length },
    { to: q(`${BASE}/solicitacoes`), label: "Solicitações", icon: ListChecks },
    { to: q(`${BASE}/prazos`), label: "Prazos", icon: CalendarClock, count: (isApprover ? soon.length : 0) + (isExecutor ? expiring.length : 0) },
    { to: q(`${BASE}/historico`), label: "Histórico", icon: History },
    ...(isExecutor ? [{ to: q(`${BASE}/vpn`), label: "Acessos VPN", icon: ShieldCheck, count: toRevoke.length }] : []),
    ...(canDiv ? [{ to: q(`${BASE}/divergencias`), label: "Divergências", icon: AlertTriangle, count: openDivs.length }] : []),
  ];

  const kpis = [
    ...(isApprover ? [
      { label: "Aguardando análise", value: analysis.length, tone: analysis.length ? "alert" : "default" },
      { label: "Correções pendentes", value: awaitingRequester.length, hint: received.length ? `${received.length} correção(ões) recebida(s)` : undefined },
      { label: "Prorrogações", value: "-", tone: "muted", hint: "Disponível na próxima etapa" },
      { label: "Prazos acadêmicos em 90 dias", value: soon.length },
    ] : []),
    ...(isExecutor ? [
      { label: "Aguardando configuração", value: toConfigure.length, tone: toConfigure.length ? "alert" : "default" },
      { label: "Acessos ativos", value: vpnActive.length },
      { label: `Vencem em ${expiryDays} dias`, value: expiring.length },
      { label: "Revogações pendentes", value: toRevoke.length, tone: toRevoke.length ? "alert" : "default" },
    ] : []),
  ] as { label: string; value: number | string; tone?: any; hint?: string }[];

  const ctxLabel = active.length === 1 ? `${active[0].code} · ${active[0].name}` : "Todos os meus grupos";

  const Dashboard = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} tone={k.tone} hint={k.hint} />)}</div>
      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Minha Caixa</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {isApprover && <p><b>{analysis.length}</b> aguardando análise · <b>{received.length}</b> correções recebidas · <b>{awaitingRequester.length}</b> aguardando solicitante</p>}
          {isExecutor && <p><b>{toConfigure.length}</b> acessos para configurar · <b>{toRevoke.length}</b> para revogar · <b>{expiring.length}</b> vencendo</p>}
          {mine.filter(isStale).length > 0 && <p className="text-destructive">{mine.filter(isStale).length} parada(s) há mais de 5 dias nesta etapa</p>}
        </CardContent>
      </Card>
      <div><h2 className="font-semibold mb-2">Aguardando minha equipe</h2><RequestTable rows={waiting.slice(0, 8)} empty="Nada aguardando sua equipe." /></div>
    </div>
  );

  const VpnTable = ({ rows, empty }: { rows: any[]; empty: string }) => !rows.length ? <p className="text-sm text-muted-foreground">{empty}</p> : (
    <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm">
      <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{["Solicitante", "Matrícula", "Protocolo", "Programa", "Liberação", "Validade", "IP", "Situação"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r: any) => {
        const st = r.vpn_valid_until && r.vpn_valid_until < today() ? "Revogação pendente" : r.vpn_valid_until && r.vpn_valid_until <= plusDays(expiryDays) ? "Vence em breve" : "Ativo";
        return <tr key={r.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => window.location.assign(`/servicedesk/solicitacao/${r.id}`)}>
          <td className="p-2">{r.requester_name}</td><td className="p-2">{r.requester_enrollment}</td><td className="p-2 font-mono text-xs">{r.protocol}</td><td className="p-2">{r.requester_program || "-"}</td>
          <td className="p-2">{fmtDate(r.vpn_released_at)}</td><td className="p-2">{fmtDate(r.vpn_valid_until)}</td><td className="p-2">{r.vpn_ip || "-"}</td>
          <td className="p-2"><Badge variant={st === "Ativo" ? "secondary" : st === "Vence em breve" ? "outline" : "destructive"}>{st}</Badge></td></tr>;
      })}</tbody>
    </table></div>
  );

  return (
    <SdShell title="Central de Atendimento" subtitle={ctxLabel} userId={userId} areas={areas} nav={nav} onSignOut={onSignOut}>
      {groups.length > 1 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Contexto:</span>
          <select aria-label="Grupo" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={wanted} onChange={(e) => setParams(e.target.value ? { grupo: e.target.value } : {})}>
            <option value="">Todos os meus grupos</option>
            {groups.map((g) => <option key={g.id} value={g.code.toLowerCase()}>{g.code} · {g.name}</option>)}
          </select>
        </div>
      )}
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="caixa" element={<><h1 className="text-2xl font-bold font-heading">Minha Caixa</h1><FilteredRequests rows={waiting} empty="Nada aguardando sua equipe." />
          <h2 className="font-semibold mt-6">Aguardando solicitante</h2><RequestTable rows={awaitingRequester} empty="Nenhuma solicitação aguardando correção." /></>} />
        <Route path="solicitacoes" element={<><h1 className="text-2xl font-bold font-heading">Solicitações</h1><FilteredRequests rows={touched} empty="Nenhuma solicitação." /></>} />
        <Route path="prazos" element={
          <div className="space-y-6">
            {isApprover && <div><h1 className="text-2xl font-bold font-heading mb-2">Prazos acadêmicos nos próximos 90 dias</h1>
              {!soon.length ? <p className="text-sm text-muted-foreground">Nenhum prazo próximo.</p> : (
                <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Matrícula</th><th className="p-2">Nome</th><th className="p-2">Programa</th><th className="p-2">Nível</th><th className="p-2">Prazo vigente</th></tr></thead>
                  <tbody>{soon.map((s: any) => <tr key={s.enrollment} className="border-t"><td className="p-2">{s.enrollment}</td><td className="p-2">{s.full_name}</td><td className="p-2">{s.sd_programs?.sigla || s.sd_programs?.name}</td><td className="p-2 capitalize">{s.level}</td><td className="p-2">{fmtDate(s.current_deadline)}</td></tr>)}</tbody>
                </table></div>)}</div>}
            {isExecutor && <div><h2 className="text-xl font-bold font-heading mb-2">Acessos VPN que vencem em {expiryDays} dias</h2><VpnTable rows={expiring} empty="Nenhum vencimento próximo." /></div>}
          </div>} />
        <Route path="historico" element={<><h1 className="text-2xl font-bold font-heading">Histórico</h1><FilteredRequests rows={closed} empty="Nada no histórico." /></>} />
        {isExecutor && <Route path="vpn" element={<div className="space-y-6">
          <div><h1 className="text-2xl font-bold font-heading mb-2">Acessos ativos</h1><VpnTable rows={vpnActive} empty="Nenhum acesso ativo." /></div>
          <div><h2 className="text-xl font-bold font-heading mb-2">Vencimentos próximos</h2><VpnTable rows={expiring} empty="Nenhum vencimento próximo." /></div>
          <div><h2 className="text-xl font-bold font-heading mb-2">Revogações pendentes</h2><VpnTable rows={toRevoke} empty="Nenhuma revogação pendente." /></div>
        </div>} />}
        {canDiv && <Route path="divergencias" element={<Divergences divs={divs} orgId={orgIds.join(",")} />} />}
        <Route path="*" element={<Navigate to={BASE} replace />} />
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

export default ServiceCenter;
