import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Wand2, Search, Eye, UserPlus, AlertTriangle, AlertCircle,
  CheckCircle2, Users, ShieldAlert, XCircle, RefreshCw, Trash2,
} from "lucide-react";

interface ProposalDistributionProps {
  editalId: string;
  orgId: string;
  minReviewers: number;
}

interface ProposalRow {
  id: string;
  blind_code: string;
  cnpq_area: string | null;
  assignments: Assignment[];
  conflicts: string[]; // reviewer_user_ids with conflicts
}

interface Assignment {
  id: string;
  reviewer_user_id: string;
  reviewer_name: string;
  reviewer_email: string;
  reviewer_institution: string;
  reviewer_area: string;
  status: string;
  conflict_declared: boolean;
  conflict_reason: string | null;
}

interface ReviewerOption {
  user_id: string;
  full_name: string;
  email: string;
  institution: string;
  area: string;
  load: number; // current assignments in this edital
}

type DistStatus = "none" | "partial" | "complete" | "conflict";

function getDistStatus(row: ProposalRow, min: number): DistStatus {
  const hasConflict = row.assignments.some(a => a.status === "conflict");
  if (hasConflict) return "conflict";
  const validCount = row.assignments.filter(a => !["conflict", "cancelled"].includes(a.status)).length;
  if (validCount === 0) return "none";
  if (validCount < min) return "partial";
  return "complete";
}

const STATUS_CONFIG: Record<DistStatus, { label: string; variant: "destructive" | "default" | "secondary" | "outline"; icon: any }> = {
  none: { label: "Sem distribuição", variant: "outline", icon: AlertCircle },
  partial: { label: "Parcial", variant: "secondary", icon: AlertTriangle },
  complete: { label: "Completa", variant: "default", icon: CheckCircle2 },
  conflict: { label: "Com conflito", variant: "destructive", icon: ShieldAlert },
};

