import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download, FileText, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  metadata_json: any;
  user_role: string | null;
  created_at: string;
}

const ENTITY_LABELS: Record<string, string> = {
  edital: "Edital",
  proposal: "Proposta",
  review_assignment: "Designação de Avaliador",
  review: "Avaliação",
  proposal_decision: "Parecer Final",
  scoring_criteria: "Critério de Avaliação",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "Criação",
  update: "Alteração",
  delete: "Exclusão",
};

const ROLE_LABELS: Record<string, string> = {
  icca_admin: "Admin ICCA",
  org_admin: "Admin Org",
  edital_manager: "Gestor de Edital",
  proponente: "Proponente",
  reviewer: "Avaliador",
};

const PAGE_SIZE = 25;

interface AuditLogViewerProps {
  orgId: string;
}

const AuditLogViewer = ({ orgId }: AuditLogViewerProps) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    if (entityFilter !== "all") {
      query = query.eq("entity", entityFilter);
    }

    if (search.trim()) {
      query = query.or(`action.ilike.%${search}%,entity.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar logs", description: error.message, variant: "destructive" });
    }
    if (data) {
      setLogs(data as AuditLog[]);
      setHasMore(data.length > PAGE_SIZE);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [orgId, page, entityFilter]);

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  const formatAction = (action: string) => {
    const parts = action.split(".");
    const entity = ENTITY_LABELS[parts[0]] || parts[0];
    const op = ACTION_LABELS[parts[1]] || parts[1];
    return `${entity} — ${op}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const getStatusBadge = (metadata: any) => {
    if (!metadata) return null;
    if (metadata.old_status && metadata.new_status) {
      return (
        <span className="text-xs">
          <Badge variant="outline" className="mr-1">{metadata.old_status}</Badge>
          →
          <Badge variant="default" className="ml-1">{metadata.new_status}</Badge>
        </span>
      );
    }
    return null;
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-audit-logs`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          organization_id: orgId,
          format,
          entity_filter: entityFilter !== "all" ? entityFilter : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro na exportação");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast({ title: `Exportação ${format.toUpperCase()} concluída!` });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6" /> Trilha de Auditoria
          </h2>
          <p className="text-muted-foreground">Registro cronológico e imutável de todas as ações do sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={exporting}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as entidades</SelectItem>
            <SelectItem value="edital">Editais</SelectItem>
            <SelectItem value="proposal">Propostas</SelectItem>
            <SelectItem value="review_assignment">Designações</SelectItem>
            <SelectItem value="review">Avaliações</SelectItem>
            <SelectItem value="proposal_decision">Pareceres</SelectItem>
            <SelectItem value="scoring_criteria">Critérios</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} variant="secondary" size="sm">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="w-[100px]">ID Entidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {formatAction(log.action)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.user_role ? (ROLE_LABELS[log.user_role] || log.user_role) : "Sistema"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.metadata_json)}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.entity_id?.slice(0, 8)}...
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} · {logs.length} registros
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogViewer;
