import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardCheck, Eye, CheckCircle2, AlertCircle, BarChart3, Send } from "lucide-react";

interface ProposalReviewSummary {
  proposal_id: string;
  proposal_masked_id: string;
  knowledge_area: string | null;
  total_assignments: number;
  submitted_count: number;
  reviews: {
    id: string;
    overall_score: number | null;
    recommendation: string | null;
    comments_to_committee: string | null;
    submitted_at: string | null;
    scores: { criteria_name: string; score: number; max_score: number; weight: number; comment: string | null }[];
  }[];
  average_score: number | null;
  decision: { decision: string; justification: string | null; decided_at: string } | null;
}

const ReviewManagement = ({ editalId, editalTitle }: { editalId: string; editalTitle: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ProposalReviewSummary[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ProposalReviewSummary | null>(null);
  const [decisionDialog, setDecisionDialog] = useState(false);
  const [decision, setDecision] = useState("");
  const [justification, setJustification] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    // Get all submitted proposals for this edital
    const { data: proposalsData } = await supabase
      .from("proposals")
      .select("id, knowledge_area_id, blind_code, knowledge_areas(name)")
      .eq("edital_id", editalId)
      .in("status", ["submitted", "under_review", "accepted", "rejected"]);

    if (!proposalsData || proposalsData.length === 0) {
      setProposals([]);
      setLoading(false);
      return;
    }

    const proposalIds = proposalsData.map((p: any) => p.id);

    // Get assignments
    const { data: assignmentsData } = await supabase
      .from("review_assignments")
      .select("id, proposal_id, status, reviewer_user_id")
      .in("proposal_id", proposalIds);

    // Get reviews with scores (no reviewer identity shown to gestor)
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("id, proposal_id, overall_score, recommendation, comments_to_committee, submitted_at, review_scores(score, comment, criteria_id, scoring_criteria(name, max_score, weight))")
      .in("proposal_id", proposalIds);

    // Get decisions
    const { data: decisionsData } = await supabase
      .from("proposal_decisions")
      .select("proposal_id, decision, justification, decided_at")
      .in("proposal_id", proposalIds);

    const summaries: ProposalReviewSummary[] = proposalsData.map((p: any) => {
      const assignments = (assignmentsData || []).filter((a: any) => a.proposal_id === p.id);
      const reviews = (reviewsData || []).filter((r: any) => r.proposal_id === p.id);
      const decisionEntry = (decisionsData || []).find((d: any) => d.proposal_id === p.id);

      const submittedReviews = reviews.filter((r: any) => r.submitted_at);
      const avgScore = submittedReviews.length > 0
        ? submittedReviews.reduce((sum: number, r: any) => sum + (r.overall_score || 0), 0) / submittedReviews.length
        : null;

      return {
        proposal_id: p.id,
        proposal_masked_id: p.blind_code || `PROP-${p.id.slice(0, 8).toUpperCase()}`,
        knowledge_area: p.knowledge_areas?.name || null,
        total_assignments: assignments.length,
        submitted_count: assignments.filter((a: any) => a.status === "submitted").length,
        reviews: reviews.map((r: any) => ({
          id: r.id,
          overall_score: r.overall_score,
          recommendation: r.recommendation,
          comments_to_committee: r.comments_to_committee,
          submitted_at: r.submitted_at,
          scores: (r.review_scores || []).map((s: any) => ({
            criteria_name: s.scoring_criteria?.name || "—",
            score: s.score,
            max_score: s.scoring_criteria?.max_score || 10,
            weight: s.scoring_criteria?.weight || 1,
            comment: s.comment,
          })),
        })),
        average_score: avgScore,
        decision: decisionEntry ? { decision: decisionEntry.decision, justification: decisionEntry.justification, decided_at: decisionEntry.decided_at } : null,
      };
    });

    setProposals(summaries);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [editalId]);

  const handleDecision = async () => {
    if (!selectedProposal || !user || !decision) return;
    setSubmittingDecision(true);

    const { error } = await supabase.from("proposal_decisions").upsert({
      proposal_id: selectedProposal.proposal_id,
      decision,
      justification,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    }, { onConflict: "proposal_id" });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "proposal_decision",
        entity: "proposal_decision",
        entity_id: selectedProposal.proposal_id,
        metadata_json: { decision, edital_id: editalId },
      });
      toast({ title: "Parecer registrado!" });
      setDecisionDialog(false);
      setDecision("");
      setJustification("");
      setSelectedProposal(null);
      fetchData();
    }
    setSubmittingDecision(false);
  };

  const recommendationLabel = (r: string | null) => {
    switch (r) {
      case "approved": return <Badge variant="secondary" className="text-primary">Aprovado</Badge>;
      case "approved_with_reservations": return <Badge variant="outline">Com ressalvas</Badge>;
      case "not_approved": return <Badge variant="destructive">Não aprovado</Badge>;
      default: return null;
    }
  };

  const decisionLabel = (d: string) => {
    switch (d) {
      case "approved": return <Badge className="bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case "approved_with_adjustments": return <Badge variant="outline">Aprovado com ajustes</Badge>;
      case "not_approved": return <Badge variant="destructive">Não aprovado</Badge>;
      default: return <Badge variant="outline">{d}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold font-heading text-foreground mb-1">Avaliações — {editalTitle}</h3>
        <p className="text-sm text-muted-foreground">Acompanhe as avaliações e emita o parecer final</p>
      </div>

      {proposals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma proposta submetida neste edital.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proposals.map((p) => (
            <Card key={p.proposal_id} className="hover:shadow-card transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-primary">{p.proposal_masked_id}</span>
                      {p.knowledge_area && <Badge variant="outline" className="text-xs">{p.knowledge_area}</Badge>}
                      {p.decision && decisionLabel(p.decision.decision)}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Avaliações:</span>
                        <span className="text-sm font-medium">{p.submitted_count}/{p.total_assignments}</span>
                        <Progress value={p.total_assignments > 0 ? (p.submitted_count / p.total_assignments) * 100 : 0} className="w-20 h-2" />
                      </div>
                      {p.average_score !== null && (
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground">{p.average_score.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Dispersion warning */}
                    {p.reviews.length >= 2 && (() => {
                      const reviewScores = p.reviews.filter(r => r.overall_score !== null).map(r => r.overall_score!);
                      if (reviewScores.length < 2) return null;
                      const max = Math.max(...reviewScores);
                      const min = Math.min(...reviewScores);
                      if (max - min > 3) {
                        return (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="w-3 h-3" /> Alta dispersão nas notas ({min.toFixed(1)} - {max.toFixed(1)})
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline" onClick={() => setSelectedProposal(p)}>
                      <Eye className="w-4 h-4 mr-1" /> Detalhes
                    </Button>
                    {!p.decision && p.submitted_count > 0 && (
                      <Button size="sm" onClick={() => { setSelectedProposal(p); setDecisionDialog(true); }}>
                        <Send className="w-4 h-4 mr-1" /> Parecer
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review details dialog */}
      {selectedProposal && !decisionDialog && (
        <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedProposal.proposal_masked_id} — Avaliações</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {selectedProposal.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma avaliação enviada ainda.</p>
              ) : (
                selectedProposal.reviews.map((r, idx) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avaliador {idx + 1} (anônimo)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Nota:</span>
                        <span className="text-lg font-bold text-primary">{r.overall_score?.toFixed(2) || "—"}</span>
                        {recommendationLabel(r.recommendation)}
                      </div>
                      {r.scores.length > 0 && (
                        <div className="space-y-1">
                          {r.scores.map((s, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{s.criteria_name}</span>
                              <span className="font-medium">{s.score}/{s.max_score} <span className="text-xs text-muted-foreground">(peso {s.weight})</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.comments_to_committee && (
                        <>
                          <Separator />
                          <p className="text-sm text-foreground whitespace-pre-wrap">{r.comments_to_committee}</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}

              {selectedProposal.decision && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" /> Parecer Final
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      {decisionLabel(selectedProposal.decision.decision)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(selectedProposal.decision.decided_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {selectedProposal.decision.justification && (
                      <p className="text-sm text-foreground">{selectedProposal.decision.justification}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Decision dialog */}
      <Dialog open={decisionDialog} onOpenChange={(open) => { if (!open) { setDecisionDialog(false); setSelectedProposal(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parecer Final — {selectedProposal?.proposal_masked_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProposal?.average_score !== null && selectedProposal?.average_score !== undefined && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Média das avaliações</p>
                <p className="text-2xl font-bold text-primary">{selectedProposal.average_score.toFixed(2)}</p>
              </div>
            )}
            <div>
              <Label>Decisão</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="approved_with_adjustments">Aprovado com ajustes</SelectItem>
                  <SelectItem value="not_approved">Não aprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justificativa</Label>
              <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Justifique a decisão..." rows={4} className="mt-1" />
            </div>
            <Button onClick={handleDecision} className="w-full" disabled={submittingDecision || !decision}>
              {submittingDecision ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Registrar Parecer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewManagement;
