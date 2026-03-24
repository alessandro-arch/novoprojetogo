import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Download, Pencil, Trash2, Paperclip, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL, formatDateBR, STATUS_LABELS, AREA_LABELS, FONTE_LABELS } from "@/lib/fomento-utils";

interface Props {
  onNewProject: () => void;
  onEditProject: (id: string) => void;
  onBatchImport?: () => void;
}

const FomentoProjectsList = ({ onNewProject, onEditProject, onBatchImport }: Props) => {
  const { fomentoRole, isSuperadmin, fomentoOrgId } = useFomentoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAno, setFilterAno] = useState<string>(String(new Date().getFullYear()));
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFonte, setFilterFonte] = useState("all");

  const canDelete = isSuperadmin || fomentoRole === "admin";

  const { data: projects, isLoading } = useQuery({
    queryKey: ["fomento-projects", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_projects").select("*").order("created_at", { ascending: false });
      if (!isSuperadmin && fomentoOrgId) {
        query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: docCounts } = useQuery({
    queryKey: ["fomento-doc-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_documents").select("project_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((d) => { counts[d.project_id] = (counts[d.project_id] || 0) + 1; });
      return counts;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fomento_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fomento-projects"] });
      toast({ title: "Projeto excluído com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao excluir projeto.", variant: "destructive" });
    },
  });

  const getProjectYear = (p: any): number | null => {
    if (p.ano) return p.ano;
    if (p.vigencia_inicio) return new Date(p.vigencia_inicio + "T12:00:00").getFullYear();
    if (p.created_at) return new Date(p.created_at).getFullYear();
    return null;
  };

  const availableYears = [...new Set((projects ?? []).map(getProjectYear).filter(Boolean) as number[])].sort((a, b) => b - a);

  useEffect(() => {
    if (filterAno !== "all" && availableYears.length > 0 && !availableYears.includes(Number(filterAno))) {
      setFilterAno(String(availableYears[0]));
    }
  }, [availableYears, filterAno]);

  const filtered = (projects ?? []).filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.titulo.toLowerCase().includes(q) || p.pesquisador_principal.toLowerCase().includes(q);
    const matchAno = filterAno === "all" || getProjectYear(p) === Number(filterAno);
    const matchArea = filterArea === "all" || p.area === filterArea;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchFonte = filterFonte === "all" || p.fonte === filterFonte;
    return matchSearch && matchAno && matchArea && matchStatus && matchFonte;
  });

  const exportCSV = () => {
    const headers = ["Processo Interno", "Pesquisador", "Título", "Área", "Fonte", "Financiador", "Status", "Vigência Início", "Vigência Fim", "Valor Total"];
    const rows = filtered.map((p) => [
      p.processo_uvv || "", p.pesquisador_principal, p.titulo,
      AREA_LABELS[p.area || ""] || p.area || "", FONTE_LABELS[p.fonte || ""] || p.fonte || "",
      p.orgao_financiador || "", STATUS_LABELS[p.status || ""] || p.status || "",
      formatDateBR(p.vigencia_inicio), formatDateBR(p.vigencia_fim),
      p.valor_total != null ? String(p.valor_total) : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fomento-projetos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado com sucesso." });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-heading text-foreground">Projetos</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
            <Download className="w-4 h-4" /> CSV
          </Button>
          {onBatchImport && (
            <Button variant="outline" size="sm" onClick={onBatchImport} className="gap-1">
              <Upload className="w-4 h-4" /> Importar em Lote
            </Button>
          )}
          <Button size="sm" onClick={onNewProject} className="gap-1">
            <Plus className="w-4 h-4" /> Novo Projeto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="font-semibold border-primary/30 bg-primary/5">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar título ou pesquisador…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {Object.entries(AREA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterFonte} onValueChange={setFilterFonte}>
              <SelectTrigger><SelectValue placeholder="Fonte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fontes</SelectItem>
                {Object.entries(FONTE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo Interno</TableHead>
                  <TableHead>Pesquisador</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Financiador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Nenhum projeto encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.processo_uvv || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{p.pesquisador_principal}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">{p.titulo}</TableCell>
                      <TableCell><Badge variant="outline">{AREA_LABELS[p.area || ""] || p.area || "—"}</Badge></TableCell>
                      <TableCell>{FONTE_LABELS[p.fonte || ""] || p.fonte || "—"}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{p.orgao_financiador || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{STATUS_LABELS[p.status || ""] || p.status || "—"}</Badge></TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateBR(p.vigencia_inicio)} — {formatDateBR(p.vigencia_fim)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(Number(p.valor_total))}</TableCell>
                      <TableCell>
                        {(docCounts?.[p.id] || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm"><Paperclip className="w-3.5 h-3.5" />{docCounts[p.id]}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onEditProject(p.id)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O projeto "{p.titulo}" e todos os dados associados serão removidos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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

export default FomentoProjectsList;
