import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface Props {
  executionId: string;
}

const FinancialReports = ({ executionId }: Props) => {
  const { data: stats } = useQuery({
    queryKey: ["financial-stats", executionId],
    queryFn: async () => {
      // Get all statements for this execution
      const { data: stmts } = await supabase
        .from("bank_statements" as any)
        .select("id")
        .eq("project_execution_id", executionId);
      const stmtIds = ((stmts as any[]) || []).map((s: any) => s.id);

      let totalCredits = 0, totalDebits = 0, txnCount = 0;
      if (stmtIds.length) {
        const { data: txns } = await supabase
          .from("bank_transactions" as any)
          .select("amount, direction")
          .in("bank_statement_id", stmtIds);
        ((txns as any[]) || []).forEach((t: any) => {
          txnCount++;
          if (t.direction === "credit") totalCredits += Number(t.amount);
          else totalDebits += Number(t.amount);
        });
      }

      const { data: recons } = await supabase
        .from("reconciliations" as any)
        .select("status")
        .eq("project_execution_id", executionId);
      const matched = ((recons as any[]) || []).filter((r: any) => r.status === "matched").length;
      const total = ((recons as any[]) || []).length;

      const { data: expenses } = await supabase
        .from("project_expenses" as any)
        .select("total_value")
        .eq("project_execution_id", executionId);
      const totalExpenses = ((expenses as any[]) || []).reduce((s: number, e: any) => s + Number(e.total_value), 0);

      return { totalCredits, totalDebits, txnCount, matched, total, totalExpenses };
    },
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const s = stats || { totalCredits: 0, totalDebits: 0, txnCount: 0, matched: 0, total: 0, totalExpenses: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Relatórios Financeiros</h1>
        <p className="text-sm text-muted-foreground">Resumo financeiro do projeto.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Entradas</span>
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(s.totalCredits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Saídas</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(s.totalDebits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saldo</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(s.totalCredits - s.totalDebits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Conciliação</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {s.total > 0 ? `${Math.round((s.matched / s.total) * 100)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{s.matched}/{s.total} itens</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Total de transações bancárias</TableCell>
                <TableCell className="text-right font-mono">{s.txnCount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Despesas lançadas</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(s.totalExpenses)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Diferença (Saídas bancárias − Despesas)</TableCell>
                <TableCell className="text-right font-mono">
                  <Badge variant="outline" className={Math.abs(s.totalDebits - s.totalExpenses) < 0.01 ? "text-emerald-600" : "text-amber-600"}>
                    {formatCurrency(s.totalDebits - s.totalExpenses)}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialReports;
