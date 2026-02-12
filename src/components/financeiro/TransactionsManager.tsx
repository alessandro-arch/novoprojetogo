import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CreditCard, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  executionId: string;
}

const TransactionsManager = ({ executionId }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bank_statement_id: "",
    bank_account_id: "",
    transaction_date: "",
    posting_date: "",
    description_raw: "",
    amount: "",
    direction: "debit",
    balance_after: "",
    document_id_reference: "",
  });

  const { data: statements } = useQuery({
    queryKey: ["bank-statements", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statements" as any)
        .select("id, bank_account_id, statement_period_start, statement_period_end, project_bank_accounts(bank_name)")
        .eq("project_execution_id", executionId);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["bank-transactions", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions" as any)
        .select("*, bank_statements(project_bank_accounts(bank_name))")
        .in("bank_statement_id", (statements || []).map((s: any) => s.id))
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!statements?.length,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const stmt = statements?.find((s: any) => s.id === form.bank_statement_id);
      const { error } = await supabase
        .from("bank_transactions" as any)
        .insert({
          bank_statement_id: form.bank_statement_id,
          bank_account_id: stmt?.bank_account_id,
          transaction_date: form.transaction_date,
          posting_date: form.posting_date || null,
          description_raw: form.description_raw,
          amount: parseFloat(form.amount),
          direction: form.direction,
          balance_after: form.balance_after ? parseFloat(form.balance_after) : null,
          document_id_reference: form.document_id_reference || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação adicionada!");
      setOpen(false);
      setForm({ bank_statement_id: "", bank_account_id: "", transaction_date: "", posting_date: "", description_raw: "", amount: "", direction: "debit", balance_after: "", document_id_reference: "" });
      qc.invalidateQueries({ queryKey: ["bank-transactions", executionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Transações</h1>
          <p className="text-sm text-muted-foreground">Adicione manualmente as transações do extrato.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5" disabled={!statements?.length}>
              <Plus className="w-4 h-4" /> Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2 space-y-1.5">
                <Label>Extrato *</Label>
                <Select value={form.bank_statement_id} onValueChange={(v) => setForm(f => ({ ...f, bank_statement_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o extrato" /></SelectTrigger>
                  <SelectContent>
                    {statements?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {(s as any).project_bank_accounts?.bank_name} — {s.statement_period_start || "Sem período"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={form.transaction_date} onChange={(e) => setForm(f => ({ ...f, transaction_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Direção *</Label>
                <Select value={form.direction} onValueChange={(v) => setForm(f => ({ ...f, direction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Débito (Saída)</SelectItem>
                    <SelectItem value="credit">Crédito (Entrada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>Saldo Após</Label>
                <Input type="number" step="0.01" value={form.balance_after} onChange={(e) => setForm(f => ({ ...f, balance_after: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Descrição *</Label>
                <Input value={form.description_raw} onChange={(e) => setForm(f => ({ ...f, description_raw: e.target.value }))} placeholder="Descrição da transação no extrato" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nº Documento</Label>
                <Input value={form.document_id_reference} onChange={(e) => setForm(f => ({ ...f, document_id_reference: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.bank_statement_id || !form.transaction_date || !form.description_raw || !form.amount}
              className="w-full"
            >
              {createMutation.isPending ? "Salvando..." : "Adicionar Transação"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {!statements?.length && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Importe um extrato primeiro.</CardContent></Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : transactions && transactions.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{format(new Date(t.transaction_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="max-w-[250px] truncate">{t.description_raw}</TableCell>
                    <TableCell>
                      {t.direction === "debit" ? (
                        <Badge variant="outline" className="gap-1 text-red-600 border-red-200">
                          <ArrowDownCircle className="w-3 h-3" /> Débito
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200">
                          <ArrowUpCircle className="w-3 h-3" /> Crédito
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${t.direction === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                      {t.direction === "debit" ? "- " : "+ "}{formatCurrency(Math.abs(t.amount))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {t.balance_after != null ? formatCurrency(t.balance_after) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : statements?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Nenhuma transação registrada.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default TransactionsManager;
