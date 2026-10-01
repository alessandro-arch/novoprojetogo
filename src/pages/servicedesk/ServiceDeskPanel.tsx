import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, UsersRound, Settings, Loader2, Plus, Trash2, Pencil, BookOpen, GraduationCap, Briefcase, FileSpreadsheet, Inbox } from "lucide-react";
import { ProgramsTab, StudentsTab, FacultyTab, ImportTab } from "@/components/servicedesk/SdBases";
import RequesterHome from "@/components/servicedesk/RequesterHome";
import GroupQueues from "@/components/servicedesk/GroupQueues";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PanelLayout from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const db = supabase as any;

const NAV = [
  { key: "queue", label: "Solicitações", icon: Inbox },
  { key: "institution", label: "Instituição", icon: Building2 },
  { key: "members", label: "Membros", icon: Users },
  { key: "groups", label: "Grupos responsáveis", icon: UsersRound },
  { key: "programs", label: "Programas", icon: BookOpen },
  { key: "students", label: "Alunos", icon: GraduationCap },
  { key: "faculty", label: "Professores", icon: Briefcase },
  { key: "imports", label: "Importação Excel", icon: FileSpreadsheet },
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
  const [nav, setNav] = useState("queue");
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

  const { data: myGroups, isLoading: loadingGroups } = useQuery({
    queryKey: ["sd-my-groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: gm } = await db.from("sd_group_members").select("group_id, organization_id, sd_groups(id, code, name, is_active)").eq("user_id", user!.id);
      return (gm || []).filter((x: any) => x.sd_groups && x.sd_groups.is_active !== false).map((x: any) => ({ ...x.sd_groups, organization_id: x.organization_id }));
    },
  });

  const { data: orgGroups } = useQuery({
    queryKey: ["sd-org-groups", orgId], enabled: !!orgId && !!orgs?.length,
    queryFn: async () => (await db.from("sd_groups").select("id, code, name").eq("organization_id", orgId).eq("is_active", true).order("code")).data || [],
  });

  useEffect(() => { if (!orgId && orgs?.length) setOrgId(orgs[0].id); }, [orgs, orgId]);

  if (loading || isLoading || loadingGroups) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!orgs?.length && myGroups?.length) {
    const gOrg = myGroups[0].organization_id;
    return (
      <PanelLayout title="Service Desk" subtitle={myGroups.map((g: any) => g.code).join(" · ")} navItems={[{ key: "queue", label: "Solicitações", icon: Inbox }]} activeNav="queue" onNavChange={() => {}} onSignOut={signOut}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold font-heading">Solicitações — {myGroups.map((g: any) => g.code).join(" e ")}</h1>
          <GroupQueues orgId={gOrg} groups={myGroups.filter((g: any) => g.organization_id === gOrg)} isAdmin={false} />
        </div>
      </PanelLayout>
    );
  }
  if (!orgs?.length) return (
    <RequesterHome userId={user.id} onSignOut={() => signOut()} noAccessMessage="Seu acesso ao Service Desk não está ativo. Fale com a secretaria do programa." />
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
        {nav === "queue" && <GroupQueues orgId={org.id} groups={orgGroups || []} isAdmin />}
        {nav === "institution" && <InstitutionTab org={org} isSuper={isSuper} />}
        {nav === "members" && <MembersTab orgId={org.id} />}
        {nav === "groups" && <GroupsTab orgId={org.id} />}
        {nav === "programs" && <ProgramsTab orgId={org.id} />}
        {nav === "students" && <StudentsTab orgId={org.id} />}
        {nav === "faculty" && <FacultyTab orgId={org.id} />}
        {nav === "imports" && <ImportTab orgId={org.id} orgLabel={org.sigla || org.name} />}
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
  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["sd-members", orgId],
    queryFn: async () => {
      const { data, error } = await db.from("sd_members").select("*").eq("organization_id", orgId).order("created_at");
      if (error) throw error;
      const ids = (data || []).map((m: any) => m.user_id);
      const { data: profs, error: profilesError } = ids.length ? await db.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [], error: null };
      if (profilesError) throw profilesError;
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
  const remove = async (id: string) => {
    const { error } = await db.from("sd_members").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Membro excluído");
    await refetch();
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Membros cadastrados</h2>
          <Badge variant="secondary">{data?.length || 0}</Badge>
        </div>
        {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando membros...</div>}
        {queryError && <p className="text-sm text-destructive">Não foi possível carregar a lista de membros.</p>}
        {(data || []).map((m: any) => (
          <MemberCard key={m.id} member={m} onUpdate={update} onRemove={remove} />
        ))}
        {!isLoading && !queryError && !data?.length && <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>}
      </div>
    </div>
  );
};

