import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Send, AlertTriangle, FileText, Eye, Lock, BookOpen } from "lucide-react";
import AiReviewAssistant from "./AiReviewAssistant";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface FormQuestion {
  section_id: string;
  section_title: string;
  section_order: number;
  question_id: string;
  label: string;
  type: string;
  question_order: number;
}

const ProposalContentCard = ({
  anonymizedData,
  proposalContent,
  knowledgeArea,
}: {
  anonymizedData: any;
  proposalContent: any;
  knowledgeArea: string | null;
}) => {
  const formQuestions: FormQuestion[] = anonymizedData?.form_questions || [];
  const answers = proposalContent || {};

  // Group questions by section
  const sections = formQuestions.reduce<Record<string, { title: string; order: number; questions: FormQuestion[] }>>(
    (acc, q) => {
      if (!acc[q.section_id]) {
        acc[q.section_id] = { title: q.section_title, order: q.section_order, questions: [] };
      }
      acc[q.section_id].questions.push(q);
      return acc;
    },
    {}
  );

  const sortedSections = Object.entries(sections).sort(([, a], [, b]) => a.order - b.order);
  const hasStructuredQuestions = formQuestions.length > 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="w-5 h-5 text-primary" /> Conteúdo da Proposta
        </CardTitle>
        <CardDescription>
          {anonymizedData?.blind_review !== false
            ? "Dados anonimizados para avaliação cega — sem identificação do proponente"
            : "Conteúdo da proposta para avaliação"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {knowledgeArea && (
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Área do Conhecimento</span>
            <p className="text-sm font-medium text-foreground mt-1">{knowledgeArea}</p>
          </div>
        )}

        {hasStructuredQuestions ? (
          <Accordion type="multiple" defaultValue={sortedSections.map(([id]) => id)} className="space-y-2">
            {sortedSections.map(([sectionId, section]) => (
              <AccordionItem key={sectionId} value={sectionId} className="border border-border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {section.questions
                    .sort((a, b) => a.question_order - b.question_order)
                    .map((q) => {
                      const answer = answers[q.question_id];
                      return (
                        <div key={q.question_id} className="space-y-1">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {q.label}
                          </Label>
                          {answer ? (
                            <div className="bg-card border border-border rounded-md p-3">
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {typeof answer === "object" ? JSON.stringify(answer, null, 2) : String(answer)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Sem resposta</p>
                          )}
                        </div>
                      );
                    })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : proposalContent && typeof proposalContent === "object" ? (
          <div className="space-y-3">
            {Object.entries(proposalContent).map(([key, value]) => (
              <div key={key}>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {key.replace(/_/g, " ")}
                </Label>
                <div className="bg-card border border-border rounded-md p-3 mt-1">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{String(value)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            Nenhum conteúdo disponível para esta proposta.
          </p>
        )}

        {/* Anonymized files */}
        {anonymizedData?.files && (anonymizedData.files as any[]).length > 0 && (
          <div className="pt-4 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anexos</span>
            <div className="mt-2 space-y-2">
              {(anonymizedData.files as any[]).map((file: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground p-2 rounded-md bg-muted/50 border border-border">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{file.file_ref}</span>
                  {file.file_type && (
                    <Badge variant="outline" className="text-xs">{file.file_type}</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface Assignment {
  id: string;
  proposal_id: string;
  status: string;
  edital_title: string;
  edital_id: string;
  proposal_masked_id: string;
  knowledge_area: string | null;
}

interface Criteria {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  max_score: number;
  sort_order: number;
}

interface ScoreEntry {
  criteria_id: string;
  score: number;
  comment: string;
}

const ReviewForm = ({ assignment, onBack }: { assignment: Assignment; onBack: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [recommendation, setRecommendation] = useState("");
  const [comments, setComments] = useState("");
  const [proposalContent, setProposalContent] = useState<any>(null);
  const [anonymizedData, setAnonymizedData] = useState<any>(null);
  const [existingReview, setExistingReview] = useState<any>(null);
  const isReadOnly = assignment.status === "submitted";

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Fetch criteria for this edital
      const { data: criteriaData } = await supabase
        .from("scoring_criteria")
        .select("*")
        .eq("edital_id", assignment.edital_id)
        .order("sort_order");

      const criteriaList = (criteriaData || []) as Criteria[];
      setCriteria(criteriaList);

      // Fetch anonymized proposal data via secure RPC
      const { data: anonData, error: anonError } = await supabase
        .rpc("get_anonymized_proposal", { p_assignment_id: assignment.id });

      if (anonData && !anonError) {
        setAnonymizedData(anonData);
        setProposalContent((anonData as any).answers || null);
      } else {
        // Fallback: direct fetch (for backwards compatibility)
        const { data: answers } = await supabase
          .from("proposal_answers")
          .select("answers_json")
          .eq("proposal_id", assignment.proposal_id)
          .maybeSingle();
        setProposalContent(answers?.answers_json || null);
      }

      // Fetch existing review if any
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("*, review_scores(*)")
        .eq("assignment_id", assignment.id)
        .maybeSingle();

      if (reviewData) {
        setExistingReview(reviewData);
        setRecommendation(reviewData.recommendation || "");
        setComments(reviewData.comments_to_committee || "");
        
        const existingScores = (reviewData.review_scores || []) as any[];
        setScores(criteriaList.map((c) => {
          const existing = existingScores.find((s: any) => s.criteria_id === c.id);
          return { criteria_id: c.id, score: existing?.score || 0, comment: existing?.comment || "" };
        }));
      } else {
        setScores(criteriaList.map((c) => ({ criteria_id: c.id, score: 0, comment: "" })));
      }

      // Update status to in_progress if assigned
      if (assignment.status === "assigned") {
        await supabase
          .from("review_assignments")
          .update({ status: "in_progress" })
          .eq("id", assignment.id);
      }

      setLoading(false);
    };
    load();
  }, [assignment]);

  const updateScore = (criteriaId: string, field: "score" | "comment", value: any) => {
    setScores((prev) => prev.map((s) => s.criteria_id === criteriaId ? { ...s, [field]: value } : s));
  };

  const calculateWeightedScore = () => {
    let totalWeight = 0;
    let weightedSum = 0;
    criteria.forEach((c) => {
      const entry = scores.find((s) => s.criteria_id === c.id);
      if (entry) {
        const normalizedScore = (entry.score / c.max_score) * 10;
        weightedSum += normalizedScore * c.weight;
        totalWeight += c.weight;
      }
    });
    return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : "0.00";
  };

  const handleSubmit = async () => {
    if (!user || isReadOnly) return;
    if (!recommendation) {
      toast({ title: "Selecione uma recomendação", variant: "destructive" });
      return;
    }

    const hasAllScores = scores.every((s) => s.score > 0);
    if (!hasAllScores) {
      toast({ title: "Preencha todas as notas", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const overallScore = parseFloat(calculateWeightedScore());

    // Create or update review
    let reviewId = existingReview?.id;

    if (!reviewId) {
      const { data: newReview, error: revError } = await supabase
        .from("reviews")
        .insert({
          assignment_id: assignment.id,
          proposal_id: assignment.proposal_id,
          reviewer_user_id: user.id,
          overall_score: overallScore,
          recommendation,
          comments_to_committee: comments,
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (revError) {
        toast({ title: "Erro ao enviar avaliação", description: revError.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      reviewId = newReview.id;
    } else {
      await supabase
        .from("reviews")
        .update({
          overall_score: overallScore,
          recommendation,
          comments_to_committee: comments,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      // Delete old scores
      await supabase.from("review_scores").delete().eq("review_id", reviewId);
    }

    // Insert scores
    const scoreRows = scores.map((s) => ({
      review_id: reviewId!,
      criteria_id: s.criteria_id,
      score: s.score,
      comment: s.comment || null,
    }));

    const { error: scError } = await supabase.from("review_scores").insert(scoreRows);
    if (scError) {
      toast({ title: "Erro ao salvar notas", description: scError.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Update assignment status
    await supabase
      .from("review_assignments")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", assignment.id);

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "review_submitted",
      entity: "review",
      entity_id: reviewId,
      metadata_json: { proposal_id: assignment.proposal_id, overall_score: overallScore },
    });

    toast({ title: "Avaliação enviada com sucesso!" });
    setSubmitting(false);
    onBack();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-lg font-bold font-heading text-foreground">
                Avaliação: {anonymizedData?.anonymous_id || assignment.proposal_masked_id}
              </h1>
              <p className="text-xs text-muted-foreground">{assignment.edital_title}</p>
            </div>
          </div>
          {isReadOnly && (
            <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" /> Somente leitura</Badge>
          )}
        </div>
      </header>

      {/* Confidentiality - only for blind review */}
      {anonymizedData?.blind_review !== false && (
        <div className="bg-accent/30 border-b border-accent/50">
          <div className="container mx-auto px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-foreground flex-shrink-0" />
            <p className="text-xs text-accent-foreground">
              <strong>Avaliação cega:</strong> Qualquer tentativa de identificação do proponente viola as regras do edital.
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Proposal content (anonymized) */}
        <ProposalContentCard
          anonymizedData={anonymizedData}
          proposalContent={proposalContent}
          knowledgeArea={anonymizedData?.knowledge_area || assignment.knowledge_area}
        />

        {/* Scoring criteria */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Barema de Avaliação</CardTitle>
            <CardDescription>Atribua notas para cada critério</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum critério de avaliação configurado para este edital.</p>
            ) : (
              criteria.map((c) => {
                const entry = scores.find((s) => s.criteria_id === c.id);
                return (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">{c.name}</Label>
                        {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">{entry?.score || 0}</span>
                        <span className="text-xs text-muted-foreground">/{c.max_score}</span>
                        <span className="text-xs text-muted-foreground ml-2">(peso {c.weight})</span>
                      </div>
                    </div>
                    <Slider
                      value={[entry?.score || 0]}
                      onValueChange={([v]) => updateScore(c.id, "score", v)}
                      max={c.max_score}
                      step={0.5}
                      disabled={isReadOnly}
                    />
                    <Textarea
                      placeholder="Comentário sobre este critério (opcional)"
                      value={entry?.comment || ""}
                      onChange={(e) => updateScore(c.id, "comment", e.target.value)}
                      rows={2}
                      disabled={isReadOnly}
                      className="text-sm"
                    />
                    <Separator />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Overall */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Parecer Final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Nota ponderada calculada</p>
              <p className="text-3xl font-bold text-primary">{calculateWeightedScore()}</p>
            </div>

            <div>
              <Label>Recomendação</Label>
              <Select value={recommendation} onValueChange={setRecommendation} disabled={isReadOnly}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="approved_with_reservations">Aprovado com ressalvas</SelectItem>
                  <SelectItem value="not_approved">Não aprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Comentários ao comitê</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Observações técnicas para o comitê avaliador..."
                rows={4}
                disabled={isReadOnly}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        {!isReadOnly && (
          <div className="flex items-center justify-between pb-8">
            <AiReviewAssistant
              scores={scores.map((s) => {
                const c = criteria.find((cr) => cr.id === s.criteria_id);
                return {
                  criteriaName: c?.name || "",
                  criteriaDescription: c?.description || null,
                  maxScore: c?.max_score || 10,
                  weight: c?.weight || 1,
                  score: s.score,
                  comment: s.comment,
                };
              })}
              recommendation={recommendation}
              overallScore={parseFloat(calculateWeightedScore())}
              knowledgeArea={anonymizedData?.knowledge_area || assignment.knowledge_area}
              editalTitle={assignment.edital_title}
              proposalContent={proposalContent}
              onInsert={(text) => setComments((prev) => (prev ? prev + "\n\n" + text : text))}
            />
            <Button onClick={handleSubmit} size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Avaliação
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReviewForm;
