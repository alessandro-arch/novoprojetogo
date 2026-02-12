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
import { Plus, FileText, Upload, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  executionId: string;
  userId: string;
}

const BankStatementsManager = ({ executionId, userId }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_bank_accounts" as any)
        .select("id, bank_name, account_number")
        .eq("project_execution_id", executionId);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: statements, isLoading } = useQuery({
    queryKey: ["bank-statements", executionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statements" as any)
        .select("*, project_bank_accounts(bank_name, account_number)")
        .eq("project_execution_id", executionId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleUpload = async () => {
    if (!selectedAccountId || !file) return;
    setUploading(true);
    try {
      const filePath = `${executionId}/${selectedAccountId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("bank-statements")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("bank-statements").getPublicUrl(filePath);

      const { error } = await supabase
        .from("bank_statements" as any)
        .insert({
          project_execution_id: executionId,
          bank_account_id: selectedAccountId,
          file_url: urlData.publicUrl,
          statement_period_start: periodStart || null,
          statement_period_end: periodEnd || null,
          uploaded_by: userId,
          needs_review: true,
        } as any);
      if (error) throw error;

      toast.success("Extrato importado com sucesso!");
      setOpen(false);
      setFile(null);
      setSelectedAccountId("");
      setPeriodStart("");
      setPeriodEnd("");
      qc.invalidateQueries({ queryKey: ["bank-statements", executionId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar extrato");
    } finally {
      setUploading(false);
    }
  };

  const confirmStatement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_statements" as any)
        .update({ needs_review: false, confirmed_by: userId, confirmed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Extrato confirmado");
      qc.invalidateQueries({ queryKey: ["bank-statements", executionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Extratos Bancários</h1>
          <p className="text-sm text-muted-foreground">Importe e gerencie extratos do projeto.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5" disabled={!accounts?.length}>
              <Upload className="w-4 h-4" /> Importar Extrato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Importar Extrato PDF</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Conta Bancária *</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Período Início</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Período Fim</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Arquivo PDF *</Label>
                <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <Button onClick={handleUpload} disabled={uploading || !selectedAccountId || !file} className="w-full">
                {uploading ? "Enviando..." : "Importar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!accounts?.length && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Cadastre uma conta bancária primeiro para importar extratos.</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : !statements?.length ? (
        accounts?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhum extrato importado.</p>
            </CardContent>
          </Card>
        ) : null
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importado em</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.project_bank_accounts?.bank_name} — {s.project_bank_accounts?.account_number}
                    </TableCell>
                    <TableCell>
                      {s.statement_period_start && s.statement_period_end
                        ? `${format(new Date(s.statement_period_start), "dd/MM/yyyy")} — ${format(new Date(s.statement_period_end), "dd/MM/yyyy")}`
                        : "Não informado"}
                    </TableCell>
                    <TableCell>
                      {s.needs_review ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">Pendente revisão</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700">Confirmado</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(s.uploaded_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      {s.needs_review && (
                        <Button variant="ghost" size="icon" onClick={() => confirmStatement.mutate(s.id)} title="Confirmar extrato">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
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

export default BankStatementsManager;
