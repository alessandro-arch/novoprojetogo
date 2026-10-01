import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, UsersRound, Settings, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PanelLayout from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const db = supabase as any;

const NAV = [
  { key: "institution", label: "Instituição", icon: Building2 },
  { key: "members", label: "Membros", icon: Users },
  { key: "groups", label: "Grupos responsáveis", icon: UsersRound },
  { key: "settings", label: "Configurações", icon: Settings },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador Institucional",
  operador: "Operador",
  solicitante_aluno: "Solicitante Aluno",
  solicitante_professor: "Solicitante Professor",
  solicitante: "Solicitante",
};

const ServiceDeskPanel = () => {
  const { user, loading, globalRole, signOut } = useAuth();
  const [nav, setNav] = useState("institution");
  const [orgId, setOrgId] = useState<string | null>(null);
  const isSuper = globalRole === "icca_admin";

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["sd-orgs", user?.id, isSuper],
    enabled: !!user,
    queryFn: async () => {
      if (isSuper) {
        const { data } = await db.from("organizations").select("*").order("name");
        return data || [];
      }
      const { data: m } = await db.from("sd_members").select("organization_id, role").eq("user_id", user!.id).eq("role", "admin");
      const ids = (m || []).map((x: any) => x.organization_id);
      if (!ids.length) return [];
      const { data } = await db.from("organizations").select("*").in("id", ids);
      return data || [];
    },
  });

  useEffect(() => { if (!orgId && orgs?.length) setOrgId(orgs[0].id); }, [orgs, orgId]);

  if (loading || isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!orgs?.length) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div><h1 className="text-xl font-bold font-heading">Service Desk Acadêmico</h1><p className="text-muted-foreground mt-2">Você não é administrador de nenhuma instituição.</p></div>
    </div>
  );

  const org = orgs.find((o: any) => o.id === orgId) || orgs[0];

  return (
    <PanelLayout title="Service Desk" subtitle={org.sigla || org.name} navItems={NAV} activeNav={nav} onNavChange={setNav} onSignOut={signOut}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold font-heading">{NAV.find((n) => n.key === nav)?.label}</h1>
          {orgs.length > 1 && (
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={org.id} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.sigla || o.name}</option>)}
            </select>
          )}
        </div>
        {nav === "institution" && <InstitutionTab org={org} isSuper={isSuper} />}
        {nav === "members" && <MembersTab orgId={org.id} />}
        {nav === "groups" && <GroupsTab orgId={org.id} />}
        {nav === "settings" && <SettingsTab orgId={org.id} />}
      </div>
    </PanelLayout>
  );
};

