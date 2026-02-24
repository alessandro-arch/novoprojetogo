import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Search, Download, FileText, Shield, ChevronLeft, ChevronRight, ChevronDown, Link2 } from "lucide-react";
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
  actor_role: string | null;
  entity_type: string | null;
  diff: any;
  log_hash: string | null;
  prev_log_hash: string | null;
  created_at: string;
}

const ENTITY_LABELS: Record<string, string> = {
  edital: "Edital",
  proposal: "Proposta",
  review_assignment: "Designação de Avaliador",
  review: "Avaliação",
  review_score: "Nota de Avaliação",
  proposal_decision: "Parecer Final",
  scoring_criteria: "Critério de Avaliação",
  submission: "Submissão",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
  STATUS_CHANGE: "Mudança de Status",
  SUBMIT: "Submissão",
  EXPORT_PDF: "Exportação PDF",
  INTEGRITY_VERIFIED: "Integridade OK",
  INTEGRITY_MISMATCH: "Integridade Comprometida",
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

const ACTION_FILTER_OPTIONS = [
  { value: "all", label: "Todas as ações" },
  { value: "CREATE", label: "Criação" },
  { value: "UPDATE", label: "Alteração" },
  { value: "DELETE", label: "Exclusão" },
  { value: "STATUS_CHANGE", label: "Mudança de Status" },
  { value: "SUBMIT", label: "Submissão" },
  { value: "EXPORT_PDF", label: "Exportação PDF" },
  { value: "INTEGRITY", label: "Verificação de Integridade" },
];

const PAGE_SIZE = 25;

interface AuditLogViewerProps {
  orgId: string;
  entityId?: string;
  entityType?: string;
}

const AuditLogViewer = ({ orgId, entityId, entityType }: AuditLogViewerProps) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    let query: any = supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    } else if (entityFilter !== "all") {
      query = query.or(`entity.eq.${entityFilter},entity_type.eq.${entityFilter}`);
    }

    if (actionFilter !== "all") {
      if (actionFilter === "INTEGRITY") {
        query = query.or("action.eq.INTEGRITY_VERIFIED,action.eq.INTEGRITY_MISMATCH");
      } else {
        query = query.eq("action", actionFilter);
      }
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
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [orgId, page, entityFilter, actionFilter, entityId, entityType]);

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  const formatAction = (log: AuditLog) => {
    const action = log.action || "";
    // New-style actions (uppercase)
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    // Legacy style: entity.operation
    const parts = action.split(".");
    if (parts.length === 2) {
      const entity = ENTITY_LABELS[parts[0]] || parts[0];
      const op = ACTION_LABELS[parts[1]] || parts[1];
      return `${entity} — ${op}`;
    }
    return action;
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
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format === "pdf" ? "html" : format}`;
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
      {!entityId && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-heading text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 md:w-6 md:h-6" /> Trilha de Auditoria
            </h2>
            <p className="text-sm text-muted-foreground">Registro cronológico e imutável de todas as ações do sistema.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={exporting} className="min-h-[44px]">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={exporting} className="min-h-[44px]">
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end flex-wrap">
        <div className="flex-1 min-w-0">
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
        {!entityType && (
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas entidades</SelectItem>
              <SelectItem value="edital">Editais</SelectItem>
              <SelectItem value="proposal">Propostas</SelectItem>
              <SelectItem value="submission">Submissões</SelectItem>
              <SelectItem value="review">Avaliações</SelectItem>
              <SelectItem value="proposal_decision">Pareceres</SelectItem>
              <SelectItem value="scoring_criteria">Critérios</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTER_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} variant="secondary" size="sm" className="min-h-[44px]">
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
          <div className="border border-border rounded-xl overflow-hidden mobile-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="w-[80px]">Diff</TableHead>
                  <TableHead className="w-[90px]">Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {formatAction(log)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.actor_role
                          ? (ROLE_LABELS[log.actor_role] || log.actor_role)
                          : log.user_role
                          ? (ROLE_LABELS[log.user_role] || log.user_role)
                          : "Sistema"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.metadata_json)}
                    </TableCell>
                    <TableCell>
                      {log.diff && Object.keys(log.diff).length > 0 ? (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                              <ChevronDown className="w-3 h-3 mr-1" />
                              {Object.keys(log.diff).length}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1">
                            <div className="text-xs font-mono bg-muted/50 rounded p-2 max-w-[300px] overflow-auto max-h-[200px]">
                              {Object.entries(log.diff).map(([key, val]: [string, any]) => (
                                <div key={key} className="mb-1">
                                  <span className="font-semibold text-foreground">{key}:</span>{" "}
                                  <span className="text-destructive">{JSON.stringify(val?.old)}</span>
                                  {" → "}
                                  <span className="text-primary">{JSON.stringify(val?.new)}</span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {log.log_hash ? (
                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1" title={log.log_hash}>
                          <Link2 className="w-3 h-3" />
                          {log.log_hash.slice(0, 8)}…
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} · {logs.length} registros
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="flex-1 sm:flex-initial min-h-[44px]">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="flex-1 sm:flex-initial min-h-[44px]">
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
