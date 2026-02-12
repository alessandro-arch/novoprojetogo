import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileText,
  LogOut,
  UserCircle,
  ClipboardCheck,
  Eye,
  Clock,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ListChecks,
  Timer,
  Search,
  Flag,
  Download,
  ShieldAlert,
  Lock,
  CheckSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/reviewer/ReviewForm";

interface Assignment {
  id: string;
  proposal_id: string;
  status: string;
  assigned_at: string;
  proposal_blind_code: string;
  edital_title: string;
  edital_id: string;
  knowledge_area: string | null;
  review_deadline: string | null;
  has_draft: boolean;
  blind_review_enabled: boolean;
}

type MetricFilter = "all" | "assigned" | "in_progress" | "submitted" | "critical";

const ReviewerPanel = () => {
  const { user, signOut } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const { toast } = useToast();

  // Filters
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortByDeadline, setSortByDeadline] = useState(true);

  // Conflict dialog
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictAssignment, setConflictAssignment] = useState<Assignment | null>(null);
  const [conflictDescription, setConflictDescription] = useState("");
  const [submittingConflict, setSubmittingConflict] = useState(false);

  // Conflicts set
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());

  const fetchAssignments = async () => {
    if (!user) return;
    setLoading(true);

    const [assignmentsRes, conflictsRes, reviewsRes] = await Promise.all([
      supabase
        .from("review_assignments")
        .select(`
          id, proposal_id, status, assigned_at, submitted_at,
          proposals!inner (
            id, edital_id, knowledge_area_id, status, blind_code,
            editais!inner ( title, review_deadline, blind_review_enabled ),
            knowledge_areas ( name )
          )
        `)
        .eq("reviewer_user_id", user.id)
        .order("assigned_at", { ascending: false }),
      supabase
        .from("reviewer_conflicts")
        .select("id, reviewer_id")
        .eq("user_id", user.id),
      supabase
        .from("reviews")
        .select("assignment_id")
        .eq("reviewer_user_id", user.id)
        .is("submitted_at", null),
    ]);

    if (assignmentsRes.error) {
      console.error("Error fetching assignments:", assignmentsRes.error);
      setLoading(false);
      return;
    }

    const draftAssignmentIds = new Set(
      (reviewsRes.data || []).map((r: any) => r.assignment_id)
    );

    // Track conflicts by user_id
    const conflictSet = new Set<string>();
    (conflictsRes.data || []).forEach((c: any) => conflictSet.add(c.id));
    setConflictIds(conflictSet);

    const mapped: Assignment[] = (assignmentsRes.data || []).map((a: any) => ({
      id: a.id,
      proposal_id: a.proposal_id,
      status: a.status,
      assigned_at: a.assigned_at,
      proposal_blind_code: a.proposals?.blind_code || "SEM-CÓDIGO",
      edital_title: a.proposals?.editais?.title || "Edital",
      edital_id: a.proposals?.edital_id || "",
      knowledge_area: a.proposals?.knowledge_areas?.name || null,
      review_deadline: a.proposals?.editais?.review_deadline || null,
      has_draft: draftAssignmentIds.has(a.id),
      blind_review_enabled: a.proposals?.editais?.blind_review_enabled ?? true,
    }));

    setAssignments(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, [user]);

  // ── Metrics ──
  const now = new Date();
  const metrics = useMemo(() => {
    const total = assignments.length;
    const inProgress = assignments.filter((a) => a.status === "in_progress").length;
    const submitted = assignments.filter((a) => a.status === "submitted").length;

    const critical = assignments.filter((a) => {
      if (a.status === "submitted") return false;
      if (!a.review_deadline) return false;
      const diff = (new Date(a.review_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 3;
    }).length;

    const deadlines = assignments
      .filter((a) => a.status !== "submitted" && a.review_deadline)
      .map((a) => (new Date(a.review_deadline!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const avgDays = deadlines.length > 0 ? Math.round(deadlines.reduce((s, d) => s + d, 0) / deadlines.length) : 0;

    return { total, inProgress, submitted, critical, avgDays };
  }, [assignments]);

  // ── Helpers ──
  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getProgress = (a: Assignment) => {
    if (a.status === "submitted") return 100;
    if (a.status === "in_progress" || a.has_draft) return 50;
    return 0;
  };

  const getDisplayStatus = (a: Assignment) => {
    const days = getDaysRemaining(a.review_deadline);
    if (days !== null && days < 0 && a.status !== "submitted") return "overdue";
    if (days !== null && days <= 3 && a.status !== "submitted") return "critical";
    return a.status;
  };

  // ── Filter logic ──
  const filteredAssignments = useMemo(() => {
    let list = [...assignments];

    // Metric filter
    if (metricFilter === "assigned") list = list.filter((a) => a.status === "assigned");
    else if (metricFilter === "in_progress") list = list.filter((a) => a.status === "in_progress");
    else if (metricFilter === "submitted") list = list.filter((a) => a.status === "submitted");
    else if (metricFilter === "critical") {
      list = list.filter((a) => {
        if (a.status === "submitted") return false;
        const d = getDaysRemaining(a.review_deadline);
        return d !== null && d <= 3;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "not_started") list = list.filter((a) => a.status === "assigned");
      else if (statusFilter === "in_progress") list = list.filter((a) => a.status === "in_progress");
      else if (statusFilter === "submitted") list = list.filter((a) => a.status === "submitted");
      else if (statusFilter === "critical") {
        list = list.filter((a) => {
          const d = getDaysRemaining(a.review_deadline);
          return d !== null && d <= 3 && a.status !== "submitted";
        });
      }
    }

    // Area filter
    if (areaFilter !== "all") list = list.filter((a) => a.knowledge_area === areaFilter);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.proposal_blind_code.toLowerCase().includes(q) ||
          a.edital_title.toLowerCase().includes(q)
      );
    }

    // Sort by deadline
    if (sortByDeadline) {
      list.sort((a, b) => {
        if (!a.review_deadline) return 1;
        if (!b.review_deadline) return -1;
        return new Date(a.review_deadline).getTime() - new Date(b.review_deadline).getTime();
      });
    }

    return list;
  }, [assignments, metricFilter, statusFilter, areaFilter, searchQuery, sortByDeadline]);

  const uniqueAreas = useMemo(
    () => [...new Set(assignments.map((a) => a.knowledge_area).filter(Boolean))] as string[],
    [assignments]
  );

  // ── Conflict handler ──
  const handleDeclareConflict = async () => {
    if (!user || !conflictAssignment) return;
    setSubmittingConflict(true);

    // Get reviewer profile org_id
    const { data: rpData } = await supabase
      .from("reviewer_profiles")
      .select("id, org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const orgId = rpData?.org_id;
    if (!orgId) {
      toast({ title: "Erro: perfil de avaliador não encontrado", variant: "destructive" });
      setSubmittingConflict(false);
      return;
    }

    // Insert conflict
    const { error: conflictError } = await supabase.from("reviewer_conflicts").insert({
      reviewer_id: rpData.id,
      user_id: user.id,
      org_id: orgId,
      conflict_type: "self_declared",
      description: conflictDescription || "Conflito de interesse declarado pelo avaliador",
      declared_by: user.id,
    });

    if (conflictError) {
      toast({ title: "Erro ao declarar conflito", description: conflictError.message, variant: "destructive" });
      setSubmittingConflict(false);
      return;
    }

    // Update assignment status
    await supabase
      .from("review_assignments")
      .update({ status: "conflict" })
      .eq("id", conflictAssignment.id);

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "conflict_declared",
      entity: "review_assignment",
      entity_id: conflictAssignment.id,
      metadata_json: {
        proposal_id: conflictAssignment.proposal_id,
        description: conflictDescription,
      },
    });

    toast({ title: "Conflito de interesse registrado com sucesso" });
    setConflictDialogOpen(false);
    setConflictDescription("");
    setConflictAssignment(null);
    setSubmittingConflict(false);
    fetchAssignments();
  };

  // ── Status badge ──
  const statusBadge = (a: Assignment) => {
    const display = getDisplayStatus(a);
    switch (display) {
      case "assigned":
        return <Badge variant="outline" className="border-info/30 bg-info/10 text-info"><Clock className="w-3 h-3 mr-1" /> Não iniciada</Badge>;
      case "in_progress":
        return <Badge className="bg-warning/10 text-warning-foreground border border-warning/30"><ClipboardCheck className="w-3 h-3 mr-1" /> Em andamento</Badge>;
      case "submitted":
        return <Badge className="bg-success/10 text-success border border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Finalizada</Badge>;
      case "conflict":
        return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground"><Flag className="w-3 h-3 mr-1" /> Conflito declarado</Badge>;
      case "overdue":
        return <Badge className="bg-destructive/10 text-destructive border border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
      case "critical":
        return <Badge className="bg-destructive/10 text-destructive border border-destructive/30"><Timer className="w-3 h-3 mr-1" /> Prazo crítico</Badge>;
      default:
        return <Badge variant="outline">{a.status}</Badge>;
    }
  };

  // ── Render ReviewForm ──
  if (selectedAssignment) {
    return (
      <ReviewForm
        assignment={{
          ...selectedAssignment,
          proposal_masked_id: selectedAssignment.proposal_blind_code,
        }}
        onBack={() => {
          setSelectedAssignment(null);
          fetchAssignments();
        }}
      />
    );
  }

  const metricCards: {
    key: MetricFilter;
    label: string;
    value: number | string;
    icon: React.ReactNode;
    colorClass: string;
    borderClass: string;
  }[] = [
    {
      key: "all",
      label: "Propostas Atribuídas",
      value: metrics.total,
      icon: <ListChecks className="w-5 h-5" />,
      colorClass: "text-info",
      borderClass: "border-info/20 hover:border-info/40",
    },
    {
      key: "in_progress",
      label: "Em Avaliação",
      value: metrics.inProgress,
      icon: <ClipboardCheck className="w-5 h-5" />,
      colorClass: "text-warning-foreground",
      borderClass: "border-warning/20 hover:border-warning/40",
    },
    {
      key: "submitted",
      label: "Concluídas",
      value: metrics.submitted,
      icon: <CheckCircle2 className="w-5 h-5" />,
      colorClass: "text-success",
      borderClass: "border-success/20 hover:border-success/40",
    },
    {
      key: "critical",
      label: "Prazo Crítico (< 3d)",
      value: metrics.critical,
      icon: <AlertTriangle className="w-5 h-5" />,
      colorClass: "text-destructive",
      borderClass: "border-destructive/20 hover:border-destructive/40",
    },
    {
      key: "all",
      label: "Prazo Médio Restante",
      value: `${metrics.avgDays}d`,
      icon: <Timer className="w-5 h-5" />,
      colorClass: "text-muted-foreground",
      borderClass: "border-border hover:border-primary/30",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading text-foreground">ProjetoGO</h1>
              <p className="text-xs text-muted-foreground">Painel do Avaliador</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                <UserCircle className="w-4 h-4 mr-1" /> Cadastro
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Blind review notice - only show if any assignment has blind review */}
      {assignments.some(a => a.blind_review_enabled) && (
        <div className="bg-accent/30 border-b border-accent/50">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-accent-foreground flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-accent-foreground">Avaliação Cega — Blind Review</p>
              <p className="text-xs text-accent-foreground/80">
                Este processo adota avaliação cega. Qualquer tentativa de identificação do proponente viola as normas do edital.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* ─── 1. Metric Cards ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {metricCards.map((m, i) => (
                <Card
                  key={i}
                  className={`cursor-pointer transition-all border ${m.borderClass} ${metricFilter === m.key && i !== 4 ? "ring-2 ring-primary/30 shadow-card" : "shadow-sm"}`}
                  onClick={() => i !== 4 && setMetricFilter(m.key)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                    <div className={m.colorClass}>{m.icon}</div>
                    <span className="text-2xl font-bold font-heading text-foreground">{m.value}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{m.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ─── Filters ─── */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="not_started">Não iniciada</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="submitted">Finalizada</SelectItem>
                  <SelectItem value="critical">Prazo crítico</SelectItem>
                </SelectContent>
              </Select>
              {uniqueAreas.length > 0 && (
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as áreas</SelectItem>
                    {uniqueAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant={sortByDeadline ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSortByDeadline(!sortByDeadline)}
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                Ordenar por prazo
              </Button>
              {metricFilter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setMetricFilter("all")}>
                  Limpar filtro
                </Button>
              )}
            </div>

            {/* ─── 2. Smart Table ─── */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Código Cego</TableHead>
                        <TableHead className="font-semibold">Área</TableHead>
                        <TableHead className="font-semibold">Progresso</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Prazo</TableHead>
                        <TableHead className="font-semibold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((a) => {
                        const days = getDaysRemaining(a.review_deadline);
                        const progress = getProgress(a);
                        const isCritical = days !== null && days <= 3 && a.status !== "submitted";
                        const isOverdue = days !== null && days < 0 && a.status !== "submitted";

                        return (
                          <TableRow key={a.id} className="group">
                            {/* Code */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                                <span className="font-mono text-sm font-bold text-primary">
                                  {a.proposal_blind_code}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                                {a.edital_title}
                              </p>
                            </TableCell>

                            {/* Area */}
                            <TableCell>
                              <span className="text-sm text-foreground">
                                {a.knowledge_area || "—"}
                              </span>
                            </TableCell>

                            {/* Progress */}
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <Progress value={progress} className="h-2 flex-1" />
                                <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                                  {progress}%
                                </span>
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell>{statusBadge(a)}</TableCell>

                            {/* Deadline */}
                            <TableCell>
                              {a.review_deadline ? (
                                <div>
                                  <p className={`text-sm font-medium ${isOverdue ? "text-destructive" : isCritical ? "text-destructive" : "text-foreground"}`}>
                                    {new Date(a.review_deadline).toLocaleDateString("pt-BR")}
                                  </p>
                                  <p className={`text-xs ${isOverdue ? "text-destructive font-semibold" : isCritical ? "text-destructive" : "text-muted-foreground"}`}>
                                    {isOverdue
                                      ? `${Math.abs(days!)}d atrasado`
                                      : `${days}d restantes`}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem prazo</span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {a.status !== "submitted" && a.status !== "conflict" ? (
                                  <>
                                    <Button size="sm" onClick={() => setSelectedAssignment(a)}>
                                      <ClipboardCheck className="w-3.5 h-3.5 mr-1" /> Avaliar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        setConflictAssignment(a);
                                        setConflictDialogOpen(true);
                                      }}
                                      title="Declarar conflito de interesse"
                                    >
                                      <Flag className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                ) : a.status === "submitted" ? (
                                  <Button size="sm" variant="outline" onClick={() => setSelectedAssignment(a)}>
                                    <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Conflito</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>

          {/* ─── 6. Compliance Sidebar ─── */}
          <aside className="w-full lg:w-72 flex-shrink-0">
            <Card className="shadow-sm sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  Governança & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-success" />
                  <span className="text-sm text-foreground">Confidencialidade ativa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-success" />
                  <span className="text-sm text-foreground">LGPD aceita</span>
                </div>
                <div className="flex items-center gap-2">
                  {conflictIds.size > 0 ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive font-medium">
                        {conflictIds.size} conflito(s) declarado(s)
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4 text-success" />
                      <span className="text-sm text-foreground">Sem conflito declarado</span>
                    </>
                  )}
                </div>

                {conflictIds.size > 0 && (
                  <div className="mt-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                    <p className="text-xs text-destructive">
                      Atenção: Você possui conflitos de interesse declarados. As propostas afetadas foram removidas da sua lista ativa.
                    </p>
                  </div>
                )}

                {/* Progress summary */}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Progresso geral</p>
                  <Progress
                    value={assignments.length > 0 ? (metrics.submitted / assignments.length) * 100 : 0}
                    className="h-2 mb-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    {metrics.submitted}/{assignments.length} avaliações concluídas
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {/* ─── Conflict Dialog ─── */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              Declarar Conflito de Interesse
            </DialogTitle>
            <DialogDescription>
              Ao declarar um conflito, esta proposta será removida da sua lista de avaliações. O administrador será notificado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {conflictAssignment && (
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-sm font-medium text-foreground">
                  Proposta: <span className="font-mono text-primary">{conflictAssignment.proposal_blind_code}</span>
                </p>
                <p className="text-xs text-muted-foreground">{conflictAssignment.edital_title}</p>
              </div>
            )}
            <Textarea
              placeholder="Descreva o motivo do conflito de interesse (opcional)..."
              value={conflictDescription}
              onChange={(e) => setConflictDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclareConflict}
              disabled={submittingConflict}
            >
              {submittingConflict && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar Conflito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewerPanel;
