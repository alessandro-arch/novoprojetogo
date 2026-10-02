import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ACTION_LABEL, fmtDT } from "./sd-requests";

const db = supabase as any;
const ROLE: Record<string, string> = { admin: "Administrador Institucional", operador: "Operador" };

/** Visão única de quem tem acesso: equipe (membros/grupos) e solicitantes com conta criada. */
export const UsersAccessTab = ({ orgId }: { orgId: string }) => {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["sd-users-access", orgId],
    queryFn: async () => {
      const [m, gm, st, fa] = await Promise.all([
        db.from("sd_members").select("user_id, role, status").eq("organization_id", orgId),
        db.from("sd_group_members").select("user_id, sd_groups(code)").eq("organization_id", orgId),
        db.from("sd_students").select("user_id, full_name, enrollment, status, service_desk_access_active").eq("organization_id", orgId).not("user_id", "is", null),
        db.from("sd_faculty").select("user_id, full_name, enrollment, status, contract_type").eq("organization_id", orgId).not("user_id", "is", null),
      ]);
      const staffIds = Array.from(new Set([...(m.data || []), ...(gm.data || [])].map((x: any) => x.user_id)));
      const { data: profs } = staffIds.length ? await db.from("profiles").select("user_id, full_name, email").in("user_id", staffIds) : { data: [] };
      const pm = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const rows: any[] = staffIds.map((id) => {
        const mem = (m.data || []).find((x: any) => x.user_id === id);
        const p: any = pm.get(id) || {};
        return { id, name: p.full_name || p.email || "-", sub: p.email, profile: mem ? ROLE[mem.role] || mem.role : "Integrante de grupo",
          groups: (gm.data || []).filter((x: any) => x.user_id === id).map((x: any) => x.sd_groups?.code).filter(Boolean), extra: "", active: !mem || mem.status === "ativo" };
      });
      (st.data || []).forEach((s: any) => rows.push({ id: s.user_id, name: s.full_name, sub: s.enrollment, profile: "Aluno · Solicitante", groups: [], extra: s.status, active: s.service_desk_access_active && s.status !== "trancado" }));
      (fa.data || []).forEach((f: any) => rows.push({ id: f.user_id, name: f.full_name, sub: f.enrollment, profile: "Professor · Solicitante", groups: [], extra: f.contract_type || "", active: f.status === "ativo" }));
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  const s = q.trim().toLowerCase();
  const rows = data.filter((r: any) => !s || `${r.name} ${r.sub} ${r.profile}`.toLowerCase().includes(s));
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Estar cadastrado na base e ter acesso ao sistema são coisas diferentes: aqui aparecem só pessoas com conta no Service Desk.</p>
      <Input className="max-w-sm" placeholder="Buscar por nome, e-mail ou matrícula" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="text-xs text-muted-foreground">{rows.length} pessoa(s)</p>
      <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Nome</th><th className="p-2">Perfil</th><th className="p-2">Grupos</th><th className="p-2">Vínculo</th><th className="p-2">Conta</th></tr></thead>
        <tbody>{rows.map((r: any, i: number) => (
          <tr key={r.id + i} className="border-t">
            <td className="p-2">{r.name}<div className="text-xs text-muted-foreground">{r.sub}</div></td>
            <td className="p-2">{r.profile}</td>
            <td className="p-2">{r.groups.join(", ") || "-"}</td>
            <td className="p-2 capitalize">{r.extra || "-"}</td>
            <td className="p-2"><Badge variant={r.active ? "default" : "outline"}>{r.active ? "Ativa" : "Suspensa"}</Badge></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
};

export const ServicesTab = ({ orgId }: { orgId: string }) => {
  const { data = [] } = useQuery({
    queryKey: ["sd-services-admin", orgId],
    queryFn: async () => (await db.from("sd_services").select("*").eq("organization_id", orgId).order("name")).data || [],
  });
  return (
    <div className="space-y-3">
      {!data.length && <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>}
      {data.map((s: any) => (
        <Card key={s.id} className="rounded-xl"><CardContent className="py-3 text-sm space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{s.name}</span><Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "Ativo" : "Inativo"}</Badge></div>
          {s.description && <p className="text-muted-foreground">{s.description}</p>}
          <p className="text-xs">Etapas: {(s.steps || []).join(" → ") || "-"}</p>
        </CardContent></Card>
      ))}
    </div>
  );
};

export const AuditTab = ({ orgId }: { orgId: string }) => {
  const { data = [] } = useQuery({
    queryKey: ["sd-audit", orgId],
    queryFn: async () => (await db.from("sd_request_events").select("*, sd_requests(protocol, requester_name)").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200)).data || [],
  });
  return (
    <div className="overflow-x-auto border rounded-xl"><table className="w-full text-sm">
      <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Data/hora</th><th className="p-2">Protocolo</th><th className="p-2">Ação</th><th className="p-2">Por</th><th className="p-2">Observação</th></tr></thead>
      <tbody>
        {!data.length && <tr><td colSpan={5} className="p-3 text-muted-foreground">Nenhum evento.</td></tr>}
        {data.map((e: any) => (
          <tr key={e.id} className="border-t"><td className="p-2 whitespace-nowrap">{fmtDT(e.created_at)}</td><td className="p-2 font-mono text-xs">{e.sd_requests?.protocol}</td><td className="p-2">{ACTION_LABEL[e.action] || e.action}</td><td className="p-2">{e.actor_name || "-"}</td><td className="p-2">{e.note || ""}</td></tr>
        ))}
      </tbody>
    </table></div>
  );
};
