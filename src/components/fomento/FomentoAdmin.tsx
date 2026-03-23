import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FomentoUser {
  user_id: string;
  email: string;
  full_name: string;
  fomento_role: string;
}

const FomentoAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("gestor");
  const [inviteLoading, setInviteLoading] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["fomento-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_fomento_users");
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading text-foreground">Administração</h1>

      {/* Invite */}
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" /> Convidar Usuário</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="E-mail do usuário" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
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
                  (users ?? []).map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.fomento_role === "admin" ? "default" : "secondary"} className="capitalize">
                          {u.fomento_role}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))
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
