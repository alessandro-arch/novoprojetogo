import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TextFieldWithCounter } from "@/components/ui/text-field-with-counter";
import BudgetModule, { emptyBudget, type BudgetData } from "@/components/proponente/BudgetModule";
import CnpqAreaSelector from "@/components/CnpqAreaSelector";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, Save, Send, AlertTriangle, CheckCircle2, Download, FileText } from "lucide-react";

interface SubmissionFormProps {
  editalId: string;
  editalTitle: string;
  editalStartDate: string | null;
  editalEndDate: string | null;
  onBack: () => void;
}

interface SnapshotSection {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  questions: SnapshotQuestion[];
}

interface SnapshotQuestion {
  id: string;
  label: string;
  type: string;
  help_text: string | null;
  is_required: boolean;
  options_source: string | null;
  validation_rules?: { min_chars?: number | null; max_chars?: number | null } | null;
  sort_order: number;
  manual_options?: { value: string; label: string }[];
}

interface SnapshotData {
  sections: SnapshotSection[];
  knowledge_areas: { id: string; name: string; code: string | null }[];
}

const SubmissionForm = ({ editalId, editalTitle, editalStartDate, editalEndDate, onBack }: SubmissionFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [formVersionId, setFormVersionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [cnpqAreaCode, setCnpqAreaCode] = useState<string | null>(null);
  const [step, setStep] = useState<"area" | "form">("area");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const now = new Date();
  const isBeforeStart = editalStartDate ? new Date(editalStartDate) > now : false;
  const isAfterEnd = editalEndDate ? new Date(editalEndDate) < now : false;
  const isClosed = isBeforeStart || isAfterEnd;

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Check if already submitted
    const { data: existingSub } = await supabase
      .from("edital_submissions")
      .select("*")
      .eq("edital_id", editalId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub && (existingSub as any).status === "submitted") {
      setSubmission(existingSub);
      setAnswers((existingSub as any).answers || {});
      setCnpqAreaCode((existingSub as any).cnpq_area_code || null);
      setIsSubmitted(true);
      setStep("form");
      // Load snapshot from form_version
      if ((existingSub as any).form_version_id) {
        const { data: ver } = await supabase
          .from("form_versions")
          .select("snapshot")
          .eq("id", (existingSub as any).form_version_id)
          .maybeSingle();
        if (ver) setSnapshot((ver as any).snapshot as SnapshotData);
      }
      setLoading(false);
      return;
    }

    // Load published form version
    const { data: formData } = await supabase
      .from("edital_forms")
      .select("id")
      .eq("edital_id", editalId)
      .maybeSingle();

    if (formData) {
      const { data: versions } = await supabase
        .from("form_versions")
        .select("id, snapshot")
        .eq("form_id", formData.id)
        .order("version", { ascending: false })
        .limit(1);

      if (versions && versions.length > 0) {
        setFormVersionId((versions[0] as any).id);
        setSnapshot((versions[0] as any).snapshot as SnapshotData);
      }
    }

    // Load draft answers and area
    const { data: draft } = await supabase
      .from("edital_submission_drafts")
      .select("answers, cnpq_area_code")
      .eq("edital_id", editalId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (draft) {
      setAnswers((draft as any).answers || {});
      if ((draft as any).cnpq_area_code) {
        setCnpqAreaCode((draft as any).cnpq_area_code);
        setStep("form");
      }
    }

    setLoading(false);
  }, [editalId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (isSubmitted || !user) return;
    autoSaveTimer.current = setInterval(() => {
      saveDraftSilent();
    }, 30000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [answers, isSubmitted, user]);

  const saveDraftSilent = async () => {
    if (!user || isSubmitted) return;
    await supabase.from("edital_submission_drafts").upsert({
      edital_id: editalId,
      user_id: user.id,
      answers,
      cnpq_area_code: cnpqAreaCode,
    } as any, { onConflict: "edital_id,user_id" });
  };

  const saveDraft = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("edital_submission_drafts").upsert({
      edital_id: editalId,
      user_id: user.id,
      answers,
      cnpq_area_code: cnpqAreaCode,
    } as any, { onConflict: "edital_id,user_id" });
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Rascunho salvo!" });
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!user || !snapshot || !formVersionId) return;

    // Validate CNPq area
    if (!cnpqAreaCode) {
      toast({ title: "Área do Conhecimento obrigatória", description: "Selecione uma área CNPq antes de submeter.", variant: "destructive" });
      setConfirmOpen(false);
      return;
    }

    // Validate required fields
    const allQuestions = snapshot.sections.flatMap(s => s.questions);
    const missing = allQuestions.filter(q => q.is_required && !answers[q.id]);
    // Validate char limits
    const charErrors: string[] = [];
    allQuestions.forEach(q => {
      const rules = q.validation_rules;
      const val = answers[q.id];
      if (rules && val && typeof val === "string") {
        if (rules.min_chars && val.length < rules.min_chars) {
          charErrors.push(`"${q.label}" precisa de no mínimo ${rules.min_chars} caracteres (atual: ${val.length}).`);
        }
        if (rules.max_chars && val.length > rules.max_chars) {
          charErrors.push(`"${q.label}" excede o máximo de ${rules.max_chars} caracteres (atual: ${val.length}).`);
        }
      }
    });
    if (charErrors.length > 0) {
      toast({
        title: "Erro de limite de caracteres",
        description: charErrors.join(" "),
        variant: "destructive"
      });
      setConfirmOpen(false);
      return;
    }
    // Validate budget justificativas
    const budgetErrors: string[] = [];
    allQuestions.forEach(q => {
      if (q.type === "budget" && answers[q.id]) {
        const budget = answers[q.id] as BudgetData;
        const rubricaNames: Record<string, string> = {
          diarias: "Diárias", passagens: "Passagens", materialConsumo: "Material de Consumo",
          servicosTerceiros: "Serviços de Terceiros", materiaisPermanentes: "Materiais Permanentes", bolsas: "Bolsas"
        };
        (Object.keys(rubricaNames) as (keyof BudgetData)[]).forEach(key => {
          const lines = budget[key] || [];
          lines.forEach((line: any, idx: number) => {
            if (!line.justificativa?.trim()) {
              budgetErrors.push(`${rubricaNames[key]}, linha ${idx + 1}: justificativa obrigatória.`);
            }
          });
        });
      }
    });
    if (budgetErrors.length > 0) {
      toast({
        title: "Justificativa obrigatória no orçamento",
        description: budgetErrors.slice(0, 3).join(" ") + (budgetErrors.length > 3 ? ` e mais ${budgetErrors.length - 3} erro(s).` : ""),
        variant: "destructive"
      });
      setConfirmOpen(false);
      return;
    }
    if (missing.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Preencha: ${missing.map(q => q.label).join(", ")}`,
        variant: "destructive"
      });
      setConfirmOpen(false);
      return;
    }

    if (isClosed) {
      toast({ title: "Submissões indisponíveis", description: "Verifique o período de vigência do edital.", variant: "destructive" });
      setConfirmOpen(false);
      return;
    }

    setSubmitting(true);

    // Generate protocol
    const { data: protocolData } = await supabase.rpc("generate_submission_protocol", { p_edital_id: editalId });
    const protocol = protocolData as string;

    // Create official submission
    const { data: sub, error } = await supabase.from("edital_submissions").insert({
      edital_id: editalId,
      user_id: user.id,
      protocol,
      form_version_id: formVersionId,
      answers,
      cnpq_area_code: cnpqAreaCode,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    } as any).select().single();

    if (error) {
      toast({ title: "Erro ao submeter", description: error.message, variant: "destructive" });
      setSubmitting(false);
      setConfirmOpen(false);
      return;
    }

    // Clean up draft
    await supabase.from("edital_submission_drafts").delete()
      .eq("edital_id", editalId).eq("user_id", user.id);

    // Send email notification (fire and forget)
    supabase.functions.invoke("send-submission-notification", {
      body: {
        submissionId: sub.id,
        protocol,
        editalTitle,
      },
    }).catch(err => console.warn("Email notification failed:", err));

    setSubmission(sub);
    setIsSubmitted(true);
    setConfirmOpen(false);
    setSubmitting(false);
    toast({ title: "Proposta submetida com sucesso!", description: `Protocolo: ${protocol}` });
  };

  const handleDownloadPdf = async () => {
    if (!submission) return;
    // Generate PDF client-side (simple HTML-to-print approach)
    const printWindow = window.open("", "_blank");
    if (!printWindow || !snapshot) return;

    const sectionsHtml = snapshot.sections.sort((a, b) => a.sort_order - b.sort_order).map(s => {
      const questionsHtml = s.questions.sort((a, b) => a.sort_order - b.sort_order).map(q => {
        let answerDisplay = answers[q.id] || "—";
        if (Array.isArray(answerDisplay)) answerDisplay = answerDisplay.join(", ");
        if (q.options_source === "knowledge_areas" && snapshot.knowledge_areas) {
          const ka = snapshot.knowledge_areas.find(k => k.id === answerDisplay);
          if (ka) answerDisplay = ka.name;
        }
        return `<div style="margin-bottom:12px"><strong>${q.label}${q.is_required ? ' *' : ''}</strong><br/><span>${answerDisplay}</span></div>`;
      }).join("");
      return `<h2 style="color:#333;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:20px">${s.title}</h2>${s.description ? `<p style="color:#666;font-size:13px">${s.description}</p>` : ""}${questionsHtml}`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Proposta - ${(submission as any).protocol}</title>
      <style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#222}
      .header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}
      .footer{margin-top:40px;border-top:1px solid #ccc;padding-top:12px;font-size:11px;color:#888;text-align:center}</style></head>
      <body>
        <div class="header">
          <h1 style="font-size:18px;margin-bottom:8px">${editalTitle}</h1>
          <p><strong>Protocolo:</strong> ${(submission as any).protocol}</p>
          <p><strong>Data de submissão:</strong> ${new Date((submission as any).submitted_at).toLocaleString("pt-BR")}</p>
        </div>
        ${sectionsHtml}
        <div class="footer">
          <p>Documento gerado automaticamente pela plataforma ProjetoGO</p>
          <p>ID: ${(submission as any).id}</p>
        </div>
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const renderField = (q: SnapshotQuestion) => {
    const val = answers[q.id] || "";
    const disabled = isSubmitted;

    switch (q.type) {
      case "text":
      case "short_text":
      case "long_text": {
        const rules = q.validation_rules;
        if (rules?.max_chars) {
          return (
            <TextFieldWithCounter
              value={val}
              onChange={v => updateAnswer(q.id, v)}
              maxChars={rules.max_chars}
              minChars={rules.min_chars ?? undefined}
              disabled={disabled}
              placeholder="Resposta..."
            />
          );
        }
        return <Textarea value={val} onChange={e => updateAnswer(q.id, e.target.value)} placeholder="Resposta..." rows={4} disabled={disabled} />;
      }
      case "number":
        return <Input type="number" value={val} onChange={e => updateAnswer(q.id, e.target.value)} placeholder="0" disabled={disabled} />;
      case "date":
        return <Input type="date" value={val} onChange={e => updateAnswer(q.id, e.target.value)} disabled={disabled} />;
      case "file":
        return <Input type="file" disabled={disabled} onChange={e => updateAnswer(q.id, e.target.files?.[0]?.name || "")} />;
      case "single_select": {
        const options = q.options_source === "knowledge_areas"
          ? (snapshot?.knowledge_areas || []).map(ka => ({ value: ka.id, label: ka.name }))
          : (q.manual_options || []);
        return (
          <Select value={val} onValueChange={v => updateAnswer(q.id, v)} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      }
      case "multi_select": {
        const options = q.options_source === "knowledge_areas"
          ? (snapshot?.knowledge_areas || []).map(ka => ({ value: ka.id, label: ka.name }))
          : (q.manual_options || []);
        const selected: string[] = Array.isArray(val) ? val : [];
        return (
          <div className="space-y-2">
            {options.map(o => (
              <div key={o.value} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(o.value)}
                  disabled={disabled}
                  onCheckedChange={checked => {
                    updateAnswer(q.id, checked ? [...selected, o.value] : selected.filter(v => v !== o.value));
                  }}
                />
                <span className="text-sm">{o.label}</span>
              </div>
            ))}
          </div>
        );
      }
      case "budget":
        return (
          <BudgetModule
            value={answers[q.id] || emptyBudget}
            onChange={v => updateAnswer(q.id, v)}
            disabled={disabled}
          />
        );
      default:
        return <Input value={val} onChange={e => updateAnswer(q.id, e.target.value)} disabled={disabled} />;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!snapshot || snapshot.sections.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">O formulário deste edital ainda não foi publicado.</p>
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
      </div>
    );
  }

  // Submitted view
  if (isSubmitted && submission) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        <Card className="border-primary/30">
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
            <h2 className="text-xl font-bold text-foreground">Proposta Submetida</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Protocolo</p>
              <p className="text-2xl font-mono font-bold text-foreground">{(submission as any).protocol}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Submetida em {new Date((submission as any).submitted_at).toLocaleString("pt-BR")}
            </p>
            <Button onClick={handleDownloadPdf} variant="outline">
              <Download className="w-4 h-4 mr-1" /> Baixar PDF da Proposta
            </Button>
          </CardContent>
        </Card>

        {/* Read-only form display */}
        {snapshot.sections.sort((a, b) => a.sort_order - b.sort_order).map(section => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
            </CardHeader>
            <CardContent className="space-y-6">
              {section.questions.sort((a, b) => a.sort_order - b.sort_order).map(q => (
                <div key={q.id}>
                  <Label className="mb-1.5 block">
                    {q.label}
                    {q.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {q.help_text && <p className="text-xs text-muted-foreground mb-2">{q.help_text}</p>}
                  {renderField(q)}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Step 1: Area selection
  if (step === "area") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        <div>
          <h2 className="text-lg font-bold text-foreground">{editalTitle}</h2>
          {editalEndDate && (
            <p className="text-sm text-muted-foreground mt-1">
              Prazo: até {new Date(editalEndDate).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Etapa 1</Badge>
              Área do Conhecimento (CNPq)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecione a área do conhecimento principal da sua proposta. Esta informação será usada para direcionar a avaliação por especialistas da área e <strong>não será visível aos avaliadores</strong>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <CnpqAreaSelector
              value={cnpqAreaCode}
              onChange={(v) => setCnpqAreaCode(v || null)}
              required
              label="Área do Conhecimento *"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!cnpqAreaCode) {
                    toast({ title: "Selecione uma área", description: "A área do conhecimento é obrigatória para continuar.", variant: "destructive" });
                    return;
                  }
                  saveDraftSilent();
                  setStep("form");
                }}
              >
                Avançar para o formulário <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Draft / Fill form view
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("area")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Área
          </Button>
          <Badge variant="secondary" className="text-xs">Etapa 2 — Formulário</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={saveDraft} disabled={saving || isClosed}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            <Save className="w-4 h-4 mr-1" /> Salvar Rascunho
          </Button>
          {!isClosed && (
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              <Send className="w-4 h-4 mr-1" /> Enviar Proposta
            </Button>
          )}
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-center gap-3 p-4 rounded-lg border border-accent bg-accent/10">
        <AlertTriangle className="w-5 h-5 text-accent-foreground shrink-0" />
        <p className="text-sm text-foreground">
          A submissão só será concluída após clicar em <strong>ENVIAR PROPOSTA</strong>. Seus dados são salvos automaticamente como rascunho.
        </p>
      </div>

      {isClosed && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{isBeforeStart ? "O período de submissão ainda não iniciou." : "Período de submissão encerrado."}</p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-foreground">{editalTitle}</h2>
        {editalEndDate && (
          <p className="text-sm text-muted-foreground mt-1">
            Prazo: até {new Date(editalEndDate).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      {snapshot.sections.sort((a, b) => a.sort_order - b.sort_order).map(section => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
          </CardHeader>
          <CardContent className="space-y-6">
            {section.questions.sort((a, b) => a.sort_order - b.sort_order).map(q => (
              <div key={q.id}>
                <Label className="mb-1.5 block">
                  {q.label}
                  {q.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {q.help_text && <p className="text-xs text-muted-foreground mb-2">{q.help_text}</p>}
                {renderField(q)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
            <DialogDescription>
              Após o envio, não será possível editar sua proposta. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubmissionForm;
