import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  executionId: string;
  userId: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  matched: { label: "Conciliado", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  ambiguous_match: { label: "Ambíguo", color: "bg-amber-100 text-amber-700", icon: HelpCircle },
  unmatched: { label: "Não conciliado", color: "bg-red-100 text-red-700", icon: AlertCircle },
  ignored: { label: "Ignorado", color: "bg-muted text-muted-foreground", icon: null },
};

const ReconciliationManager = ({ executionId, userId }: Props) => {
  const qc = useQueryClient();

  const { data: reconciliations, isLoading } = useQuery({
    queryKey: ["reconciliations", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliations" as any)
        .select("*, bank_transactions(transaction_date, description_raw, amount, direction), project_expenses(description, total_value)")
        .eq("project_execution_id", executionId)
        .order("decided_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: unmatchedTxns } = useQuery({
    queryKey: ["unmatched-transactions", executionId],
    queryFn: async () => {
      // Get all transactions for this execution
      const { data: stmts } = await supabase
        .from("bank_statements" as any)
        .select("id")
        .eq("project_execution_id", executionId);
      if (!stmts?.length) return [];

      const stmtIds = (stmts as any[]).map((s: any) => s.id);
      const { data: allTxns } = await supabase
        .from("bank_transactions" as any)
        .select("id, transaction_date, description_raw, amount, direction")
        .in("bank_statement_id", stmtIds);

      // Get reconciled transaction IDs
      const reconciledIds = (reconciliations || []).map((r: any) => r.bank_transaction_id);
      return ((allTxns as any[]) || []).filter((t: any) => !reconciledIds.includes(t.id));
    },
    enabled: !isLoading,
  });

  const { data: expenses } = useQuery({
    queryKey: ["project-expenses", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .select("id, description, total_value, supplier_name, invoice_number, issue_date")
        .eq("project_execution_id", executionId);
      if (error) throw error;
      return data as any[];
    },
  });

  const createReconciliation = useMutation({
    mutationFn: async ({ txnId, expenseId }: { txnId: string; expenseId: string | null }) => {
      const { error } = await supabase
        .from("reconciliations" as any)
        .insert({
          project_execution_id: executionId,
          bank_transaction_id: txnId,
          expense_id: expenseId,
          status: expenseId ? "matched" : "unmatched",
          match_rule: expenseId ? "manual" : null,
          decided_by: userId,
          decided_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conciliação registrada!");
      qc.invalidateQueries({ queryKey: ["reconciliations", executionId] });
      qc.invalidateQueries({ queryKey: ["unmatched-transactions", executionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const matchedCount = reconciliations?.filter((r: any) => r.status === "matched").length || 0;
  const unmatchedCount = unmatchedTxns?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Conciliação Bancária</h1>
        <p className="text-sm text-muted-foreground">Relacione transações bancárias com despesas do projeto.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{matchedCount}</p>
            <p className="text-xs text-muted-foreground">Conciliados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{unmatchedCount}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{(reconciliations?.length || 0) + unmatchedCount}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Unmatched transactions */}
      {unmatchedTxns && unmatchedTxns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Transações Pendentes de Conciliação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedTxns.map((t: any) => {
                  // Simple auto-match suggestion: find expense with same amount
                  const matchSuggestion = expenses?.find(
                    (e: any) => Math.abs(e.total_value - t.amount) < 0.01 && t.direction === "debit"
                  );
                  return (
                    <TableRow key={t.id}>
                      <TableCell>{format(new Date(t.transaction_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.description_raw}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.direction === "debit" ? "text-red-600" : "text-emerald-600"}>
                          {t.direction === "debit" ? "Débito" : "Crédito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Math.abs(t.amount))}</TableCell>
                      <TableCell>
                        {matchSuggestion ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => createReconciliation.mutate({ txnId: t.id, expenseId: matchSuggestion.id })}
                          >
                            <CheckCircle className="w-3 h-3" /> Vincular: {matchSuggestion.description?.substring(0, 20)}...
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => createReconciliation.mutate({ txnId: t.id, expenseId: null })}
                          >
                            Marcar sem vínculo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Existing reconciliations */}
      {reconciliations && reconciliations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Conciliação</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transação</TableHead>
                  <TableHead>Despesa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Regra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((r: any) => {
                  const st = statusConfig[r.status] || statusConfig.unmatched;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {r.bank_transactions?.description_raw?.substring(0, 30)}... — {formatCurrency(Math.abs(r.bank_transactions?.amount || 0))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.project_expenses?.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={st.color}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{r.match_rule || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!reconciliations?.length && !unmatchedTxns?.length && (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Nenhuma transação para conciliar. Importe um extrato e adicione transações primeiro.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReconciliationManager;
