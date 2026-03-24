import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Download, Pencil, Trash2, Upload, GraduationCap } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatBRL, formatDateBR, MODALIDADE_LABELS, BOLSISTA_STATUS_LABELS } from "@/lib/fomento-utils";

interface Props {
  onNewBolsista: () => void;
  onEditBolsista: (id: string) => void;
  onBatchImport?: () => void;
}

const FomentoBolsistasList = ({ onNewBolsista, onEditBolsista, onBatchImport }: Props) => {
  const { fomentoRole, isSuperadmin, fomentoOrgId } = useFomentoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterModalidade, setFilterModalidade] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOrientador, setFilterOrientador] = useState("all");
  const [sortOrder, setSortOrder] = useState<"default" | "asc" | "desc">("default");

  const canDelete = isSuperadmin || fomentoRole === "admin";
  const isAuditor = fomentoRole === "auditor";

  const { data: bolsistas, isLoading } = useQuery({
    queryKey: ["fomento-bolsistas", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_bolsistas" as any).select("*").order("created_at", { ascending: false });
      if (!isSuperadmin && fomentoOrgId) {
        query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fomento_bolsistas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-bolsistas"] });
      toast({ title: "Bolsista excluído com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao excluir bolsista.", variant: "destructive" });
    },
  });

  const items = bolsistas ?? [];
  const orientadores = [...new Set(items.map((b) => b.orientador).filter(Boolean))].sort();

  const filtered = items.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.nome_bolsista?.toLowerCase().includes(q) || b.orientador?.toLowerCase().includes(q) || b.titulo_plano?.toLowerCase().includes(q);
    const matchMod = filterModalidade === "all" || b.modalidade === filterModalidade;
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    const matchOrient = filterOrientador === "all" || b.orientador === filterOrientador;
    return matchSearch && matchMod && matchStatus && matchOrient;
  });

  const sorted = sortOrder === "default" ? filtered : [...filtered].sort((a, b) => {
    const nameA = (a.nome_bolsista || "").toLowerCase();
    const nameB = (b.nome_bolsista || "").toLowerCase();
    return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });

  const exportCSV = () => {
    const headers = ["Bolsista", "Orientador", "Modalidade", "Edital", "Cotas", "Início", "Fim", "Valor/mês", "Total", "Status"];
    const rows = sorted.map((b) => [
      b.nome_bolsista, b.orientador || "", MODALIDADE_LABELS[b.modalidade || ""] || b.modalidade || "",
      b.edital || "", b.cotas_total ?? "", formatDateBR(b.data_inicio), formatDateBR(b.data_fim),
      b.valor_mensal != null ? String(b.valor_mensal) : "", b.valor_total != null ? String(b.valor_total) : "",
      BOLSISTA_STATUS_LABELS[b.status || ""] || b.status || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fomento-bolsistas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado com sucesso." });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full rounded-lg" /><Skeleton className="h-96 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-heading text-foreground">Bolsistas</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1"><Download className="w-4 h-4" /> CSV</Button>
          {!isAuditor && onBatchImport && (
            <Button variant="outline" size="sm" onClick={onBatchImport} className="gap-1">
              <Upload className="w-4 h-4" /> Importar em Lote
            </Button>
          )}
          {!isAuditor && (
            <Button size="sm" onClick={onNewBolsista} className="gap-1"><Plus className="w-4 h-4" /> Novo Bolsista</Button>
          )}
        </div>
      </div>

      {/* KPI: Bolsas Mestrado/Doutorado por PPG */}
      {(() => {
        const mdBolsistas = items.filter((b) => b.status === "ativo" && (b.modalidade === "mestrado" || b.modalidade === "doutorado"));
        const ppgMap = new Map<string, { mestrado: number; doutorado: number }>();
        mdBolsistas.forEach((b) => {
          const ppg = b.ppg_nome || "Sem PPG";
          if (!ppgMap.has(ppg)) ppgMap.set(ppg, { mestrado: 0, doutorado: 0 });
          const entry = ppgMap.get(ppg)!;
          if (b.modalidade === "mestrado") entry.mestrado++;
          else entry.doutorado++;
        });
        const ppgData = Array.from(ppgMap.entries())
          .map(([ppg, counts]) => ({ ppg, ...counts, total: counts.mestrado + counts.doutorado }))
          .sort((a, b) => b.total - a.total);

        return ppgData.length > 0 ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                Bolsas Mestrado / Doutorado por PPG
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ppgData.map((d) => (
                  <div key={d.ppg} className="rounded-lg border bg-card p-3 space-y-1">
                    <p className="text-xs font-medium text-foreground truncate" title={d.ppg}>{d.ppg}</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-xl font-bold text-foreground">{d.total}</span>
                      <span className="text-xs text-muted-foreground">
                        {d.mestrado > 0 && `${d.mestrado} Mest.`}
                        {d.mestrado > 0 && d.doutorado > 0 && " · "}
                        {d.doutorado > 0 && `${d.doutorado} Dout.`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null;
      })()}

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar bolsista, orientador…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterModalidade} onValueChange={setFilterModalidade}>
              <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas modalidades</SelectItem>
                {Object.entries(MODALIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(BOLSISTA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterOrientador} onValueChange={setFilterOrientador}>
              <SelectTrigger><SelectValue placeholder="Orientador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos orientadores</SelectItem>
                {orientadores.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "default" | "asc" | "desc")}>
              <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Mais recentes</SelectItem>
                <SelectItem value="asc">Nome A → Z</SelectItem>
                <SelectItem value="desc">Nome Z → A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bolsista</TableHead>
                  <TableHead>Orientador</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Edital</TableHead>
                  <TableHead>Cotas</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Valor/mês</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum bolsista encontrado.</TableCell></TableRow>
                ) : sorted.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{b.nome_bolsista}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{b.orientador || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{MODALIDADE_LABELS[b.modalidade || ""] || b.modalidade || "—"}</Badge></TableCell>
                    <TableCell className="max-w-[120px] truncate">{b.edital || "—"}</TableCell>
                    <TableCell>{b.cotas_total ?? "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateBR(b.data_inicio)} — {formatDateBR(b.data_fim)}</TableCell>
                    <TableCell className="text-right font-mono">{b.valor_mensal != null ? formatBRL(Number(b.valor_mensal)) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{b.valor_total != null ? formatBRL(Number(b.valor_total)) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "ativo" ? "default" : b.status === "concluido" ? "secondary" : "destructive"}>
                        {BOLSISTA_STATUS_LABELS[b.status || ""] || b.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!isAuditor && (
                          <Button variant="ghost" size="icon" onClick={() => onEditBolsista(b.id)}><Pencil className="w-4 h-4" /></Button>
                        )}
                        {canDelete && !isAuditor && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir bolsista?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita. O bolsista "{b.nome_bolsista}" será removido permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FomentoBolsistasList;
