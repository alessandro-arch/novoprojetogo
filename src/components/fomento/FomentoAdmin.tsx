import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, ShieldCheck, Building2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FomentoUser {
  user_id: string;
  email: string;
  full_name: string;
  fomento_role: string;
  fomento_org_id: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  gestor: "Gestor",
  auditor: "Auditor",
};

const FomentoAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperadmin, fomentoOrgId } = useFomentoAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("gestor");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [orgSigla, setOrgSigla] = useState("");
  const [siglaLoading, setSiglaLoading] = useState(false);

  // Fetch org sigla
  useEffect(() => {
    if (!fomentoOrgId) return;
    supabase.from("fomento_organizations").select("sigla").eq("id", fomentoOrgId).single()
      .then(({ data }) => { if (data?.sigla) setOrgSigla(data.sigla); });
  }, [fomentoOrgId]);

  const handleSaveSigla = async () => {
    if (!fomentoOrgId) return;
    setSiglaLoading(true);
    try {
      const { error } = await supabase.from("fomento_organizations")
        .update({ sigla: orgSigla.trim().toUpperCase() })
        .eq("id", fomentoOrgId);
      if (error) throw error;
      toast({ title: "Sigla atualizada com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar sigla.", description: err.message, variant: "destructive" });
    } finally {
      setSiglaLoading(false);
    }
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["fomento-users", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      // Superadmin sees all users; org admin sees only users of their org
      const orgFilter = isSuperadmin ? undefined : fomentoOrgId;
      const { data, error } = await supabase.rpc("list_fomento_users" as any, {
        _org_id: orgFilter ?? null,
      });
      if (error) throw error;
      return data as FomentoUser[];
    },
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string | null }) => {
      const { error } = await supabase.rpc("set_fomento_role", {
        _target_user_id: userId,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-users"] });
      toast({ title: "Papel atualizado com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar papel.", description: err.message, variant: "destructive" });
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.rpc("find_profile_by_email", { _email: inviteEmail.trim() });
      if (error) throw error;
      const results = data as FomentoUser[];
      if (!results || results.length === 0) {
        toast({ title: "Usuário não encontrado.", description: "Nenhum perfil com esse e-mail foi localizado.", variant: "destructive" });
        return;
      }
      const profile = results[0];
      if (profile.fomento_role) {
        toast({ title: "Usuário já possui acesso ao Fomento.", variant: "destructive" });
        return;
      }
      await supabase.rpc("set_fomento_role", { _target_user_id: profile.user_id, _role: inviteRole });
      queryClient.invalidateQueries({ queryKey: ["fomento-users"] });
      toast({ title: `Usuário adicionado como ${inviteRole}.` });
      setInviteEmail("");
    } catch (err: any) {
      toast({ title: "Erro ao convidar usuário.", description: err.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // Available roles for invite: superadmin can assign admin; org admin can only assign gestor
  const availableRoles = isSuperadmin
    ? [{ value: "gestor", label: "Gestor" }, { value: "admin", label: "Admin" }, { value: "auditor", label: "Auditor" }]
    : [{ value: "gestor", label: "Gestor" }, { value: "auditor", label: "Auditor" }];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading text-foreground">Administração</h1>

      {/* Org Config */}
      {fomentoOrgId && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Configuração da Organização</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label>Sigla da Instituição</Label>
                <Input
                  placeholder="Ex: UVV, UFES, IFES"
                  value={orgSigla}
                  onChange={(e) => setOrgSigla(e.target.value.toUpperCase())}
                  className="max-w-[200px] uppercase"
                />
                <p className="text-xs text-muted-foreground">Usada para gerar automaticamente o código de Processo Interno (ex: UVV-2026-0001)</p>
              </div>
              <Button onClick={handleSaveSigla} disabled={siglaLoading || !orgSigla.trim()} size="sm" className="gap-1">
                <Save className="w-3.5 h-3.5" /> {siglaLoading ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" /> Convidar Usuário</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="E-mail do usuário" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? "Buscando…" : "Convidar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Usuários do Fomento</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário com acesso ao Fomento.
                    </TableCell>
                  </TableRow>
                ) : (
                  (users ?? []).map((u) => {
                    const isSuperadminUser = u.fomento_role === "superadmin";
                    // Non-superadmin cannot modify superadmin users
                    const canModify = isSuperadmin || !isSuperadminUser;

                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={isSuperadminUser ? "default" : u.fomento_role === "admin" ? "default" : "secondary"}
                            className={`capitalize ${u.fomento_role === "auditor" ? "bg-[#EF9F27]/15 text-[#EF9F27] border-[#EF9F27]/30" : ""}`}
                          >
                            {ROLE_LABELS[u.fomento_role] || u.fomento_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canModify && !isSuperadminUser ? (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRoleMutation.mutate({
                                  userId: u.user_id,
                                  role: u.fomento_role === "admin" ? "gestor" : "admin",
                                })}
                              >
                                Tornar {u.fomento_role === "admin" ? "Gestor" : "Admin"}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O usuário "{u.full_name || u.email}" perderá acesso ao módulo Fomento.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => setRoleMutation.mutate({ userId: u.user_id, role: null })} className="bg-destructive text-destructive-foreground">
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FomentoAdmin;
