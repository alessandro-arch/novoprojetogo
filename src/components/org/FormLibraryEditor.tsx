import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2, ArrowLeft, Plus, Trash2, GripVertical, Save, Send, Eye, Lock, Copy as CopyIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  formId: string;
  orgId: string;
  onBack: () => void;
}

interface FormField {
  id: string;
  section_title: string;
  section_description: string;
  label: string;
  help_text: string;
  field_type: string;
  is_required: boolean;
  min_chars: number | null;
  max_chars: number | null;
  sort_order: number;
  options: any;
  validation_rules: any;
}

const FIELD_TYPES = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "file", label: "Upload de Arquivo" },
  { value: "single_select", label: "Seleção Única" },
  { value: "multi_select", label: "Multi-seleção" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "email", label: "E-mail" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Telefone" },
  { value: "currency", label: "Valor Monetário" },
];

const FormLibraryEditor = ({ formId, orgId, onBack }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);

  const { data: form, isLoading, refetch } = useQuery({
    queryKey: ["form-detail", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", formId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingFields } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", formId)
        .order("sort_order");
      if (error) throw error;
      return data as FormField[];
    },
  });

  useEffect(() => {
    if (existingFields) setFields(existingFields);
  }, [existingFields]);

  const isPublished = form?.status === "published";
  const isArchived = form?.status === "archived";
  const readOnly = isPublished || isArchived;

  const addField = () => {
    setFields(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        section_title: "",
        section_description: "",
        label: "",
        help_text: "",
        field_type: "text",
        is_required: false,
        min_chars: null,
        max_chars: null,
        sort_order: prev.length,
        options: null,
        validation_rules: null,
      },
    ]);
  };

  const updateField = useCallback((id: string, patch: Partial<FormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing fields
      await supabase.from("form_fields").delete().eq("form_id", formId);

      if (fields.length > 0) {
        const rows = fields.map((f, i) => ({
          form_id: formId,
          section_title: f.section_title || null,
          section_description: f.section_description || null,
          label: f.label,
          help_text: f.help_text || null,
          field_type: f.field_type as any,
          is_required: f.is_required,
          min_chars: f.min_chars,
          max_chars: f.max_chars,
          sort_order: i,
          options: f.options,
          validation_rules: f.validation_rules,
        }));
        const { error } = await supabase.from("form_fields").insert(rows);
        if (error) throw error;
      }

      toast.success("Campos salvos!");
      queryClient.invalidateQueries({ queryKey: ["form-fields", formId] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (fields.length === 0) {
      toast.error("Adicione pelo menos um campo antes de publicar.");
      return;
    }
    const emptyLabels = fields.filter(f => !f.label.trim());
    if (emptyLabels.length > 0) {
      toast.error("Todos os campos precisam de um rótulo (label).");
      return;
    }

    await handleSave();
    const { error } = await supabase
      .from("forms")
      .update({ status: "published" as any })
      .eq("id", formId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Formulário publicado!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["form-library"] });
    }
  };

  const handleCreateNewVersion = async () => {
    if (!form) return;
    setCreatingVersion(true);
    try {
      const { data: codeData } = await supabase.rpc("generate_form_code", { p_org_id: orgId });
      const newVersion = (form.version || 1) + 1;

      const { data: newForm, error } = await supabase
        .from("forms")
        .insert({
          organization_id: orgId,
          code: codeData as string,
          name: form.name,
          description: form.description,
          version: newVersion,
          created_by: (await supabase.auth.getUser()).data.user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Copy fields
      if (fields.length > 0) {
        const rows = fields.map((f, i) => ({
          form_id: newForm.id,
          section_title: f.section_title,
          section_description: f.section_description,
          label: f.label,
          help_text: f.help_text,
          field_type: f.field_type as any,
          is_required: f.is_required,
          min_chars: f.min_chars,
          max_chars: f.max_chars,
          sort_order: i,
          options: f.options,
          validation_rules: f.validation_rules,
        }));
        await supabase.from("form_fields").insert(rows);
      }

      toast.success(`Nova versão criada: ${newForm.code} (v${newVersion})`);
      setNewVersionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["form-library"] });
      onBack();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setCreatingVersion(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return <p className="text-muted-foreground">Formulário não encontrado.</p>;
  }

  const statusLabel = form.status === "published" ? "Publicado" : form.status === "archived" ? "Arquivado" : "Rascunho";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold font-heading text-foreground">{form.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-xs">{form.code}</Badge>
            <Badge variant={form.status === "published" ? "default" : "outline"}>{statusLabel}</Badge>
            <span className="text-xs text-muted-foreground">v{form.version}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {readOnly && isPublished && (
            <Button size="sm" variant="outline" onClick={() => setNewVersionDialogOpen(true)}>
              <CopyIcon className="w-4 h-4 mr-1" /> Nova Versão
            </Button>
          )}
          {!readOnly && (
            <>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
              <Button size="sm" onClick={handlePublish}>
                <Send className="w-4 h-4 mr-1" /> Publicar
              </Button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-muted bg-muted/30">
          <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Formulário publicado não pode ser alterado. Crie uma nova versão para fazer modificações.
          </p>
        </div>
      )}

      {form.description && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{form.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Fields */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Campos do Formulário</CardTitle>
              <CardDescription>{fields.length} campo{fields.length !== 1 ? "s" : ""}</CardDescription>
            </div>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="w-4 h-4 mr-1" /> Campo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhum campo configurado.</p>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={addField} className="mt-3">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Primeiro Campo
                </Button>
              )}
            </div>
          ) : (
            fields.map((field, idx) => (
              <div key={field.id} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/20">
                <GripVertical className="w-4 h-4 mt-2 text-muted-foreground shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Rótulo do campo"
                      disabled={readOnly}
                    />
                    <Select
                      value={field.field_type}
                      onValueChange={(v) => updateField(field.id, { field_type: v })}
                      disabled={readOnly}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
                        <Switch
                          checked={field.is_required}
                          onCheckedChange={(v) => updateField(field.id, { is_required: v })}
                          disabled={readOnly}
                        />
                        Obrigatório
                      </label>
                      {!readOnly && (
                        <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => removeField(field.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Extra options for text fields */}
                  {(field.field_type === "text" || field.field_type === "textarea") && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Mín. caracteres</Label>
                        <Input
                          type="number"
                          value={field.min_chars ?? ""}
                          onChange={(e) => updateField(field.id, { min_chars: e.target.value ? Number(e.target.value) : null })}
                          placeholder="—"
                          disabled={readOnly}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Máx. caracteres</Label>
                        <Input
                          type="number"
                          value={field.max_chars ?? ""}
                          onChange={(e) => updateField(field.id, { max_chars: e.target.value ? Number(e.target.value) : null })}
                          placeholder="—"
                          disabled={readOnly}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Texto de ajuda</Label>
                        <Input
                          value={field.help_text}
                          onChange={(e) => updateField(field.id, { help_text: e.target.value })}
                          placeholder="Instrução para o proponente"
                          disabled={readOnly}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* Section grouping */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Seção (agrupamento)</Label>
                      <Input
                        value={field.section_title}
                        onChange={(e) => updateField(field.id, { section_title: e.target.value })}
                        placeholder="Ex: Dados do Projeto"
                        disabled={readOnly}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* New Version Dialog */}
      <Dialog open={newVersionDialogOpen} onOpenChange={setNewVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Versão</DialogTitle>
            <DialogDescription>
              Será criada uma cópia editável deste formulário com um novo código e versão incrementada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVersionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateNewVersion} disabled={creatingVersion}>
              {creatingVersion && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Criar Nova Versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormLibraryEditor;
