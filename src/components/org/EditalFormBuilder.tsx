import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, GripVertical, Save, FolderTree, ChevronRight, AlertTriangle, Eye, Send, Upload } from "lucide-react";

interface FormQuestion {
  id: string;
  label: string;
  type: string;
  section: string;
  help_text: string;
  is_required: boolean;
  options: any;
  validation_rules: any;
  sort_order: number;
}

interface KnowledgeArea {
  id: string;
  name: string;
  parent_id: string | null;
  code: string | null;
  level: number;
  is_active: boolean;
  sort_order: number;
}

interface EditalForm {
  id: string;
  status: string;
  knowledge_area_mode: string;
  knowledge_area_required: boolean;
}

const QUESTION_TYPES = [
  { value: "short_text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção" },
  { value: "upload_pdf", label: "Upload PDF" },
  { value: "date", label: "Data" },
  { value: "email", label: "E-mail" },
  { value: "url", label: "URL" },
];

const EditalFormBuilder = ({ editalId, orgId }: { editalId: string; orgId: string }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditalForm | null>(null);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [areas, setAreas] = useState<KnowledgeArea[]>([]);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaParent, setNewAreaParent] = useState("");
  const [newAreaCode, setNewAreaCode] = useState("");
  const [newAreaLevel, setNewAreaLevel] = useState("1");
  const [creatingArea, setCreatingArea] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importingFromLib, setImportingFromLib] = useState(false);

  useEffect(() => {
    loadData();
  }, [editalId]);

  const loadData = async () => {
    setLoading(true);
    const [formRes, questionsRes, areasRes] = await Promise.all([
      supabase.from("edital_forms").select("*").eq("edital_id", editalId).maybeSingle(),
      // We'll load questions after form
      Promise.resolve(null),
      supabase.from("knowledge_areas").select("*").eq("edital_id", editalId).order("sort_order"),
    ]);

    let currentForm = formRes.data as EditalForm | null;
    if (currentForm) {
      setForm(currentForm);
      // Load questions for this form
      const { data: qData } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", currentForm.id)
        .order("sort_order");
      setQuestions((qData || []) as FormQuestion[]);
    } else {
      setForm(null);
      setQuestions([]);
    }

    setAreas((areasRes.data || []) as KnowledgeArea[]);
    setLoading(false);
  };

  const createForm = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("edital_forms")
      .insert({ edital_id: editalId, organization_id: orgId, status: "draft" })
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar formulário", description: error.message, variant: "destructive" });
    } else {
      setForm(data as EditalForm);
      toast({ title: "Formulário criado!" });
    }
  };

  // Questions CRUD
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "short_text",
        section: "default",
        help_text: "",
        is_required: false,
        options: null,
        validation_rules: null,
        sort_order: prev.length,
      },
    ]);
  };

  const updateQuestion = (id: string, field: Partial<FormQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...field } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const saveQuestions = async () => {
    if (!form) return;
    setSaving(true);
    // Delete existing
    await supabase.from("form_questions").delete().eq("form_id", form.id);
    // Insert new
    if (questions.length > 0) {
      const rows = questions.map((q, i) => ({
        form_id: form.id,
        label: q.label,
        type: q.type,
        section: q.section || "default",
        help_text: q.help_text || null,
        is_required: q.is_required,
        options: q.options,
        validation_rules: q.validation_rules,
        sort_order: i,
      }));
      const { error } = await supabase.from("form_questions").insert(rows);
      if (error) {
        toast({ title: "Erro ao salvar perguntas", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast({ title: "Perguntas salvas!" });
    loadData();
  };

  // Areas CRUD
  const createArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    setCreatingArea(true);
    const { error } = await supabase.from("knowledge_areas").insert({
      name: newAreaName.trim(),
      organization_id: orgId,
      edital_id: editalId,
      parent_id: newAreaParent && newAreaParent !== "none" ? newAreaParent : null,
      code: newAreaCode || null,
      level: parseInt(newAreaLevel),
      sort_order: areas.length,
    });
    setCreatingArea(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Área criada!" });
      setNewAreaName("");
      setNewAreaCode("");
      setNewAreaParent("");
      setNewAreaLevel("1");
      setAreaDialogOpen(false);
      loadData();
    }
  };

  const deleteArea = async (id: string) => {
    const { error } = await supabase.from("knowledge_areas").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Área removida" });
      loadData();
    }
  };

  const importFromLibrary = async () => {
    setImportingFromLib(true);
    // Fetch org-level areas (no edital_id)
    const { data: libAreas } = await supabase
      .from("knowledge_areas")
      .select("*")
      .eq("organization_id", orgId)
      .is("edital_id", null);

    if (libAreas && libAreas.length > 0) {
      const idMap = new Map<string, string>();
      // Create copies linked to this edital
      for (const a of libAreas) {
        const newId = crypto.randomUUID();
        idMap.set(a.id, newId);
      }
      const rows = libAreas.map((a: any) => ({
        id: idMap.get(a.id),
        name: a.name,
        organization_id: orgId,
        edital_id: editalId,
        parent_id: a.parent_id ? idMap.get(a.parent_id) || null : null,
        level: a.level || 1,
        sort_order: a.sort_order || 0,
      }));
      await supabase.from("knowledge_areas").insert(rows);
      toast({ title: `${rows.length} áreas importadas da biblioteca!` });
      loadData();
    } else {
      toast({ title: "Nenhuma área na biblioteca da organização", variant: "destructive" });
    }
    setImportingFromLib(false);
    setImportDialogOpen(false);
  };

  // Update form settings
  const updateFormSettings = async (field: Partial<EditalForm>) => {
    if (!form) return;
    const updated = { ...form, ...field };
    setForm(updated);
    await supabase.from("edital_forms").update(field).eq("id", form.id);
  };

  const publishForm = async () => {
    if (!form) return;
    await supabase.from("edital_forms").update({ status: "published" }).eq("id", form.id);
    setForm({ ...form, status: "published" });
    toast({ title: "Formulário publicado!" });
  };

  // Render tree
  const rootAreas = areas.filter((a) => !a.parent_id);
  const childrenOf = (parentId: string) => areas.filter((a) => a.parent_id === parentId);
  const renderArea = (area: KnowledgeArea, depth: number = 0) => (
    <div key={area.id}>
      <div className={`flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors ${depth > 0 ? "ml-6" : ""}`}>
        <div className="flex items-center gap-2">
          {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <FolderTree className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{area.name}</span>
          {area.code && <Badge variant="outline" className="text-xs">{area.code}</Badge>}
          <Badge variant="secondary" className="text-xs">
            {area.level === 1 ? "Grande Área" : area.level === 2 ? "Área" : "Subárea"}
          </Badge>
        </div>
        <Button size="icon" variant="ghost" onClick={() => deleteArea(area.id)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
      {childrenOf(area.id).map((child) => renderArea(child, depth + 1))}
    </div>
  );

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // No form yet — show CTA
  if (!form) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold font-heading text-foreground">Nenhum formulário configurado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Crie o formulário deste edital para definir as perguntas, áreas do conhecimento e regras de submissão.
          </p>
          <Button size="lg" onClick={createForm} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Plus className="w-4 h-4 mr-2" /> Criar Formulário
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold font-heading text-foreground">Formulário do Edital</h3>
          <Badge variant={form.status === "published" ? "default" : "outline"}>
            {form.status === "draft" ? "Rascunho" : "Publicado"}
          </Badge>
        </div>
        {form.status === "draft" && (
          <Button onClick={publishForm} size="sm">
            <Send className="w-4 h-4 mr-1" /> Publicar Formulário
          </Button>
        )}
      </div>

      <Tabs defaultValue="areas">
        <TabsList>
          <TabsTrigger value="areas">Áreas do Conhecimento</TabsTrigger>
          <TabsTrigger value="questions">Perguntas</TabsTrigger>
          <TabsTrigger value="settings">Regras e Validações</TabsTrigger>
          <TabsTrigger value="preview">Pré-visualização</TabsTrigger>
        </TabsList>

        {/* Areas */}
        <TabsContent value="areas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Áreas do Conhecimento</CardTitle>
                  <CardDescription>Hierarquia: Grande Área → Área → Subárea</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-1" /> Usar biblioteca</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Importar da Biblioteca da Organização</DialogTitle></DialogHeader>
                      <p className="text-sm text-muted-foreground">Copiar todas as áreas cadastradas na organização para este edital.</p>
                      <Button onClick={importFromLibrary} disabled={importingFromLib} className="w-full">
                        {importingFromLib && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Importar Áreas
                      </Button>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Área</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Criar Área do Conhecimento</DialogTitle></DialogHeader>
                      <form onSubmit={createArea} className="space-y-4">
                        <div>
                          <Label>Nome</Label>
                          <Input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Nome da área" className="mt-1" required />
                        </div>
                        <div>
                          <Label>Código (opcional)</Label>
                          <Input value={newAreaCode} onChange={(e) => setNewAreaCode(e.target.value)} placeholder="Ex: 1.01.02" className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Nível</Label>
                            <Select value={newAreaLevel} onValueChange={setNewAreaLevel}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Grande Área</SelectItem>
                                <SelectItem value="2">Área</SelectItem>
                                <SelectItem value="3">Subárea</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Área pai</Label>
                            <Select value={newAreaParent} onValueChange={setNewAreaParent}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                                {areas.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={creatingArea}>
                          {creatingArea && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {areas.length === 0 ? (
                <div className="text-center py-8">
                  <FolderTree className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma área cadastrada para este edital.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rootAreas.map((area) => renderArea(area))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Questions */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Perguntas do Formulário</CardTitle>
                <Button size="sm" variant="outline" onClick={addQuestion}><Plus className="w-4 h-4 mr-1" /> Pergunta</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pergunta configurada. Adicione perguntas ao formulário.</p>
              ) : (
                questions.map((q) => (
                  <div key={q.id} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <GripVertical className="w-4 h-4 mt-2 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input value={q.label} onChange={(e) => updateQuestion(q.id, { label: e.target.value })} placeholder="Texto da pergunta" />
                      <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, { type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={q.is_required} onChange={(e) => updateQuestion(q.id, { is_required: e.target.checked })} className="rounded" />
                          Obrigatório
                        </label>
                        <Button size="icon" variant="ghost" className="ml-auto" onClick={() => removeQuestion(q.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {questions.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={saveQuestions} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Save className="w-4 h-4 mr-2" /> Salvar Perguntas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Regras e Validações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Área do Conhecimento</h4>
                {areas.length === 0 && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Cadastre Áreas do Conhecimento para habilitar trilhas e filtros na submissão.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center justify-between">
                  <Label>Modo de seleção</Label>
                  <Select
                    value={form.knowledge_area_mode}
                    onValueChange={(v) => updateFormSettings({ knowledge_area_mode: v } as any)}
                    disabled={areas.length === 0}
                  >
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Desabilitado</SelectItem>
                      <SelectItem value="single">Seleção única</SelectItem>
                      <SelectItem value="multiple">Multi-seleção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Obrigatório na submissão</Label>
                  <Switch
                    checked={form.knowledge_area_required}
                    onCheckedChange={(v) => updateFormSettings({ knowledge_area_required: v } as any)}
                    disabled={areas.length === 0 || form.knowledge_area_mode === "none"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> Pré-visualização
              </CardTitle>
              <CardDescription>Assim o proponente verá o formulário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {form.knowledge_area_mode !== "none" && areas.length > 0 && (
                <div>
                  <Label className="font-medium">
                    Área do Conhecimento {form.knowledge_area_required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select disabled>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={form.knowledge_area_mode === "multiple" ? "Selecione uma ou mais áreas" : "Selecione uma área"} />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.filter((a) => a.is_active).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma pergunta configurada.</p>
              ) : (
                questions.map((q) => (
                  <div key={q.id}>
                    <Label className="font-medium">
                      {q.label || "Pergunta sem título"} {q.is_required && <span className="text-destructive">*</span>}
                    </Label>
                    {q.type === "short_text" && <Input disabled placeholder="Resposta curta..." className="mt-1" />}
                    {q.type === "long_text" && <textarea disabled placeholder="Resposta longa..." className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" />}
                    {q.type === "number" && <Input type="number" disabled placeholder="0" className="mt-1" />}
                    {q.type === "date" && <Input type="date" disabled className="mt-1" />}
                    {q.type === "email" && <Input type="email" disabled placeholder="email@exemplo.com" className="mt-1" />}
                    {q.type === "url" && <Input type="url" disabled placeholder="https://..." className="mt-1" />}
                    {q.type === "upload_pdf" && (
                      <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
                        Arraste um PDF ou clique para enviar
                      </div>
                    )}
                    {q.type === "select" && (
                      <Select disabled>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent><SelectItem value="opt">Opção</SelectItem></SelectContent>
                      </Select>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditalFormBuilder;
