import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowRight, Building2, Edit, Loader2, Plus, Power, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FomentoOrg {
  id: string;
  name: string;
  sigla: string | null;
  emec_code: string | null;
  plan: string;
  admin_user_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  status: string;
  created_at: string;
}

interface Props {
  subRoute?: string;
  orgId?: string;
  onNavigate: (path: string) => void;
}

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  basic: "bg-secondary text-secondary-foreground",
  pro: "bg-primary text-primary-foreground",
  enterprise: "bg-accent text-accent-foreground",
};

// ─── Listing ───────────────────────────────────────────────
const OrgListing = ({ onNavigate }: { onNavigate: (p: string) => void }) => {
  const { data: orgs, isLoading } = useQuery({
    queryKey: ["fomento-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fomento_organizations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FomentoOrg[];
    },
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("fomento_organizations")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-organizations"] });
      toast({ title: "Status atualizado" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Organizações</h2>
          <p className="text-sm text-muted-foreground">Gerencie as instituições cadastradas no ProjetoGO Fomento</p>
        </div>
        <Button onClick={() => onNavigate("/fomento/master/nova")} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Organização
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instituição</TableHead>
                <TableHead>Administrador</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!orgs || orgs.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma organização cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{org.name}</span>
                        {org.sigla && <span className="text-muted-foreground ml-1">({org.sigla})</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.admin_name ? (
                        <div>
                          <div className="text-sm font-medium">{org.admin_name}</div>
                          <div className="text-xs text-muted-foreground">{org.admin_email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem admin</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={PLAN_COLORS[org.plan] || ""}>
                        {PLAN_LABELS[org.plan] || org.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.status === "ativo" ? "default" : "secondary"}>
                        {org.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigate(`/fomento/master/${org.id}/editar`)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleStatus.mutate({
                              id: org.id,
                              newStatus: org.status === "ativo" ? "inativo" : "ativo",
                            })
                          }
                          title={org.status === "ativo" ? "Desativar" : "Ativar"}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── 2-Step Form ───────────────────────────────────────────
const OrgForm = ({
  orgId,
  onNavigate,
}: {
  orgId?: string;
  onNavigate: (p: string) => void;
}) => {
  const isEditing = !!orgId;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 fields
  const [name, setName] = useState("");
  const [sigla, setSigla] = useState("");
  const [emecCode, setEmecCode] = useState("");
  const [plan, setPlan] = useState("basic");

  // Step 2 fields
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load existing org for edit
  const { isLoading: loadingOrg } = useQuery({
    queryKey: ["fomento-org", orgId],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fomento_organizations")
        .select("*")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      const org = data as FomentoOrg;
      setName(org.name);
      setSigla(org.sigla || "");
      setEmecCode(org.emec_code || "");
      setPlan(org.plan);
      setAdminName(org.admin_name || "");
      setAdminEmail(org.admin_email || "");
      return org;
    },
  });

  // eMEC search
  const [emecSearch, setEmecSearch] = useState("");
  const [emecResults, setEmecResults] = useState<Array<{ name: string; sigla: string; id: string }>>([]);
  const [searchingEmec, setSearchingEmec] = useState(false);

  const searchEmec = async () => {
    if (!emecSearch.trim()) return;
    setSearchingEmec(true);
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, sigla")
        .ilike("name", `%${emecSearch}%`)
        .limit(10);
      if (error) throw error;
      setEmecResults(data || []);
    } finally {
      setSearchingEmec(false);
    }
  };

  const selectEmec = (inst: { name: string; sigla: string; id: string }) => {
    setName(inst.name);
    setSigla(inst.sigla || "");
    setEmecCode(inst.id);
    setEmecResults([]);
    setEmecSearch("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (step === 2 && !adminEmail.trim()) {
      toast({ title: "E-mail do admin é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let orgIdToUse = orgId;

      if (isEditing) {
        const { error } = await supabase
          .from("fomento_organizations")
          .update({ name, sigla: sigla || null, emec_code: emecCode || null, plan })
          .eq("id", orgId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("fomento_organizations")
          .insert({ name, sigla: sigla || null, emec_code: emecCode || null, plan })
          .select("id")
          .single();
        if (error) throw error;
        orgIdToUse = data.id;
      }

      // If step 2 and admin email provided, invite
      if (step === 2 && adminEmail.trim() && adminName.trim()) {
        const { data: inviteResult, error: inviteError } = await supabase.functions.invoke(
          "invite-fomento-admin",
          { body: { email: adminEmail, full_name: adminName, org_id: orgIdToUse } }
        );
        if (inviteError) throw inviteError;
        if (inviteResult?.error) throw new Error(inviteResult.error);

        toast({
          title: inviteResult.is_new
            ? "Organização criada e convite enviado!"
            : "Organização criada e admin vinculado!",
          description: inviteResult.is_new
            ? `Um e-mail de convite foi enviado para ${adminEmail}`
            : `${adminName} foi vinculado como admin`,
        });
      } else {
        toast({ title: isEditing ? "Organização atualizada!" : "Organização criada!" });
      }

      queryClient.invalidateQueries({ queryKey: ["fomento-organizations"] });
      onNavigate("/fomento/master");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingOrg) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Button variant="ghost" onClick={() => onNavigate("/fomento/master")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      <h2 className="text-lg font-semibold">
        {isEditing ? "Editar Organização" : "Nova Organização"}
      </h2>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" /> 1. Dados da Organização
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <UserCog className="w-4 h-4" /> 2. Administrador
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dados da Organização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* eMEC search */}
            <div>
              <Label>Buscar no eMEC</Label>
              <div className="flex gap-2">
                <Input
                  value={emecSearch}
                  onChange={(e) => setEmecSearch(e.target.value)}
                  placeholder="Digite o nome da instituição..."
                  onKeyDown={(e) => e.key === "Enter" && searchEmec()}
                />
                <Button variant="outline" onClick={searchEmec} disabled={searchingEmec}>
                  {searchingEmec ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              {emecResults.length > 0 && (
                <div className="border rounded-md mt-2 max-h-40 overflow-y-auto">
                  {emecResults.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => selectEmec(inst)}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                    >
                      {inst.name} {inst.sigla && `(${inst.sigla})`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Nome Completo *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo da instituição" />
            </div>

            <div>
              <Label>Sigla</Label>
              <Input value={sigla} onChange={(e) => setSigla(e.target.value)} placeholder="Ex: UVV" />
            </div>

            <div>
              <Label>Plano *</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setStep(2)} disabled={!name.trim()}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Administrador da Instituição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome completo do administrador *</Label>
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nome completo" />
            </div>

            <div>
              <Label>E-mail institucional *</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@instituicao.edu.br"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O admin receberá um e-mail com link de acesso e instrução para definir senha.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving || !adminName.trim() || !adminEmail.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {isEditing ? "Salvar Alterações" : "Criar Organização e Convidar Admin"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────
const FomentoMasterPanel = ({ subRoute, orgId, onNavigate }: Props) => {
  if (subRoute === "nova") {
    return <OrgForm onNavigate={onNavigate} />;
  }
  if (subRoute === "editar" && orgId) {
    return <OrgForm orgId={orgId} onNavigate={onNavigate} />;
  }
  return <OrgListing onNavigate={onNavigate} />;
};

export default FomentoMasterPanel;
