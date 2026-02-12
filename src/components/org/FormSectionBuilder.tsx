import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  GripVertical, Eye, Send, RotateCcw, AlertCircle
} from "lucide-react";

// Types
interface Section {
  id: string;
  form_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface Question {
  id: string;
  form_id: string;
  section_id: string | null;
  section: string;
  type: string;
  label: string;
  help_text: string | null;
  is_required: boolean;
  options_source: string | null;
  sort_order: number;
  options: any;
}

interface QuestionOption {
  id: string;
  question_id: string;
  value: string;
  label: string;
  sort_order: number;
}

interface KnowledgeArea {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

const QUESTION_TYPES = [
  { value: "text", label: "Texto (com limite de caracteres)" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "file", label: "Upload de arquivo" },
  { value: "single_select", label: "Seleção única" },
  { value: "multi_select", label: "Seleção múltipla" },
  { value: "budget", label: "Orçamento por Rubricas" },
];

interface FormSectionBuilderProps {
  formId: string;
  formStatus: string;
  editalId: string;
  editalDbStatus?: string;
  onStatusChange: (newStatus: string) => void;
  onPreview: () => void;
}

const FormSectionBuilder = ({ formId, formStatus, editalId, editalDbStatus, onStatusChange, onPreview }: FormSectionBuilderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionOptions, setQuestionOptions] = useState<Record<string, QuestionOption[]>>({});
  const [knowledgeAreas, setKnowledgeAreas] = useState<KnowledgeArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Section dialog
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  // Question dialog
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<string>("");
  const [qLabel, setQLabel] = useState("");
  const [qHelpText, setQHelpText] = useState("");
  const [qType, setQType] = useState("short_text");
  const [qRequired, setQRequired] = useState(false);
  const [qOptionsSource, setQOptionsSource] = useState<string>("manual");
  const [qManualOptions, setQManualOptions] = useState<{ value: string; label: string }[]>([]);
  const [qMinChars, setQMinChars] = useState<string>("");
  const [qMaxChars, setQMaxChars] = useState<string>("");
  const [savingQuestion, setSavingQuestion] = useState(false);

  const isLocked = formStatus === "published";
  const editalPublished = editalDbStatus === "published" || editalDbStatus === "closed";
  const canDelete = !isLocked && !editalPublished;

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [secRes, qRes, kaRes] = await Promise.all([
      supabase.from("form_sections").select("*").eq("form_id", formId).order("sort_order"),
      supabase.from("form_questions").select("*").eq("form_id", formId).order("sort_order"),
      supabase.from("form_knowledge_areas").select("*").eq("form_id", formId).eq("is_active", true).order("sort_order"),
    ]);
    setSections((secRes.data as Section[]) || []);
    setQuestions((qRes.data as Question[]) || []);
    setKnowledgeAreas((kaRes.data as KnowledgeArea[]) || []);

