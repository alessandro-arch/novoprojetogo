import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FolderOpen, ArrowLeft, Eye, FileText, Download, Search, ScrollText, PenLine, ChevronLeft, ChevronRight } from "lucide-react";
import ProposalForm from "@/components/proponente/ProposalForm";
import { generateProposalPdf } from "@/lib/generate-proposal-pdf";
import { generateSubmissionReceipt } from "@/lib/generate-submission-receipt";
import { toast } from "sonner";

interface Props {
  orgId: string;
  userId: string;
}

type StatusGroup = "all" | "draft" | "submitted" | "completed";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; group: StatusGroup }> = {
  draft: { label: "Em Redação", variant: "outline", group: "draft" },
  submitted: { label: "Submetida", variant: "default", group: "submitted" },
  under_review: { label: "Em Avaliação", variant: "secondary", group: "submitted" },
  accepted: { label: "Aprovada", variant: "default", group: "completed" },
  rejected: { label: "Rejeitada", variant: "destructive", group: "completed" },
};

const PAGE_SIZES = [10, 20, 50] as const;

const MinhasPropostas = ({ orgId, userId }: Props) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusGroup>("all");
  const [editalFilter, setEditalFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(0);

  const { data: proposals, isLoading, refetch } = useQuery({
    queryKey: ["my-proposals-full", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, editais(title, end_date)")
        .eq("proponente_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Unique editais for filter dropdown
  const editalOptions = useMemo(() => {
    if (!proposals) return [];
    const map = new Map<string, string>();
    for (const p of proposals) {
      const title = (p.editais as any)?.title;
      if (title && !map.has(p.edital_id)) {
        map.set(p.edital_id, title);
      }
    }
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [proposals]);

  // Filtered + paginated
  const filtered = useMemo(() => {
    if (!proposals) return [];
    return proposals.filter((p) => {
      const st = STATUS_MAP[p.status];
      if (statusFilter !== "all" && st?.group !== statusFilter) return false;
      if (editalFilter !== "all" && p.edital_id !== editalFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const editalTitle = ((p.editais as any)?.title ?? "").toLowerCase();
        if (!editalTitle.includes(q)) return false;
      }
      return true;
    });
  }, [proposals, statusFilter, editalFilter, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(0);
  };

  // PDF download helpers
  const handleDownloadReceipt = async (proposal: any) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, cpf, research_area_cnpq")
        .eq("user_id", userId)
        .single();

      generateSubmissionReceipt({
        protocol: proposal.blind_code ?? "—",
        editalTitle: (proposal.editais as any)?.title ?? "Edital",
        proponenteName: profile?.full_name ?? "—",
        proponenteEmail: profile?.email ?? "—",
        proponenteCpf: profile?.cpf ?? undefined,
        cnpqArea: profile?.research_area_cnpq ?? undefined,
        submittedAt: proposal.submitted_at
          ? new Date(proposal.submitted_at).toLocaleString("pt-BR")
          : "—",
        submissionId: proposal.id,
      });
    } catch {
      toast.error("Erro ao gerar recibo.");
    }
  };

  const handleDownloadProposalPdf = async (proposal: any) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, research_area_cnpq")
        .eq("user_id", userId)
        .single();

      const { data: answersRow } = await supabase
        .from("proposal_answers")
        .select("answers_json")
        .eq("proposal_id", proposal.id)
        .maybeSingle();

      const { data: schema } = await supabase
        .from("edital_form_schemas")
        .select("schema_json")
        .eq("edital_id", proposal.edital_id)
        .eq("is_active", true)
        .maybeSingle();

      const answers = (answersRow?.answers_json ?? {}) as Record<string, string>;
      const fields = (schema?.schema_json ?? []) as any[];

      generateProposalPdf({
        editalTitle: (proposal.editais as any)?.title ?? "Edital",
        proponenteName: profile?.full_name ?? "—",
        proponenteEmail: profile?.email ?? "—",
        protocol: proposal.blind_code ?? "—",
        submittedAt: proposal.submitted_at
          ? new Date(proposal.submitted_at).toLocaleString("pt-BR")
          : "—",
        cnpqArea: profile?.research_area_cnpq ?? undefined,
        submissionId: proposal.id,
        sections: [
          {
            title: "Respostas do Formulário",
            questions: fields.map((f: any) => ({
              label: f.label,
              isRequired: f.required,
              answer: answers[f.id] ?? "",
            })),
          },
        ],
      });
    } catch {
      toast.error("Erro ao gerar PDF da proposta.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Proposal detail view
  if (selectedProposalId) {
    const proposal = proposals?.find((p) => p.id === selectedProposalId);
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedProposalId(null); refetch(); }}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <ProposalForm
          proposalId={selectedProposalId}
          editalId={proposal?.edital_id ?? ""}
          orgId={orgId}
          userId={userId}
          readOnly={proposal?.status !== "draft"}
        />
      </div>
    );
  }

  // Empty state
  if (!proposals || proposals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Minhas Propostas</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas submissões.</p>
        </div>
        <div className="text-center py-16">
          <FolderOpen className="w-14 h-14 mx-auto text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground mb-4">Você ainda não possui propostas.</p>
          <Button variant="default" onClick={() => {
            // Navigate to editais tab - parent controls this
            const event = new CustomEvent("navigate-proponente", { detail: "editais" });
            window.dispatchEvent(event);
          }}>
            <ScrollText className="w-4 h-4 mr-2" />
            Ver Editais Abertos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Minhas Propostas</h1>
        <p className="text-muted-foreground mt-1">
          {filtered.length} proposta{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por edital..."
                value={searchText}
                onChange={(e) => handleFilterChange(setSearchText, e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v as StatusGroup)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="draft">Em Redação</SelectItem>
                <SelectItem value="submitted">Submetida</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editalFilter} onValueChange={(v) => handleFilterChange(setEditalFilter, v)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Edital" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Editais</SelectItem>
                {editalOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* No results for filters */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma proposta encontrada com os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Edital / Chamada</TableHead>
                    <TableHead className="w-[120px]">Data</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => {
                    const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "outline" as const, group: "draft" as const };
                    const editalTitle = (p.editais as any)?.title ?? "Edital";
                    const dateStr = p.submitted_at
                      ? new Date(p.submitted_at).toLocaleDateString("pt-BR")
                      : new Date(p.created_at).toLocaleDateString("pt-BR");
                    const dateLabel = p.submitted_at ? "Enviada" : "Criada";

                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{editalTitle}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-muted-foreground text-xs">{dateLabel}</span>
                            <br />
                            {dateStr}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <ProposalActions
                            proposal={p}
                            statusGroup={st.group}
                            onOpen={() => setSelectedProposalId(p.id)}
                            onDownloadReceipt={() => handleDownloadReceipt(p)}
                            onDownloadPdf={() => handleDownloadProposalPdf(p)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((p) => {
              const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "outline" as const, group: "draft" as const };
              const editalTitle = (p.editais as any)?.title ?? "Edital";
              const dateStr = p.submitted_at
                ? new Date(p.submitted_at).toLocaleDateString("pt-BR")
                : new Date(p.created_at).toLocaleDateString("pt-BR");

              return (
                <Card key={p.id} className="hover:shadow-card-hover transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm leading-tight">{editalTitle}</CardTitle>
                      <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {p.submitted_at ? "Enviada" : "Criada"} em {dateStr}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ProposalActions
                        proposal={p}
                        statusGroup={st.group}
                        onOpen={() => setSelectedProposalId(p.id)}
                        onDownloadReceipt={() => handleDownloadReceipt(p)}
                        onDownloadPdf={() => handleDownloadProposalPdf(p)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Exibir</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>por página</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Extracted action buttons component
function ProposalActions({
  proposal,
  statusGroup,
  onOpen,
  onDownloadReceipt,
  onDownloadPdf,
}: {
  proposal: any;
  statusGroup: StatusGroup;
  onOpen: () => void;
  onDownloadReceipt: () => void;
  onDownloadPdf: () => void;
}) {
  if (statusGroup === "draft") {
    return (
      <Button size="sm" onClick={onOpen}>
        <PenLine className="w-4 h-4 mr-1" />
        Continuar
      </Button>
    );
  }

  if (statusGroup === "submitted") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <Button size="sm" variant="outline" onClick={onOpen}>
          <Eye className="w-4 h-4 mr-1" />
          Ver Detalhes
        </Button>
        {proposal.submitted_at && (
          <Button size="sm" variant="ghost" onClick={onDownloadReceipt} title="Baixar recibo">
            <Download className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  // completed
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <Button size="sm" variant="outline" onClick={onOpen}>
        <Eye className="w-4 h-4 mr-1" />
        Ver Parecer
      </Button>
      <Button size="sm" variant="ghost" onClick={onDownloadPdf} title="Baixar proposta PDF">
        <FileText className="w-4 h-4" />
      </Button>
      {proposal.submitted_at && (
        <Button size="sm" variant="ghost" onClick={onDownloadReceipt} title="Baixar recibo">
          <Download className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export default MinhasPropostas;
