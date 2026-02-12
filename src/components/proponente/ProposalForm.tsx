import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TextFieldWithCounter } from "@/components/ui/text-field-with-counter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Send, Upload, Trash2, FileIcon } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface Props {
  proposalId: string;
  editalId: string;
  orgId: string;
  userId: string;
  readOnly?: boolean;
}

interface FormField {
  id: string;
  type: "short_text" | "long_text" | "text" | "number" | "select" | "file";
  label: string;
  required?: boolean;
  options?: string[];
  min_chars?: number;
  max_chars?: number;
}

const ProposalForm = ({ proposalId, editalId, orgId, userId, readOnly }: Props) => {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  // Fetch form schema
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ["form-schema", editalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edital_form_schemas")
        .select("schema_json")
        .eq("edital_id", editalId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data?.schema_json ?? []) as unknown as FormField[];
    },
  });

  // Fetch existing answers
  const { data: existingAnswers } = useQuery({
    queryKey: ["proposal-answers", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_answers")
        .select("answers_json")
        .eq("proposal_id", proposalId)
        .maybeSingle();
      if (error) throw error;
      return (data?.answers_json ?? {}) as Record<string, string>;
    },
  });

  // Fetch knowledge areas for this edital
  const { data: areas } = useQuery({
    queryKey: ["edital-areas-proponente", editalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edital_areas")
        .select("knowledge_area_id, knowledge_areas(id, name)")
        .eq("edital_id", editalId);
      if (error) throw error;
      return data?.map((d) => (d.knowledge_areas as any)) ?? [];
    },
  });

  // Fetch proposal for area selection
  const { data: proposal } = useQuery({
    queryKey: ["proposal-detail", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("knowledge_area_id")
        .eq("id", proposalId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch attached files
  const { data: files, refetch: refetchFiles } = useQuery({
    queryKey: ["proposal-files", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_files")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingAnswers) setAnswers(existingAnswers);
  }, [existingAnswers]);

  useEffect(() => {
    if (proposal?.knowledge_area_id) setSelectedAreaId(proposal.knowledge_area_id);
  }, [proposal]);

  const updateAnswer = useCallback((fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert answers
      const { error: ansErr } = await supabase
        .from("proposal_answers")
        .upsert(
          { proposal_id: proposalId, answers_json: answers as unknown as Json },
          { onConflict: "proposal_id" }
        );
      if (ansErr) throw ansErr;

      // Update area
      if (selectedAreaId) {
        await supabase.from("proposals").update({ knowledge_area_id: selectedAreaId }).eq("id", proposalId);
      }

      toast.success("Rascunho salvo!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missing = schema?.filter((f) => f.required && !answers[f.id]?.trim());
    if (missing && missing.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      await handleSave();
      const { error } = await supabase
        .from("proposals")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", proposalId);
      if (error) throw error;

      toast.success("Proposta enviada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["my-proposals-full"] });
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB).");
      return;
    }

    setUploading(true);
    try {
      const path = `proposals/${proposalId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("proposal-files").upload(path, file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("proposal_files").insert({
        proposal_id: proposalId,
        file_path: path,
        file_type: file.type || "application/octet-stream",
      });
      if (dbErr) throw dbErr;

      toast.success("Arquivo anexado!");
      refetchFiles();
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    await supabase.storage.from("proposal-files").remove([filePath]);
    await supabase.from("proposal_files").delete().eq("id", fileId);
    refetchFiles();
    toast.success("Arquivo removido.");
  };

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold font-heading text-foreground">
          {readOnly ? "Visualizar Proposta" : "Preencher Proposta"}
        </h2>
        {readOnly && (
          <Badge variant="secondary" className="mt-1">Somente leitura</Badge>
        )}
      </div>

      {/* Knowledge area selection */}
      {areas && areas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Área do Conhecimento</CardTitle>
            <CardDescription>Selecione a área relacionada à sua proposta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId} disabled={readOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Dynamic form fields */}
      {schema && schema.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Formulário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {schema.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {(field.type === "short_text" || field.type === "long_text" || field.type === "text") && (
                  <TextFieldWithCounter
                    value={answers[field.id] ?? ""}
                    onChange={(v) => updateAnswer(field.id, v)}
                    maxChars={(field as any).max_chars || 5000}
                    minChars={(field as any).min_chars}
                    disabled={readOnly}
                  />
                )}
                {field.type === "number" && (
                  <Input
                    type="number"
                    value={answers[field.id] ?? ""}
                    onChange={(e) => updateAnswer(field.id, e.target.value)}
                    disabled={readOnly}
                  />
                )}
                {field.type === "select" && field.options && (
                  <Select
                    value={answers[field.id] ?? ""}
                    onValueChange={(v) => updateAnswer(field.id, v)}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum formulário configurado para este edital.
          </CardContent>
        </Card>
      )}

      {/* File attachments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Anexos</CardTitle>
          <CardDescription>Envie documentos complementares (PDF, máx 10MB cada).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {files && files.length > 0 && (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <FileIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate max-w-xs">{f.file_path.split("/").pop()}</span>
                  </div>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteFile(f.id, f.file_path)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!readOnly && (
            <div>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    Anexar arquivo
                  </span>
                </Button>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar Rascunho
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar Proposta
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProposalForm;