    // Load manual options for select questions
    const selectQs = (qRes.data || []).filter((q: any) => q.options_source === "manual");
    if (selectQs.length > 0) {
      const { data: opts } = await supabase
        .from("form_question_options")
        .select("*")
        .in("question_id", selectQs.map((q: any) => q.id))
        .order("sort_order");
      const grouped: Record<string, QuestionOption[]> = {};
      (opts || []).forEach((o: any) => {
        if (!grouped[o.question_id]) grouped[o.question_id] = [];
        grouped[o.question_id].push(o as QuestionOption);
      });
      setQuestionOptions(grouped);
    } else {
      setQuestionOptions({});
    }
    setLoading(false);
  }, [formId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- SECTIONS ----
  const openCreateSection = () => {
    if (isLocked) return;
    setEditingSection(null);
    setSectionTitle("");
    setSectionDescription("");
    setSectionDialogOpen(true);
  };

  const openEditSection = (s: Section) => {
    if (isLocked) return;
    setEditingSection(s);
    setSectionTitle(s.title);
    setSectionDescription(s.description || "");
    setSectionDialogOpen(true);
  };

  const saveSection = async () => {
    if (!sectionTitle.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSavingSection(true);
    if (editingSection) {
      const { error } = await supabase.from("form_sections").update({
        title: sectionTitle.trim(),
        description: sectionDescription.trim() || null,
      }).eq("id", editingSection.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Seção atualizada!" }); setSectionDialogOpen(false); loadAll(); }
    } else {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) : -1;
      const { error } = await supabase.from("form_sections").insert({
        form_id: formId,
        title: sectionTitle.trim(),
        description: sectionDescription.trim() || null,
        sort_order: maxOrder + 1,
      });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Seção criada!" }); setSectionDialogOpen(false); loadAll(); }
    }
    setSavingSection(false);
  };

  const deleteSection = async (s: Section) => {
    if (!canDelete) {
      toast({ title: "Não permitido", description: "Não é possível excluir seções de um edital publicado.", variant: "destructive" });
      return;
    }
    if (!confirm(`Excluir a seção "${s.title}" e todas as perguntas?`)) return;
    const { error } = await supabase.from("form_sections").delete().eq("id", s.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Seção excluída!" }); loadAll(); }
  };

  const moveSection = async (idx: number, dir: "up" | "down") => {
    const arr = [...sections];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    const tempOrder = arr[idx].sort_order;
    arr[idx].sort_order = arr[swapIdx].sort_order;
    arr[swapIdx].sort_order = tempOrder;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    setSections(arr);
    await Promise.all([
      supabase.from("form_sections").update({ sort_order: arr[idx].sort_order }).eq("id", arr[idx].id),
      supabase.from("form_sections").update({ sort_order: arr[swapIdx].sort_order }).eq("id", arr[swapIdx].id),
    ]);
  };

  // ---- QUESTIONS ----
  const openCreateQuestion = (sectionId: string) => {
    if (isLocked) return;
    setEditingQuestion(null);
    setTargetSectionId(sectionId);
    setQLabel("");
    setQHelpText("");
    setQType("text");
    setQRequired(false);
    setQOptionsSource("manual");
    setQManualOptions([{ value: "", label: "" }]);
    setQMinChars("");
    setQMaxChars("");
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    if (isLocked) return;
    setEditingQuestion(q);
    setTargetSectionId(q.section_id || "");
    setQLabel(q.label);
    setQHelpText(q.help_text || "");
    setQType(q.type === "short_text" || q.type === "long_text" ? "text" : q.type);
    setQRequired(q.is_required);
    setQOptionsSource(q.options_source || "manual");
    // Load char limits from validation_rules
    const rules = (q as any).validation_rules as any;
    setQMinChars(rules?.min_chars != null ? String(rules.min_chars) : "");
    setQMaxChars(rules?.max_chars != null ? String(rules.max_chars) : "");
    // Load manual options
    if (q.options_source === "manual" && questionOptions[q.id]) {
      setQManualOptions(questionOptions[q.id].map(o => ({ value: o.value, label: o.label })));
    } else {
      setQManualOptions([{ value: "", label: "" }]);
    }
    setQuestionDialogOpen(true);
  };

  const isSelectType = qType === "single_select" || qType === "multi_select";

  const saveQuestion = async () => {
    if (!qLabel.trim()) {
      toast({ title: "Label obrigatório", variant: "destructive" });
      return;
    }
    if (isSelectType && qOptionsSource === "manual") {
      const valid = qManualOptions.filter(o => o.label.trim());
      if (valid.length < 2) {
        toast({ title: "Mínimo 2 opções para seleção manual", variant: "destructive" });
        return;
      }
    }
    if (isSelectType && qOptionsSource === "knowledge_areas" && knowledgeAreas.length === 0) {
      toast({ title: "Cadastre áreas ativas para usar este tipo.", variant: "destructive" });
      return;
    }

    // Validate max_chars for text type
    const isTextType = qType === "text";
    if (isTextType) {
      if (!qMaxChars.trim() || parseInt(qMaxChars) <= 0) {
        toast({ title: "Máximo de caracteres é obrigatório para campo de texto.", variant: "destructive" });
        return;
      }
      if (qMinChars.trim() && parseInt(qMinChars) >= parseInt(qMaxChars)) {
        toast({ title: "Mínimo de caracteres deve ser menor que o máximo.", variant: "destructive" });
        return;
      }
    }

    setSavingQuestion(true);
    const sectionQuestions = questions.filter(q => q.section_id === targetSectionId);

    const validationRules = isTextType ? {
      min_chars: qMinChars.trim() ? parseInt(qMinChars) : null,
      max_chars: parseInt(qMaxChars),
    } : null;

    if (editingQuestion) {
      const { error } = await supabase.from("form_questions").update({
        label: qLabel.trim(),
        help_text: qHelpText.trim() || null,
        type: qType,
        is_required: qRequired,
        options_source: isSelectType ? qOptionsSource : null,
        validation_rules: validationRules,
        section_id: targetSectionId || null,
        section: targetSectionId ? sections.find(s => s.id === targetSectionId)?.title || "default" : "default",
      }).eq("id", editingQuestion.id);

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setSavingQuestion(false);
        return;
      }

      // Update manual options
      if (isSelectType && qOptionsSource === "manual") {
        await supabase.from("form_question_options").delete().eq("question_id", editingQuestion.id);
        const validOpts = qManualOptions.filter(o => o.label.trim());
        if (validOpts.length > 0) {
          await supabase.from("form_question_options").insert(
            validOpts.map((o, i) => ({
              question_id: editingQuestion.id,
              value: o.value.trim() || o.label.trim().toLowerCase().replace(/\s+/g, "_"),
              label: o.label.trim(),
              sort_order: i,
            }))
          );
        }
      } else if (!isSelectType || qOptionsSource !== "manual") {
        await supabase.from("form_question_options").delete().eq("question_id", editingQuestion.id);
      }

      toast({ title: "Pergunta atualizada!" });
    } else {
      const maxOrder = sectionQuestions.length > 0 ? Math.max(...sectionQuestions.map(q => q.sort_order)) : -1;
      const { data: inserted, error } = await supabase.from("form_questions").insert({
        form_id: formId,
        section_id: targetSectionId || null,
        section: targetSectionId ? sections.find(s => s.id === targetSectionId)?.title || "default" : "default",
        label: qLabel.trim(),
        help_text: qHelpText.trim() || null,
        type: qType,
        is_required: qRequired,
        options_source: isSelectType ? qOptionsSource : null,
        validation_rules: validationRules,
        sort_order: maxOrder + 1,
      }).select().single();

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setSavingQuestion(false);
        return;
      }

      // Insert manual options
      if (isSelectType && qOptionsSource === "manual" && inserted) {
        const validOpts = qManualOptions.filter(o => o.label.trim());
        if (validOpts.length > 0) {
          await supabase.from("form_question_options").insert(
            validOpts.map((o, i) => ({
              question_id: inserted.id,
              value: o.value.trim() || o.label.trim().toLowerCase().replace(/\s+/g, "_"),
              label: o.label.trim(),
              sort_order: i,
            }))
          );
        }
      }

      toast({ title: "Pergunta criada!" });
    }
    setQuestionDialogOpen(false);
    setSavingQuestion(false);
    loadAll();
  };

  const deleteQuestion = async (q: Question) => {
    if (!canDelete) {
      toast({ title: "Não permitido", description: "Não é possível excluir perguntas de um edital publicado.", variant: "destructive" });
      return;
    }
    if (!confirm(`Excluir a pergunta "${q.label}"?`)) return;
    const { error } = await supabase.from("form_questions").delete().eq("id", q.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Pergunta excluída!" }); loadAll(); }
  };

  const moveQuestion = async (sectionId: string | null, idx: number, dir: "up" | "down") => {
    const sectionQs = questions.filter(q => q.section_id === sectionId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionQs.length) return;
    const arr = [...sectionQs];
    const tempOrder = arr[idx].sort_order;
    arr[idx].sort_order = arr[swapIdx].sort_order;
    arr[swapIdx].sort_order = tempOrder;
    // Update full questions state
    const updated = questions.map(q => {
      if (q.id === arr[idx].id) return { ...q, sort_order: arr[idx].sort_order };
      if (q.id === arr[swapIdx].id) return { ...q, sort_order: arr[swapIdx].sort_order };
      return q;
    });
    setQuestions(updated);
    await Promise.all([
      supabase.from("form_questions").update({ sort_order: arr[idx].sort_order }).eq("id", arr[idx].id),
      supabase.from("form_questions").update({ sort_order: arr[swapIdx].sort_order }).eq("id", arr[swapIdx].id),
    ]);
  };

  // ---- PUBLISH ----
  const handlePublish = async () => {
    if (sections.length === 0) {
      toast({ title: "Adicione pelo menos uma seção antes de publicar.", variant: "destructive" });
      return;
    }
    if (questions.length === 0) {
      toast({ title: "Adicione pelo menos uma pergunta antes de publicar.", variant: "destructive" });
      return;
    }
    if (!confirm("Publicar formulário? Uma versão imutável será gerada.")) return;

    setPublishing(true);

    // Build snapshot
    const snapshot = {
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        sort_order: s.sort_order,
        questions: questions.filter(q => q.section_id === s.id).map(q => ({
          id: q.id,
          label: q.label,
          type: q.type,
          help_text: q.help_text,
          is_required: q.is_required,
          options_source: q.options_source,
          validation_rules: (q as any).validation_rules || null,
          sort_order: q.sort_order,
          manual_options: q.options_source === "manual" ? (questionOptions[q.id] || []).map(o => ({
            value: o.value, label: o.label, sort_order: o.sort_order
          })) : undefined,
        })),
      })),
      knowledge_areas: knowledgeAreas.map(ka => ({
        id: ka.id, name: ka.name, code: ka.code,
      })),
    };