const InstitutionTab = ({ org, isSuper }: { org: any; isSuper: boolean }) => {
  const qc = useQueryClient();
  const [f, setF] = useState(org);
  const [newName, setNewName] = useState("");
  const [newSigla, setNewSigla] = useState("");
  useEffect(() => setF(org), [org]);

  const save = async () => {
    const { error } = await db.from("organizations").update({ name: f.name, sigla: f.sigla, logo_url: f.logo_url, domain: f.domain, timezone: f.timezone, is_active: f.is_active }).eq("id", org.id);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Instituição atualizada");
    qc.invalidateQueries({ queryKey: ["sd-orgs"] });
  };
  const create = async () => {
    if (!newName.trim() || !newSigla.trim()) return toast.error("Informe nome e sigla");
    const slug = newSigla.toLowerCase().replace(/[^a-z0-9]/g, "");
    const { error } = await db.from("organizations").insert({ name: newName.trim(), sigla: newSigla.trim().toUpperCase(), slug });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Instituição criada");
    setNewName(""); setNewSigla("");
    qc.invalidateQueries({ queryKey: ["sd-orgs"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-xl">
        <CardHeader><CardTitle className="text-base">Dados da instituição</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[["name", "Nome"], ["sigla", "Sigla"], ["domain", "Domínio institucional"], ["logo_url", "Logotipo (URL)"], ["timezone", "Fuso horário"]].map(([k, l]) => (
            <div key={k}><Label>{l}</Label><Input className="mt-1" value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          {isSuper && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Instituição ativa</label>
          )}
          <Button onClick={save}>Salvar</Button>
        </CardContent>
      </Card>
      {isSuper && (
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Nova instituição</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Nome</Label><Input className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><Label>Sigla</Label><Input className="mt-1" value={newSigla} onChange={(e) => setNewSigla(e.target.value)} /></div>
            <Button onClick={create}><Plus className="w-4 h-4 mr-1" /> Criar</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MembersTab = ({ orgId }: { orgId: string }) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operador");
  const { data, refetch } = useQuery({
    queryKey: ["sd-members", orgId],
    queryFn: async () => {
      const { data } = await db.from("sd_members").select("*").eq("organization_id", orgId).order("created_at");
      const ids = (data || []).map((m: any) => m.user_id);
      const { data: profs } = ids.length ? await db.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [] };
      return (data || []).map((m: any) => ({ ...m, profile: (profs || []).find((p: any) => p.user_id === m.user_id) }));
    },
  });
  const add = async () => {
    const { data: found } = await db.rpc("find_profile_by_email", { _email: email.trim().toLowerCase() });
    if (!found?.length) return toast.error("Usuário não encontrado. A pessoa precisa ter conta no ProjetoGO.");
    const { error } = await db.from("sd_members").upsert({ organization_id: orgId, user_id: found[0].user_id, role, status: "ativo" }, { onConflict: "organization_id,user_id" });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Membro adicionado"); setEmail(""); refetch();
  };
  const update = async (id: string, patch: any) => {
    const { error } = await db.from("sd_members").update(patch).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Atualizado"); refetch();
  };
  return (
    <div className="space-y-4">
      <Card className="rounded-xl"><CardContent className="pt-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]"><Label>E-mail</Label><Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@instituicao.br" /></div>
        <div><Label>Papel</Label>
          <select className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm block" value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== "solicitante").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
      </CardContent></Card>
      <div className="space-y-2">
        {(data || []).map((m: any) => (
          <Card key={m.id} className="rounded-xl"><CardContent className="py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]"><p className="font-medium text-sm">{m.profile?.full_name || "—"}</p><p className="text-xs text-muted-foreground">{m.profile?.email}</p></div>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={m.role} onChange={(e) => update(m.id, { role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => update(m.id, { status: m.status === "ativo" ? "inativo" : "ativo" })}>
              <Badge variant={m.status === "ativo" ? "default" : "secondary"}>{m.status}</Badge>
            </Button>
          </CardContent></Card>
        ))}
        {!data?.length && <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>}
      </div>
    </div>
  );
};

const GroupsTab = ({ orgId }: { orgId: string }) => {
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const { data, refetch } = useQuery({
    queryKey: ["sd-groups", orgId],
    queryFn: async () => {
      const { data: groups } = await db.from("sd_groups").select("*").eq("organization_id", orgId).order("code");
      const { data: gm } = await db.from("sd_group_members").select("*").eq("organization_id", orgId);
      const ids = [...new Set((gm || []).map((x: any) => x.user_id))];
      const { data: profs } = ids.length ? await db.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [] };
      return (groups || []).map((g: any) => ({ ...g, members: (gm || []).filter((x: any) => x.group_id === g.id).map((x: any) => ({ ...x, profile: (profs || []).find((p: any) => p.user_id === x.user_id) })) }));
    },
  });
  const addGroup = async () => {
    if (!code.trim() || !name.trim()) return toast.error("Informe código e nome");
    const { error } = await db.from("sd_groups").insert({ organization_id: orgId, code: code.trim().toUpperCase(), name: name.trim() });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Grupo criado"); setCode(""); setName(""); refetch();
  };
  const addMember = async (groupId: string, email: string) => {
    const { data: found } = await db.rpc("find_profile_by_email", { _email: email.trim().toLowerCase() });
    if (!found?.length) return toast.error("Usuário não encontrado");
    const { error } = await db.from("sd_group_members").insert({ group_id: groupId, organization_id: orgId, user_id: found[0].user_id });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Adicionado ao grupo"); refetch();
  };
  const removeMember = async (id: string) => {
    const { error } = await db.from("sd_group_members").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Removido"); refetch();
  };
  return (
    <div className="space-y-4">
      <Card className="rounded-xl"><CardContent className="pt-6 flex flex-wrap gap-3 items-end">
        <div><Label>Código</Label><Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: BIBLIOTECA" /></div>
        <div className="flex-1 min-w-[200px]"><Label>Nome</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={addGroup}><Plus className="w-4 h-4 mr-1" /> Criar grupo</Button>
      </CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2">
        {(data || []).map((g: any) => <GroupCard key={g.id} g={g} onAdd={addMember} onRemove={removeMember} />)}
      </div>
    </div>
  );
};

const GroupCard = ({ g, onAdd, onRemove }: any) => {
  const [email, setEmail] = useState("");
  return (
    <Card className="rounded-xl">
      <CardHeader><CardTitle className="text-base">{g.code} <span className="text-muted-foreground font-normal text-sm">· {g.description || g.name}</span></CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {g.members.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between text-sm">
            <span>{m.profile?.full_name || m.profile?.email}</span>
            <Button size="icon" variant="ghost" onClick={() => onRemove(m.id)} aria-label="Remover"><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
        {!g.members.length && <p className="text-xs text-muted-foreground">Sem integrantes.</p>}
        <div className="flex gap-2 pt-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do integrante" />
          <Button onClick={() => { onAdd(g.id, email); setEmail(""); }}>Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
};

const SettingsTab = ({ orgId }: { orgId: string }) => {
  const { data, refetch } = useQuery({
    queryKey: ["sd-settings", orgId],
    queryFn: async () => (await db.from("sd_settings").select("*").eq("organization_id", orgId).order("key")).data || [],
  });
  return (
    <div className="space-y-4">
      {(data || []).map((s: any) => <SettingCard key={s.id} s={s} onSaved={refetch} />)}
      {!data?.length && <p className="text-sm text-muted-foreground">Nenhuma configuração cadastrada.</p>}
    </div>
  );
};

const SettingCard = ({ s, onSaved }: any) => {
  const [text, setText] = useState(JSON.stringify(s.value, null, 2));
  const save = async () => {
    let value; try { value = JSON.parse(text); } catch { return toast.error("Formato inválido"); }
    const { error } = await db.from("sd_settings").update({ value }).eq("id", s.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Configuração salva"); onSaved();
  };
  return (
    <Card className="rounded-xl">
      <CardHeader><CardTitle className="text-base">{s.description || s.key}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Textarea className="font-mono text-xs min-h-[100px]" value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" onClick={save}>Salvar</Button>
      </CardContent>
    </Card>
  );
};

export default ServiceDeskPanel;