const MemberCard = ({ member, onUpdate, onRemove }: any) => {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const save = async () => {
    await onUpdate(member.id, { role, status });
    setEditing(false);
  };
  return (
    <Card className="rounded-xl"><CardContent className="py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="font-medium text-sm">{member.profile?.full_name || "Nome não informado"}</p>
          <p className="text-xs text-muted-foreground">{member.profile?.email || "E-mail não disponível"}</p>
          {!editing && <p className="mt-1 text-xs">{ROLE_LABELS[member.role] || member.role} · {member.status}</p>}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button className="flex-1 sm:flex-none" size="sm" variant="outline" onClick={() => setEditing((value) => !value)}><Pencil className="mr-1 h-4 w-4" /> Editar</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button className="flex-1 text-destructive sm:flex-none" size="sm" variant="outline"><Trash2 className="mr-1 h-4 w-4" /> Excluir</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir membro?</AlertDialogTitle><AlertDialogDescription>Esta pessoa será removida da equipe da instituição.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onRemove(member.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {editing && <div className="flex flex-wrap items-end gap-3 border-t pt-3">
        <div><Label>Papel</Label><select className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div><Label>Situação</Label><select className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></div>
        <Button size="sm" onClick={save}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>}
    </CardContent></Card>
  );
};

const GroupsTab = ({ orgId }: { orgId: string }) => {
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["sd-groups", orgId],
    queryFn: async () => {
      const { data: groups, error: groupsError } = await db.from("sd_groups").select("*").eq("organization_id", orgId).order("code");
      if (groupsError) throw groupsError;
      const { data: gm, error: membersError } = await db.from("sd_group_members").select("*").eq("organization_id", orgId);
      if (membersError) throw membersError;
      const ids = [...new Set((gm || []).map((x: any) => x.user_id))];
      const { data: profs, error: profilesError } = ids.length ? await db.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [], error: null };
      if (profilesError) throw profilesError;
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
  const moveMember = async (id: string, groupId: string) => {
    const { error } = await db.from("sd_group_members").update({ group_id: groupId }).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Integrante atualizado");
    await refetch();
  };
  const updateGroup = async (id: string, patch: any) => {
    const { error } = await db.from("sd_groups").update(patch).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Grupo atualizado");
    await refetch();
  };
  const removeGroup = async (id: string) => {
    const { error } = await db.from("sd_groups").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Grupo excluído");
    await refetch();
  };
  return (
    <div className="space-y-4">
      <Card className="rounded-xl"><CardContent className="pt-6 flex flex-wrap gap-3 items-end">
        <div><Label>Código</Label><Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: BIBLIOTECA" /></div>
        <div className="flex-1 min-w-[200px]"><Label>Nome</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={addGroup}><Plus className="w-4 h-4 mr-1" /> Criar grupo</Button>
      </CardContent></Card>
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Grupos cadastrados</h2><Badge variant="secondary">{data?.length || 0}</Badge></div>
      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...</div>}
      {queryError && <p className="text-sm text-destructive">Não foi possível carregar a lista de grupos.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(data || []).map((g: any) => <GroupCard key={g.id} g={g} groups={data || []} onAdd={addMember} onMoveMember={moveMember} onRemoveMember={removeMember} onUpdate={updateGroup} onRemoveGroup={removeGroup} />)}
      </div>
      {!isLoading && !queryError && !data?.length && <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</p>}
    </div>
  );
};

const GroupCard = ({ g, groups, onAdd, onMoveMember, onRemoveMember, onUpdate, onRemoveGroup }: any) => {
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(g.code);
  const [name, setName] = useState(g.name);
  const save = async () => {
    if (!code.trim() || !name.trim()) return toast.error("Informe código e nome");
    await onUpdate(g.id, { code: code.trim().toUpperCase(), name: name.trim() });
    setEditing(false);
  };
  return (
    <Card className="rounded-xl">
      <CardHeader className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><CardTitle className="text-base">{g.code} <span className="text-muted-foreground font-normal text-sm">· {g.description || g.name}</span></CardTitle><div className="flex w-full gap-2 sm:w-auto"><Button className="flex-1 sm:flex-none" size="sm" variant="outline" onClick={() => setEditing((value) => !value)}><Pencil className="mr-1 h-4 w-4" /> Editar grupo</Button><AlertDialog><AlertDialogTrigger asChild><Button className="flex-1 text-destructive sm:flex-none" size="sm" variant="outline"><Trash2 className="mr-1 h-4 w-4" /> Excluir grupo</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir grupo?</AlertDialogTitle><AlertDialogDescription>O grupo e sua lista de integrantes serão excluídos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onRemoveGroup(g.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>
        {editing && <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto_auto]"><Input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do grupo" /><Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do grupo" /><Button size="sm" onClick={save}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div>}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Integrantes ({g.members.length})</p>
        {g.members.map((m: any) => <GroupMemberRow key={m.id} member={m} currentGroupId={g.id} groups={groups} onMove={onMoveMember} onRemove={onRemoveMember} />)}
        {!g.members.length && <p className="text-xs text-muted-foreground">Sem integrantes.</p>}
        <div className="flex gap-2 pt-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do integrante" />
          <Button onClick={() => { onAdd(g.id, email); setEmail(""); }}>Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
};

const GroupMemberRow = ({ member, currentGroupId, groups, onMove, onRemove }: any) => {
  const [editing, setEditing] = useState(false);
  const [groupId, setGroupId] = useState(currentGroupId);
  const save = async () => {
    if (groupId !== currentGroupId) await onMove(member.id, groupId);
    setEditing(false);
  };
  return (
    <div className="rounded-md border border-border p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{member.profile?.full_name || "Nome não informado"}</p>
          <p className="truncate text-xs text-muted-foreground">{member.profile?.email || "E-mail não disponível"}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button className="flex-1 sm:flex-none" size="sm" variant="outline" onClick={() => setEditing((value) => !value)}><Pencil className="mr-1 h-4 w-4" /> Editar</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button className="flex-1 text-destructive sm:flex-none" size="sm" variant="outline"><Trash2 className="mr-1 h-4 w-4" /> Excluir</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir integrante?</AlertDialogTitle><AlertDialogDescription>Esta pessoa será removida deste grupo responsável.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onRemove(member.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {editing && <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="min-w-[200px] flex-1"><Label>Grupo responsável</Label><select className="mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={groupId} onChange={(e) => setGroupId(e.target.value)}>{groups.map((group: any) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></div>
        <Button size="sm" onClick={save}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={() => { setGroupId(currentGroupId); setEditing(false); }}>Cancelar</Button>
      </div>}
    </div>
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
