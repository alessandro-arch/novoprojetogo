import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  executionId: string;
  userId: string;
}

const BankAccountsManager = ({ executionId, userId }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bank_name: "",
    bank_code: "",
    branch_number: "",
    account_number: "",
    account_type: "corrente",
    account_holder_name: "",
    account_holder_document: "",
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["bank-accounts", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bank_accounts" as any)
        .select("*")
        .eq("project_execution_id", executionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_bank_accounts" as any)
        .insert({ ...form, project_execution_id: executionId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta cadastrada!");
      setOpen(false);
      setForm({ bank_name: "", bank_code: "", branch_number: "", account_number: "", account_type: "corrente", account_holder_name: "", account_holder_document: "" });
      qc.invalidateQueries({ queryKey: ["bank-accounts", executionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_bank_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida");
      qc.invalidateQueries({ queryKey: ["bank-accounts", executionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Contas Bancárias</h1>
          <p className="text-sm text-muted-foreground">Gerencie as contas bancárias vinculadas ao projeto.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="w-4 h-4" /> Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Conta Bancária</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Banco *</Label>
                <Input value={form.bank_name} onChange={(e) => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Ex: Banco do Brasil" />
              </div>
              <div className="space-y-1.5">
                <Label>Código do Banco</Label>
                <Input value={form.bank_code} onChange={(e) => setForm(f => ({ ...f, bank_code: e.target.value }))} placeholder="001" />
              </div>
              <div className="space-y-1.5">
                <Label>Agência *</Label>
                <Input value={form.branch_number} onChange={(e) => setForm(f => ({ ...f, branch_number: e.target.value }))} placeholder="1234-5" />
              </div>
              <div className="space-y-1.5">
                <Label>Conta *</Label>
                <Input value={form.account_number} onChange={(e) => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="12345-6" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm(f => ({ ...f, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ Titular *</Label>
                <Input value={form.account_holder_document} onChange={(e) => setForm(f => ({ ...f, account_holder_document: e.target.value }))} placeholder="00.000.000/0001-00" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nome do Titular *</Label>
                <Input value={form.account_holder_name} onChange={(e) => setForm(f => ({ ...f, account_holder_name: e.target.value }))} placeholder="Nome completo" />
              </div>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.bank_name || !form.branch_number || !form.account_number || !form.account_holder_name || !form.account_holder_document}
              className="w-full"
            >
              {createMutation.isPending ? "Salvando..." : "Cadastrar Conta"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : !accounts?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Nenhuma conta bancária cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Agência</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc: any) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.bank_name}</TableCell>
                    <TableCell>{acc.branch_number}</TableCell>
                    <TableCell>{acc.account_number}</TableCell>
                    <TableCell className="capitalize">{acc.account_type}</TableCell>
                    <TableCell>{acc.account_holder_name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(acc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BankAccountsManager;