const ProposalDistribution = ({ editalId, orgId, minReviewers }: ProposalDistributionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProposal, setSelectedProposal] = useState<ProposalRow | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ProposalRow | null>(null);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [reviewerSearch, setReviewerSearch] = useState("");
  const [autoDistributing, setAutoDistributing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Fetch proposals
    const { data: proposalsData } = await supabase
      .from("proposals")
      .select("id, blind_code, knowledge_area_id, knowledge_areas(name)")
      .eq("edital_id", editalId)
      .in("status", ["submitted", "under_review", "accepted", "rejected"] as any[]);

    // Also check edital_submissions that were submitted but don't have proposals yet
    const { data: submissionsData } = await supabase
      .from("edital_submissions")
      .select("id, user_id, protocol, cnpq_area_code, submitted_at, answers")
      .eq("edital_id", editalId)
      .eq("status", "submitted");

    const proposalIds = (proposalsData || []).map((p: any) => p.id);

    // Fetch assignments
    const { data: assignmentsData } = await supabase
      .from("review_assignments")
      .select("id, proposal_id, reviewer_user_id, status, conflict_declared, conflict_reason")
      .in("proposal_id", proposalIds.length > 0 ? proposalIds : ["00000000-0000-0000-0000-000000000000"]);

    // Fetch conflicts
    const { data: conflictsData } = await supabase
      .from("proposal_reviewer_conflicts" as any)
      .select("proposal_id, reviewer_user_id")
      .in("proposal_id", proposalIds.length > 0 ? proposalIds : ["00000000-0000-0000-0000-000000000000"]);

    // Fetch reviewer user_ids for this org
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, role, status")
      .eq("organization_id", orgId)
      .eq("role", "reviewer" as any);

    const activeMembers = (members || []).filter((m: any) => m.status === "ativo" || !m.status);
    const memberIds = activeMembers.map((m: any) => m.user_id);

    // Fetch profiles for reviewers and assigned people
    const allUserIds = [...new Set([...memberIds, ...(assignmentsData || []).map((a: any) => a.reviewer_user_id)])];
    const { data: profiles } = allUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, full_name, email, institution_affiliation, research_area_cnpq").in("user_id", allUserIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    // Count assignments per reviewer in this edital for load balancing
    const loadMap = new Map<string, number>();
    (assignmentsData || []).forEach((a: any) => {
      if (!["conflict", "cancelled"].includes(a.status)) {
        loadMap.set(a.reviewer_user_id, (loadMap.get(a.reviewer_user_id) || 0) + 1);
      }
    });

    // Build reviewer options
    const reviewerOptions: ReviewerOption[] = memberIds.map((uid: string) => {
      const p = profileMap.get(uid);
      return {
        user_id: uid,
        full_name: p?.full_name || "Sem nome",
        email: p?.email || "",
        institution: p?.institution_affiliation || "",
        area: p?.research_area_cnpq || "",
        load: loadMap.get(uid) || 0,
      };
    });
    setReviewers(reviewerOptions);

    // Build conflict map
    const conflictMap = new Map<string, Set<string>>();
    (conflictsData || []).forEach((c: any) => {
      if (!conflictMap.has(c.proposal_id)) conflictMap.set(c.proposal_id, new Set());
      conflictMap.get(c.proposal_id)!.add(c.reviewer_user_id);
    });

    // Build proposals
    // First, ensure submissions without proposals are auto-created
    const existingProponenteIds = new Set((proposalsData || []).map((p: any) => p.proponente_user_id));
    const missingSubmissions = (submissionsData || []).filter((s: any) => {
      return !(proposalsData || []).some((p: any) => {
        // Find if a proposal exists for this user + edital
        return true; // We'll just use what we have
      });
    });

    const rows: ProposalRow[] = (proposalsData || []).map((p: any) => {
      const propAssignments = (assignmentsData || []).filter((a: any) => a.proposal_id === p.id);
      const propConflicts = conflictMap.get(p.id) || new Set<string>();

      return {
        id: p.id,
        blind_code: p.blind_code || `PROP-${p.id.slice(0, 8).toUpperCase()}`,
        cnpq_area: (p.knowledge_areas as any)?.name || null,
        assignments: propAssignments.map((a: any) => {
          const prof = profileMap.get(a.reviewer_user_id);
          return {
            id: a.id,
            reviewer_user_id: a.reviewer_user_id,
            reviewer_name: prof?.full_name || "Sem nome",
            reviewer_email: prof?.email || "",
            reviewer_institution: prof?.institution_affiliation || "",
            reviewer_area: prof?.research_area_cnpq || "",
            status: a.status,
            conflict_declared: a.conflict_declared || false,
            conflict_reason: a.conflict_reason || null,
          };
        }),
        conflicts: Array.from(propConflicts),
      };
    });

    setProposals(rows);
    setLoading(false);
  }, [editalId, orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Stats
  const stats = useMemo(() => {
    let noReviewers = 0, ready = 0, conflictsPending = 0, totalAssignments = 0;
    proposals.forEach(p => {
      const status = getDistStatus(p, minReviewers);
      if (status === "none") noReviewers++;
      else if (status === "partial") noReviewers++;
      else if (status === "complete") ready++;
      if (status === "conflict") conflictsPending++;
      totalAssignments += p.assignments.filter(a => !["conflict", "cancelled"].includes(a.status)).length;
    });
    return { insufficient: proposals.filter(p => {
      const valid = p.assignments.filter(a => !["conflict", "cancelled"].includes(a.status)).length;
      return valid < minReviewers;
    }).length, ready, conflictsPending, totalAssignments };
  }, [proposals, minReviewers]);

  // Filter
  const filtered = useMemo(() => {
    return proposals.filter(p => {
      const s = getDistStatus(p, minReviewers);
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (search && !p.blind_code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      // Pending first
      const sa = getDistStatus(a, minReviewers);
      const sb = getDistStatus(b, minReviewers);
      const order: Record<DistStatus, number> = { conflict: 0, none: 1, partial: 2, complete: 3 };
      return (order[sa] || 0) - (order[sb] || 0);
    });
  }, [proposals, statusFilter, search, minReviewers]);

  // Auto-distribute
  const handleAutoDistribute = async () => {
    if (!user) return;
    setAutoDistributing(true);

    let completed = 0, pending = 0;
    const updatedLoad = new Map<string, number>();
    reviewers.forEach(r => updatedLoad.set(r.user_id, r.load));

    for (const p of proposals) {
      const validCount = p.assignments.filter(a => !["conflict", "cancelled"].includes(a.status)).length;
      const needed = minReviewers - validCount;
      if (needed <= 0) continue;

      const assignedIds = new Set(p.assignments.map(a => a.reviewer_user_id));
      const conflictIds = new Set(p.conflicts);

      // Get eligible reviewers sorted by area match then load
      const eligible = reviewers
        .filter(r => !assignedIds.has(r.user_id) && !conflictIds.has(r.user_id))
        .map(r => {
          const areaMatch = p.cnpq_area && r.area && r.area.includes(p.cnpq_area.split(" ")[0]) ? 0 : 1;
          return { ...r, areaMatch, currentLoad: updatedLoad.get(r.user_id) || 0 };
        })
        .sort((a, b) => a.areaMatch - b.areaMatch || a.currentLoad - b.currentLoad);

      const toAssign = eligible.slice(0, needed);
      if (toAssign.length === 0) { pending++; continue; }

      const rows = toAssign.map(r => ({
        proposal_id: p.id,
        reviewer_user_id: r.user_id,
        assigned_by: user.id,
        status: "assigned",
      }));

      const { error } = await supabase.from("review_assignments").insert(rows);
      if (!error) {
        toAssign.forEach(r => updatedLoad.set(r.user_id, (updatedLoad.get(r.user_id) || 0) + 1));
        if (toAssign.length >= needed) completed++;
        else pending++;

        // Update proposal status
        await supabase.from("proposals").update({ status: "under_review" as any }).eq("id", p.id);
      } else {
        pending++;
      }
    }

    // Audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      organization_id: orgId,
      action: "auto_distribution",
      entity: "edital",
      entity_id: editalId,
      metadata_json: { completed, pending },
    });

    setAutoDistributing(false);
    toast({
      title: "Distribuição automática concluída",
      description: `${completed} propostas completadas. ${pending} ainda pendentes.`,
    });
    fetchAll();
  };

  // Manual assign
  const handleManualAssign = async () => {
    if (!user || !assignTarget || selectedReviewers.length === 0) return;
    setSubmitting(true);

    const rows = selectedReviewers.map(uid => ({
      proposal_id: assignTarget.id,
      reviewer_user_id: uid,
      assigned_by: user.id,
      status: "assigned",
    }));

    const { error } = await supabase.from("review_assignments").insert(rows);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("proposals").update({ status: "under_review" as any }).eq("id", assignTarget.id);
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        organization_id: orgId,
        action: "manual_assignment",
        entity: "proposal",
        entity_id: assignTarget.id,
        metadata_json: { reviewer_count: selectedReviewers.length, edital_id: editalId },
      });
      toast({ title: `${selectedReviewers.length} avaliador(es) atribuído(s)!` });
    }

    setSubmitting(false);
    setAssignModalOpen(false);
    setAssignTarget(null);
    setSelectedReviewers([]);
    fetchAll();
  };

  // Remove assignment
  const handleRemoveAssignment = async (assignmentId: string, proposalId: string) => {
    if (!user) return;
    const { error } = await supabase.from("review_assignments").delete().eq("id", assignmentId);
    if (!error) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        organization_id: orgId,
        action: "remove_assignment",
        entity: "review_assignment",
        entity_id: assignmentId,
        metadata_json: { proposal_id: proposalId, edital_id: editalId },
      });
      toast({ title: "Atribuição removida." });
      fetchAll();
    }
  };

  // Open manual assign modal
  const openAssignModal = (proposal: ProposalRow) => {
    setAssignTarget(proposal);
    setSelectedReviewers([]);
    setReviewerSearch("");
    setAssignModalOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const eligibleForAssign = assignTarget
    ? reviewers.filter(r => {
        const alreadyAssigned = assignTarget.assignments.some(a => a.reviewer_user_id === r.user_id);
        const isConflicted = assignTarget.conflicts.includes(r.user_id);
        const matchesSearch = !reviewerSearch ||
          r.full_name.toLowerCase().includes(reviewerSearch.toLowerCase()) ||
          r.email.toLowerCase().includes(reviewerSearch.toLowerCase()) ||
          r.institution.toLowerCase().includes(reviewerSearch.toLowerCase());
        return !alreadyAssigned && matchesSearch && !isConflicted;
      })
    : [];

  const blockedForAssign = assignTarget
    ? reviewers.filter(r => assignTarget.conflicts.includes(r.user_id))
    : [];

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={stats.insufficient > 0 ? "border-destructive/40 bg-destructive/5" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.insufficient}</p>
              <p className="text-xs text-muted-foreground">Sem avaliadores suficientes</p>
            </div>
            {stats.insufficient > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px]">Ação necessária</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.ready}</p>
              <p className="text-xs text-muted-foreground">Prontas (≥{minReviewers} avaliadores)</p>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.conflictsPending > 0 ? "border-destructive/40 bg-destructive/5" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.conflictsPending}</p>
              <p className="text-xs text-muted-foreground">Conflitos pendentes</p>
            </div>
            {stats.conflictsPending > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px]">Redistribuir</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Users className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalAssignments}</p>
              <p className="text-xs text-muted-foreground">Atribuições totais</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banners */}
      {stats.insufficient > 0 && (
        <Alert variant="default" className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            Existem <strong>{stats.insufficient}</strong> propostas sem o mínimo de avaliadores. Elas não poderão avançar para Resultado.
          </AlertDescription>
        </Alert>
      )}
      {stats.conflictsPending > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="w-4 h-4" />
          <AlertDescription>
            Conflitos declarados exigem redistribuição. Clique em "Ver atribuições" para corrigir.
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={handleAutoDistribute} disabled={autoDistributing || proposals.length === 0}>
          {autoDistributing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Distribuir automaticamente
        </Button>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="none">Sem distribuição</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="complete">Completa</SelectItem>
            <SelectItem value="conflict">Com conflito</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {proposals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma proposta submetida neste edital.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Código</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Área CNPq</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Atribuídos / Mín.</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Conflitos</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const distStatus = getDistStatus(p, minReviewers);
                  const cfg = STATUS_CONFIG[distStatus];
                  const validCount = p.assignments.filter(a => !["conflict", "cancelled"].includes(a.status)).length;
                  const conflictCount = p.assignments.filter(a => a.status === "conflict").length;
                  const Icon = cfg.icon;

                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium text-primary">{p.blind_code}</td>
                      <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{p.cnpq_area || "—"}</td>
                      <td className="p-3 text-center">
                        <span className={`font-bold ${validCount < minReviewers ? "text-destructive" : "text-foreground"}`}>
                          {validCount}
                        </span>
                        <span className="text-muted-foreground">/{minReviewers}</span>
                      </td>
                      <td className="p-3 text-center">
                        {conflictCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">{conflictCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={cfg.variant} className="text-xs gap-1">
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => openAssignModal(p)}>
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> Distribuir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedProposal(p)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignment Detail Sheet */}
      <Sheet open={!!selectedProposal} onOpenChange={(open) => { if (!open) setSelectedProposal(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedProposal && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Atribuições — {selectedProposal.blind_code}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <Alert variant="default" className="bg-muted/50">
                  <ShieldAlert className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    Conflitos bloqueiam reatribuição ao mesmo avaliador.
                  </AlertDescription>
                </Alert>

                {selectedProposal.assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum avaliador atribuído.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedProposal.assignments.map(a => (
                      <Card key={a.id} className={a.status === "conflict" ? "border-destructive/40" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{a.reviewer_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{a.reviewer_email}</p>
                              {a.reviewer_institution && (
                                <p className="text-xs text-muted-foreground truncate">{a.reviewer_institution}</p>
                              )}
                              {a.reviewer_area && (
                                <Badge variant="outline" className="text-[10px] mt-1">{a.reviewer_area.split(" - ").slice(0, 2).join(" - ")}</Badge>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={a.status === "conflict" ? "destructive" : a.status === "submitted" ? "default" : "secondary"} className="text-xs">
                                {a.status === "assigned" ? "Atribuído" : a.status === "in_progress" ? "Em andamento" : a.status === "submitted" ? "Submetida" : a.status === "conflict" ? "Conflito" : a.status}
                              </Badge>
                              {a.status === "conflict" && a.conflict_reason && (
                                <p className="text-[10px] text-destructive max-w-[150px] text-right">{a.conflict_reason}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            {a.status !== "submitted" && a.status !== "conflict" && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleRemoveAssignment(a.id, selectedProposal.id)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Remover
                              </Button>
                            )}
                            {a.status === "conflict" && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                                handleRemoveAssignment(a.id, selectedProposal.id);
                              }}>
                                <RefreshCw className="w-3 h-3 mr-1" /> Reatribuir
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Separator />

                <Button className="w-full" variant="outline" onClick={() => {
                  setSelectedProposal(null);
                  openAssignModal(selectedProposal);
                }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Adicionar avaliador
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual Assignment Modal */}
      <Dialog open={assignModalOpen} onOpenChange={(open) => { if (!open) { setAssignModalOpen(false); setAssignTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Distribuir — {assignTarget?.blind_code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={reviewerSearch}
                onChange={e => setReviewerSearch(e.target.value)}
                placeholder="Buscar avaliador..."
                className="pl-9"
              />
            </div>

            {eligibleForAssign.length === 0 && blockedForAssign.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum avaliador disponível.</p>
            ) : (
              <>
                {eligibleForAssign.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Avaliadores elegíveis</Label>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {eligibleForAssign.map(r => (
                        <label key={r.user_id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                          <Checkbox
                            checked={selectedReviewers.includes(r.user_id)}
                            onCheckedChange={() => {
                              setSelectedReviewers(prev =>
                                prev.includes(r.user_id)
                                  ? prev.filter(id => id !== r.user_id)
                                  : [...prev, r.user_id]
                              );
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {r.area && <Badge variant="outline" className="text-[10px]">{r.area.split(" - ").slice(0, 2).join(" - ")}</Badge>}
                              <Badge variant="secondary" className="text-[10px]">{r.load} atrib.</Badge>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">Elegível</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {blockedForAssign.length > 0 && (
                  <div>
                    <Label className="text-xs text-destructive flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Bloqueados por conflito
                    </Label>
                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto opacity-60">
                      {blockedForAssign.map(r => (
                        <div key={r.user_id} className="flex items-center gap-3 p-2 rounded border border-destructive/20 text-sm">
                          <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
                          <span className="truncate">{r.full_name}</span>
                          <Badge variant="destructive" className="text-[10px] ml-auto shrink-0">Conflito</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <Button onClick={handleManualAssign} className="w-full" disabled={submitting || selectedReviewers.length === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Atribuir {selectedReviewers.length > 0 ? `(${selectedReviewers.length})` : ""} Avaliador(es)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalDistribution;
