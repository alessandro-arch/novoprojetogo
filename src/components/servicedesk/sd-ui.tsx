import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge, fmtDT, fmtDate, isOpen, STATUS_LABEL } from "./sd-requests";

const db = supabase as any;

export interface SdArea { path: string; label: string }
export interface SdNavItem { to: string; label: string; icon: LucideIcon; count?: number }

/** Sino de notificações internas (persistentes; o e-mail é canal externo). */
export const NotificationBell = ({ userId }: { userId: string }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSdNotifications(userId);
  const unread = (data || []).filter((n: any) => !n.read_at).length;
  const markAll = async () => {
    await db.from("sd_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["sd-notif", userId] });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notificações">
          <Bell className="w-4 h-4" />
          {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center px-1">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b"><p className="text-sm font-medium">Notificações</p>{unread > 0 && <button className="text-xs text-primary" onClick={markAll}>Marcar como lidas</button>}</div>
        <div className="max-h-80 overflow-y-auto">
          {!data?.length && <p className="text-sm text-muted-foreground p-3">Nenhuma notificação.</p>}
          {data?.slice(0, 15).map((n: any) => (
            <button key={n.id} className={`w-full text-left px-3 py-2 border-b text-sm hover:bg-muted ${n.read_at ? "" : "bg-muted/50"}`} onClick={() => n.request_id && navigate(`/servicedesk/solicitacao/${n.request_id}`)}>
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="text-[11px] text-muted-foreground">{fmtDT(n.created_at)}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const useSdNotifications = (userId: string) =>
  useQuery({
    queryKey: ["sd-notif", userId],
    queryFn: async () => (await db.from("sd_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)).data || [],
    refetchInterval: 60000,
  });

/** Estrutura comum das áreas: cabeçalho com seletor de área, sino e sair; menu da área. */
export const SdShell = ({ title, subtitle, userId, areas, nav, onSignOut, children }: {
  title: string; subtitle?: string; userId: string; areas: SdArea[]; nav: SdNavItem[]; onSignOut: () => void; children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold font-heading">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {areas.length > 1 && (
              <select aria-label="Área" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={areas.find((a) => window.location.pathname.startsWith(a.path))?.path || ""} onChange={(e) => navigate(e.target.value)}>
                {areas.map((a) => <option key={a.path} value={a.path}>{a.label}</option>)}
              </select>
            )}
            <NotificationBell userId={userId} />
            <Button variant="outline" onClick={onSignOut}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `flex items-center gap-2 px-3 min-h-[44px] text-sm whitespace-nowrap border-b-2 ${isActive ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <n.icon className="w-4 h-4" />{n.label}{n.count ? <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">{n.count}</span> : null}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">{children}</main>
    </div>
  );
};

export const KpiCard = ({ label, value, tone = "default", hint }: { label: string; value: number | string; tone?: "default" | "alert" | "warn" | "muted"; hint?: string }) => (
  <Card className="rounded-xl">
    <CardContent className="py-4">
      <p className={`text-3xl font-bold font-heading ${tone === "alert" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

export const Placeholder = ({ title, text }: { title: string; text: string }) => (
  <Card className="rounded-xl border-dashed"><CardContent className="py-8 text-center"><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground mt-1">{text}</p></CardContent></Card>
);

// ---------- Busca e filtros ----------
export const STALE_DAYS = 5;
export type Quick = "todos" | "hoje" | "pendentes" | "atrasados" | "concluidos";
export interface ReqFilters { q: string; status: string; service: string; program: string; from: string; to: string; quick: Quick }
export const emptyFilters: ReqFilters = { q: "", status: "", service: "", program: "", from: "", to: "", quick: "todos" };

export const isStale = (r: any) => isOpen(r.status) && Date.now() - new Date(r.stage_entered_at || r.created_at).getTime() > STALE_DAYS * 864e5;

export const applyFilters = (rows: any[], f: ReqFilters) => {
  const q = f.q.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((r) =>
    (!q || [r.protocol, r.requester_name, r.requester_enrollment].some((v) => (v || "").toLowerCase().includes(q))) &&
    (!f.status || r.status === f.status) && (!f.service || r.service_id === f.service) &&
    (!f.program || (r.requester_program || "") === f.program) &&
    (!f.from || r.created_at.slice(0, 10) >= f.from) && (!f.to || r.created_at.slice(0, 10) <= f.to) &&
    (f.quick === "todos" || (f.quick === "hoje" && r.created_at.slice(0, 10) === today) || (f.quick === "pendentes" && isOpen(r.status)) ||
      (f.quick === "atrasados" && isStale(r)) || (f.quick === "concluidos" && r.status === "concluido")),
  );
};

const QUICK: [Quick, string][] = [["todos", "Todos"], ["hoje", "Hoje"], ["pendentes", "Pendentes"], ["atrasados", "Atrasados"], ["concluidos", "Concluídos"]];
const sel = "h-10 rounded-md border border-input bg-background px-2 text-sm";

export const RequestFilters = ({ rows, value, onChange }: { rows: any[]; value: ReqFilters; onChange: (f: ReqFilters) => void }) => {
  const services = useMemo(() => Array.from(new Map(rows.map((r) => [r.service_id, r.sd_services?.name || "Serviço"])).entries()), [rows]);
  const programs = useMemo(() => Array.from(new Set(rows.map((r) => r.requester_program).filter(Boolean))).sort(), [rows]);
  const set = (p: Partial<ReqFilters>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {QUICK.map(([k, l]) => <Button key={k} size="sm" variant={value.quick === k ? "default" : "outline"} onClick={() => set({ quick: k })}>{l}</Button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Protocolo, nome ou matrícula" value={value.q} onChange={(e) => set({ q: e.target.value })} />
        <select className={sel} aria-label="Situação" value={value.status} onChange={(e) => set({ status: e.target.value })}><option value="">Todas as situações</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className={sel} aria-label="Serviço" value={value.service} onChange={(e) => set({ service: e.target.value })}><option value="">Todos os serviços</option>{services.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select className={sel} aria-label="Programa" value={value.program} onChange={(e) => set({ program: e.target.value })}><option value="">Todos os programas</option>{programs.map((p) => <option key={p as string} value={p as string}>{p as string}</option>)}</select>
        <Input type="date" className="w-auto" aria-label="De" value={value.from} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-auto" aria-label="Até" value={value.to} onChange={(e) => set({ to: e.target.value })} />
      </div>
    </div>
  );
};

/** Tabela padrão de solicitações; clicar abre o detalhe. */
export const RequestTable = ({ rows, empty = "Nenhuma solicitação." }: { rows: any[]; empty?: string }) => {
  const navigate = useNavigate();
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>
          <th className="p-2">Protocolo</th><th className="p-2">Solicitante</th><th className="p-2">Tipo</th><th className="p-2">Serviço</th><th className="p-2">PPG</th><th className="p-2">Recebido</th><th className="p-2">Situação</th>
        </tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="border-t cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/servicedesk/solicitacao/${r.id}`)}>
            <td className="p-2 font-mono text-xs">{r.protocol}</td>
            <td className="p-2">{r.requester_name}<div className="text-xs text-muted-foreground">{r.requester_enrollment}</div></td>
            <td className="p-2 capitalize">{r.requester_kind}</td>
            <td className="p-2">{r.sd_services?.name}</td>
            <td className="p-2">{r.requester_program || "—"}</td>
            <td className="p-2">{fmtDate(r.created_at)}{isStale(r) && <div className="text-xs text-destructive">parada há mais de {STALE_DAYS} dias</div>}</td>
            <td className="p-2"><StatusBadge status={r.status} />{r.correction_cycle > 0 && r.resubmitted_at && isOpen(r.status) && r.status !== "correcao" && <div className="text-xs text-primary font-medium mt-1">Correção recebida (#{r.correction_cycle})</div>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
};

export const FilteredRequests = ({ rows, empty }: { rows: any[]; empty?: string }) => {
  const [f, setF] = useState<ReqFilters>(emptyFilters);
  return <div className="space-y-3"><RequestFilters rows={rows} value={f} onChange={setF} /><RequestTable rows={applyFilters(rows, f)} empty={empty} /></div>;
};
