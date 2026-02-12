import { useState, useEffect, useCallback } from "react";
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
import { TextFieldWithCounter } from "@/components/ui/text-field-with-counter";
import BudgetModule, { emptyBudget } from "@/components/proponente/BudgetModule";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save } from "lucide-react";

interface FormPreviewProps {
  formId: string;
  editalId: string;
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

const FormPreview = ({ formId, editalId, onBack }: FormPreviewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"published" | "draft">("draft");

  const loadPreview = useCallback(async () => {
    setLoading(true);

    // Check form status first
    const { data: formData } = await supabase
      .from("edital_forms")
      .select("status")
      .eq("id", formId)
      .single();

    const isDraft = !formData || formData.status === "draft";

    // Try published version only if form is published
    let usedPublished = false;
    if (!isDraft) {
      const { data: versions } = await supabase
        .from("form_versions")
        .select("snapshot")
        .eq("form_id", formId)
        .order("version", { ascending: false })
        .limit(1);

      if (versions && versions.length > 0) {
        setSnapshot((versions[0] as any).snapshot as SnapshotData);
        setSource("published");
        usedPublished = true;
      }
    }

    if (!usedPublished) {
      // Build from draft
      const [secRes, qRes, kaRes] = await Promise.all([
        supabase.from("form_sections").select("*").eq("form_id", formId).order("sort_order"),
        supabase.from("form_questions").select("*").eq("form_id", formId).order("sort_order"),
        supabase.from("form_knowledge_areas").select("*").eq("form_id", formId).eq("is_active", true).order("sort_order"),
      ]);

      const sections = (secRes.data || []) as any[];
      const questions = (qRes.data || []) as any[];
      const areas = (kaRes.data || []) as any[];

      // Load manual options
      const selectQs = questions.filter(q => q.options_source === "manual");
      let opts: any[] = [];
      if (selectQs.length > 0) {
        const { data } = await supabase.from("form_question_options").select("*")
          .in("question_id", selectQs.map(q => q.id)).order("sort_order");
        opts = data || [];
      }

      const snap: SnapshotData = {
        sections: sections.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          sort_order: s.sort_order,
          questions: questions.filter(q => q.section_id === s.id).sort((a: any, b: any) => a.sort_order - b.sort_order).map((q: any) => ({
            id: q.id,
            label: q.label,
            type: q.type,
            help_text: q.help_text,
            is_required: q.is_required,
            options_source: q.options_source,
            sort_order: q.sort_order,
            manual_options: q.options_source === "manual" ? opts.filter(o => o.question_id === q.id).map(o => ({ value: o.value, label: o.label })) : undefined,
          })),
        })),
        knowledge_areas: areas.map((a: any) => ({ id: a.id, name: a.name, code: a.code })),
      };
      setSnapshot(snap);
      setSource("draft");
    } // end !usedPublished

    // Load existing draft answers
    if (user) {
      const { data: draft } = await supabase
        .from("form_response_drafts")
        .select("data")
        .eq("form_id", formId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (draft) setAnswers((draft as any).data || {});
    }

    setLoading(false);
  }, [formId, user]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const saveDraft = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("form_response_drafts").upsert({
      form_id: formId,
      edital_id: editalId,
      user_id: user.id,
      data: answers,
    }, { onConflict: "form_id,user_id" });
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Rascunho salvo!" });
  };

  const renderField = (q: SnapshotQuestion) => {
    const val = answers[q.id] || "";

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
              placeholder="Resposta..."
            />
          );
        }
        return <Textarea value={val} onChange={e => updateAnswer(q.id, e.target.value)} placeholder="Resposta..." rows={4} />;
      }
      case "number":
        return <Input type="number" value={val} onChange={e => updateAnswer(q.id, e.target.value)} placeholder="0" />;
      case "date":
        return <Input type="date" value={val} onChange={e => updateAnswer(q.id, e.target.value)} />;
      case "file":
        return <Input type="file" onChange={e => updateAnswer(q.id, e.target.files?.[0]?.name || "")} />;
      case "single_select": {
        const options = q.options_source === "knowledge_areas"
          ? (snapshot?.knowledge_areas || []).map(ka => ({ value: ka.id, label: ka.name }))
          : (q.manual_options || []);
        return (
          <Select value={val} onValueChange={v => updateAnswer(q.id, v)}>
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
          />
        );
      default:
        return <Input value={val} onChange={e => updateAnswer(q.id, e.target.value)} />;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!snapshot || snapshot.sections.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Nenhuma seção encontrada para pré-visualizar.</p>
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao editor
          </Button>
          <Badge variant="outline">{source === "published" ? "Versão publicada" : "Rascunho"}</Badge>
        </div>
        <Button size="sm" onClick={saveDraft} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          <Save className="w-4 h-4 mr-1" /> Salvar rascunho
        </Button>
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
    </div>
  );
};

export default FormPreview;