    // Get next version number
    const { data: versions } = await supabase
      .from("form_versions")
      .select("version")
      .eq("form_id", formId)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = (versions && versions.length > 0) ? (versions[0] as any).version + 1 : 1;

    const { error: vErr } = await supabase.from("form_versions").insert({
      form_id: formId,
      version: nextVersion,
      status: "published",
      snapshot,
      created_by: user?.id,
    });

    if (vErr) {
      toast({ title: "Erro ao publicar", description: vErr.message, variant: "destructive" });
      setPublishing(false);
      return;
    }

    // Update form status
    const { error: fErr } = await supabase.from("edital_forms").update({ status: "published" }).eq("id", formId);
    if (fErr) {
      toast({ title: "Erro", description: fErr.message, variant: "destructive" });
    } else {
      toast({ title: `Formulário publicado! Versão ${nextVersion}` });
      onStatusChange("published");
    }
    setPublishing(false);
  };

  const handleUnpublish = async () => {
    if (!confirm("Voltar para rascunho? O formulário ficará editável novamente.")) return;
    const { error } = await supabase.from("edital_forms").update({ status: "draft" }).eq("id", formId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Formulário voltou para rascunho." }); onStatusChange("draft"); }
  };

  const typeLabel = (t: string) => {
    if (t === "short_text" || t === "long_text") return "Texto (com limite de caracteres)";
    return QUESTION_TYPES.find(qt => qt.value === t)?.label || t;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Status bar + actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={isLocked ? "default" : "outline"}>
                {isLocked ? "Publicado" : "Rascunho"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {sections.length} seção(ões) · {questions.length} pergunta(s)
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onPreview}>
                <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
              </Button>
              {isLocked ? (
                <Button size="sm" variant="secondary" onClick={handleUnpublish}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Despublicar
                </Button>
              ) : (
                <Button size="sm" onClick={handlePublish} disabled={publishing}>
                  {publishing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  <Send className="w-4 h-4 mr-1" /> Publicar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {sections.map((section, sIdx) => {
        const sectionQs = questions.filter(q => q.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!isLocked && (
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveSection(sIdx, "up")} disabled={sIdx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => moveSection(sIdx, "down")} disabled={sIdx === sections.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    {section.description && <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>}
                  </div>
                </div>
                {!isLocked && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditSection(section)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => deleteSection(section)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {sectionQs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta nesta seção.</p>
              )}
              {sectionQs.map((q, qIdx) => (
                <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  {!isLocked && (
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveQuestion(section.id, qIdx, "up")} disabled={qIdx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => moveQuestion(section.id, qIdx, "down")} disabled={qIdx === sectionQs.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground truncate">{q.label}</span>
                      {q.is_required && <Badge variant="outline" className="text-xs">Obrigatório</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">{typeLabel(q.type)}</Badge>
                      {q.options_source === "knowledge_areas" && (
                        <Badge variant="outline" className="text-xs">Áreas do Conhecimento</Badge>
                      )}
                      {q.options_source === "manual" && questionOptions[q.id] && (
                        <span className="text-xs text-muted-foreground">{questionOptions[q.id].length} opções</span>
                      )}
                      {(q.type === "text" || q.type === "short_text" || q.type === "long_text") && (q as any).validation_rules?.max_chars && (
                        <span className="text-xs text-muted-foreground">
                          {(q as any).validation_rules.min_chars ? `${(q as any).validation_rules.min_chars}–` : "máx "}{(q as any).validation_rules.max_chars} caracteres
                        </span>
                      )}
                    </div>
                  </div>
                  {!isLocked && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditQuestion(q)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => deleteQuestion(q)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!isLocked && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => openCreateQuestion(section.id)}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Pergunta
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Add section button */}
      {!isLocked && (
        <Button onClick={openCreateSection} variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-1" /> Adicionar Seção
        </Button>
      )}

      {sections.length === 0 && !isLocked && (
        <div className="text-center py-8">
          <GripVertical className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Comece adicionando uma seção ao formulário.</p>
          <Button onClick={openCreateSection}>
            <Plus className="w-4 h-4 mr-1" /> Criar Seção
          </Button>
        </div>
      )}

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? "Editar Seção" : "Nova Seção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} placeholder="Ex: Dados do Projeto" className="mt-1" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={sectionDescription} onChange={e => setSectionDescription(e.target.value)} placeholder="Instrução para o proponente..." className="mt-1" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveSection} disabled={savingSection}>
                {savingSection && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Editar Pergunta" : "Nova Pergunta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label *</Label>
              <Input value={qLabel} onChange={e => setQLabel(e.target.value)} placeholder="Ex: Título do projeto" className="mt-1" />
            </div>
            <div>
              <Label>Texto de ajuda (opcional)</Label>
              <Textarea value={qHelpText} onChange={e => setQHelpText(e.target.value)} placeholder="Instrução adicional..." className="mt-1" rows={2} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Obrigatória</Label>
              <Switch checked={qRequired} onCheckedChange={setQRequired} />
            </div>

            {/* Text char limits */}
            {qType === "text" && (
              <>
                <Separator />
                <div>
                  <Label>Máximo de caracteres *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={qMaxChars}
                    onChange={e => setQMaxChars(e.target.value)}
                    placeholder="Ex: 1500"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Mínimo de caracteres (opcional)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={qMinChars}
                    onChange={e => setQMinChars(e.target.value)}
                    placeholder="Ex: 100"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Budget info */}
            {qType === "budget" && (
              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Este campo renderiza automaticamente o módulo de orçamento por rubricas (Diárias, Passagens Aéreas, Material de Consumo, Serviços de Terceiros, Materiais Permanentes e Bolsas).
                </p>
              </div>
            )}

            {/* Select options */}
            {isSelectType && (
              <>
                <Separator />
                <div>
                  <Label>Fonte das opções</Label>
                  <Select value={qOptionsSource} onValueChange={setQOptionsSource}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Lista manual</SelectItem>
                      <SelectItem value="knowledge_areas">Áreas do Conhecimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {qOptionsSource === "manual" && (
                  <div className="space-y-2">
                    <Label>Opções</Label>
                    {qManualOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={opt.label}
                          onChange={e => {
                            const updated = [...qManualOptions];
                            updated[i] = { ...updated[i], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") };
                            setQManualOptions(updated);
                          }}
                          placeholder={`Opção ${i + 1}`}
                          className="flex-1"
                        />
                        {qManualOptions.length > 1 && (
                          <Button size="icon" variant="ghost" onClick={() => setQManualOptions(qManualOptions.filter((_, j) => j !== i))}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setQManualOptions([...qManualOptions, { value: "", label: "" }])}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar opção
                    </Button>
                  </div>
                )}

                {qOptionsSource === "knowledge_areas" && (
                  <div className="rounded-lg border border-border p-3 bg-muted/30">
                    {knowledgeAreas.length === 0 ? (
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        <p className="text-sm">Cadastre áreas ativas para usar este tipo.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{knowledgeAreas.length} área(s) ativa(s) serão usadas como opções:</p>
                        <div className="flex flex-wrap gap-1">
                          {knowledgeAreas.map(ka => (
                            <Badge key={ka.id} variant="secondary" className="text-xs">{ka.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveQuestion} disabled={savingQuestion}>
                {savingQuestion && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormSectionBuilder;
