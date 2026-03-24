import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Handshake, DollarSign, Users } from "lucide-react";
import { formatBRL, PARCERIA_TIPO_LABELS, PARCERIA_STATUS_LABELS, NATUREZA_LABELS } from "@/lib/fomento-utils";
import { toast } from "sonner";

interface Props {
  onNewParceria: () => void;
  onEditParceria: (id: string) => void;
}

const statusBadgeClass: Record<string, string> = {
  em_negociacao: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ativa: "bg-green-100 text-green-800 border-green-300",
  encerrada: "bg-gray-100 text-gray-600 border-gray-300",
  suspensa: "bg-red-100 text-red-800 border-red-300",
};

const FomentoParceirasList = ({ onNewParceria, onEditParceria }: Props) => {
  const { fomentoOrgId, fomentoRole, isSuperadmin } = useFomentoAuth();
  const isAuditor = fomentoRole === "auditor";
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");

  const { data: parcerias = [], isLoading } = useQuery({
    queryKey: ["fomento-parcerias", fomentoOrgId],
    queryFn: async () => {
      let q = supabase.from("fomento_parcerias").select("*").order("created_at", { ascending: false });
      if (fomentoOrgId && !isSuperadmin) q = q.eq("organization_id", fomentoOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fomento_parcerias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-parcerias"] });
      toast.success("Parceria excluída");
    },
    onError: () => toast.error("Erro ao excluir parceria"),
  });

  const filtered = parcerias.filter((p: any) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterTipo !== "all" && p.tipo !== filterTipo) return false;
    return true;
  });

  const ativas = parcerias.filter((p: any) => p.status === "ativa");
  const totalAtivas = ativas.length;
  const valorTotal = ativas.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
  const totalBeneficiarios = ativas.reduce((s: number, p: any) => s + (p.num_beneficiarios || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Parcerias</h2>
        {!isAuditor && (
          <Button onClick={onNewParceria}><Plus className="w-4 h-4 mr-1" /> Nova Parceria</Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Handshake className="w-4 h-4" /> Parcerias Ativas</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{totalAtivas}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4" /> Valor Total Captado</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{formatBRL(valorTotal)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Total de Beneficiários</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{totalBeneficiarios}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(PARCERIA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {Object.entries(PARCERIA_TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Contrato</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead className="text-right">Beneficiários</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma parceria encontrada</TableCell></TableRow>
              ) : filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.numero_contrato || "—"}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.titulo}</TableCell>
                  <TableCell>{PARCERIA_TIPO_LABELS[p.tipo] || "—"}</TableCell>
                  <TableCell>{NATUREZA_LABELS[p.modalidade] || "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{p.instituicao_nome || "—"}</TableCell>
                  <TableCell className="text-right">{p.num_beneficiarios || 0}</TableCell>
                  <TableCell className="text-right">{formatBRL(p.valor_total)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass[p.status] || ""}>
                      {PARCERIA_STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isAuditor && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => onEditParceria(p.id)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Excluir esta parceria?")) deleteMutation.mutate(p.id); }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FomentoParceirasList;
