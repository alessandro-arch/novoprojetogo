import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Upload, Bot, Loader2, Save, X, RotateCcw, FileText, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AREA_LABELS, FONTE_LABELS, STATUS_LABELS } from "@/lib/fomento-utils";

interface Props { onBack: () => void; }

interface ExtractedProject {
  fileName: string;
  status: "waiting" | "extracting" | "success" | "partial" | "error";
  errorMsg?: string;
  pesquisador_principal: string;
  titulo: string;
  edital: string;
  orgao_financiador: string;
  valor_total: string;
  area: string;
  fonte: string;
  natureza: string;
  ano: string;
  data_assinatura: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  status_projeto: string;
  selected: boolean;
}

type Phase = "upload" | "processing" | "review";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const emptyProject = (fileName: string): ExtractedProject => ({
  fileName, status: "waiting", pesquisador_principal: "", titulo: "", edital: "",
  orgao_financiador: "", valor_total: "", area: "", fonte: "", natureza: "",
  ano: "", data_assinatura: "", vigencia_inicio: "", vigencia_fim: "",
  status_projeto: "em_execucao", selected: true,
});

const getRowStatus = (p: ExtractedProject): "complete" | "partial" | "missing" => {
  if (!p.pesquisador_principal || !p.titulo) return "missing";
  const optional = [p.edital, p.orgao_financiador, p.valor_total, p.area, p.vigencia_inicio, p.vigencia_fim];
  const filled = optional.filter(Boolean).length;
  return filled >= 4 ? "complete" : "partial";
};

const rowBg = (p: ExtractedProject) => {
  const s = getRowStatus(p);
  if (s === "missing") return "bg-destructive/10";
  if (s === "partial") return "bg-yellow-500/10";
  return "bg-green-500/10";
};

const StatusIcon = ({ status }: { status: ExtractedProject["status"] }) => {
  switch (status) {
    case "waiting": return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "extracting": return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    case "success": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "partial": return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case "error": return <XCircle className="w-4 h-4 text-destructive" />;
  }
};

const statusLabel: Record<ExtractedProject["status"], string> = {
  waiting: "Aguardando", extracting: "Extraindo...", success: "Extraído",
  partial: "Parcial", error: "Erro",
};

const FomentoBatchImport = ({ onBack }: Props) => {
  const { user, fomentoOrgId } = useFomentoAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [projects, setProjects] = useState<ExtractedProject[]>([]);
  const [processingIdx, setProcessingIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const cancelRef = useRef(false);

  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(fomentoOrgId);

  useEffect(() => {
    if (fomentoOrgId) { setEffectiveOrgId(fomentoOrgId); return; }
    const fetch = async () => {
      const { data } = await supabase.from("fomento_organizations").select("id").limit(1).single();
      if (data) setEffectiveOrgId(data.id);
    };
    fetch();
  }, [fomentoOrgId]);

  // File handling
  const addFiles = (incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(f => f.type === "application/pdf");
    if (!pdfs.length) { toast({ title: "Selecione arquivos PDF.", variant: "destructive" }); return; }
    setFiles(prev => {
      const combined = [...prev, ...pdfs];
      if (combined.length > 20) {
        toast({ title: "Máximo 20 arquivos por vez.", variant: "destructive" });
        return combined.slice(0, 20);
      }
      return combined;
    });
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); addFiles(e.dataTransfer.files); };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // AI extraction via edge function
  const callExtractApi = async (base64: string): Promise<any> => {
    const { data: result, error } = await supabase.functions.invoke("extract-fomento-pdf", {
      body: { pdfBase64: base64, type: "project" },
    });
    if (error) throw new Error(error.message || "Erro na extração");
    if (result?.error) throw new Error(result.error);
    return result.data;
  };

  const extractSingle = async (file: File, idx: number): Promise<ExtractedProject> => {
    const proj = emptyProject(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const parsed = await callExtractApi(base64);

      proj.pesquisador_principal = parsed.pesquisador_principal || "";
      proj.titulo = parsed.titulo || "";
      proj.edital = parsed.edital || "";
      proj.orgao_financiador = parsed.orgao_financiador || "";
      proj.valor_total = parsed.valor_total != null ? String(parsed.valor_total) : "";
      proj.area = parsed.area || "";
      proj.fonte = parsed.fonte || "";
      proj.natureza = parsed.natureza || "";
      proj.ano = parsed.ano ? String(parsed.ano) : "";
      proj.data_assinatura = parsed.data_assinatura || "";
      proj.vigencia_inicio = parsed.vigencia_inicio || "";
      proj.vigencia_fim = parsed.vigencia_fim || "";

      const rs = getRowStatus(proj);
      proj.status = rs === "missing" ? "partial" : rs === "partial" ? "partial" : "success";
    } catch (err: any) {
      proj.status = "error";
      proj.errorMsg = err.message;
    }
    return proj;
  };

  const startExtraction = async () => {
    cancelRef.current = false;

    const initial = files.map(f => emptyProject(f.name));
    setProjects(initial);
    setPhase("processing");

    const results = [...initial];
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;
      setProcessingIdx(i);
      results[i] = { ...results[i], status: "extracting" };
      setProjects([...results]);

      const extracted = await extractSingle(files[i], i);
      results[i] = extracted;
      setProjects([...results]);

      if (i < files.length - 1 && !cancelRef.current) await delay(3000);
    }
    setProcessingIdx(-1);
    setPhase("review");
  };

  const retryFile = async (idx: number) => {
    if (!files[idx]) return;
    const updated = [...projects];
    updated[idx] = { ...updated[idx], status: "extracting" };
    setProjects(updated);

    const extracted = await extractSingle(files[idx], idx);
    updated[idx] = extracted;
    setProjects([...updated]);
  };

  // Review
  const updateField = (idx: number, field: keyof ExtractedProject, value: string) => {
    setProjects(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const toggleSelect = (idx: number) => {
    setProjects(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
  };

  const toggleAll = (checked: boolean) => {
    setProjects(prev => prev.map(p => ({ ...p, selected: checked })));
  };

  const saveable = projects.filter(p => p.selected && p.pesquisador_principal && p.titulo);
  const selectedCount = projects.filter(p => p.selected).length;

  const handleSave = async () => {
    if (!saveable.length) { toast({ title: "Nenhum projeto válido selecionado.", variant: "destructive" }); return; }
    setSaving(true);
    let saved = 0;
    try {
      for (const proj of saveable) {
        let processo_uvv: string | null = null;
        if (effectiveOrgId) {
          const { data } = await supabase.rpc("generate_fomento_processo" as any, { _org_id: effectiveOrgId });
          if (data) processo_uvv = data as string;
        }

        const { error } = await supabase.from("fomento_projects").insert({
          processo_uvv,
          pesquisador_principal: proj.pesquisador_principal,
          titulo: proj.titulo,
          edital: proj.edital || null,
          orgao_financiador: proj.orgao_financiador || null,
          valor_total: proj.valor_total ? Number(proj.valor_total) : null,
          area: proj.area || null,
          fonte: proj.fonte || null,
          natureza: proj.natureza || null,
          ano: proj.ano ? Number(proj.ano) : null,
          data_assinatura: proj.data_assinatura || null,
          vigencia_inicio: proj.vigencia_inicio || null,
          vigencia_fim: proj.vigencia_fim || null,
          status: proj.status_projeto || "em_execucao",
          extracted_by_ai: true,
          created_by: user?.id || null,
          organization_id: effectiveOrgId,
        });
        if (!error) saved++;
      }
      toast({ title: `${saved} projeto(s) importado(s) com sucesso.` });
      onBack();
    } catch (err: any) {
      toast({ title: "Erro ao salvar.", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Summary stats
  const successCount = projects.filter(p => p.status === "success").length;
  const partialCount = projects.filter(p => p.status === "partial").length;
  const errorCount = projects.filter(p => p.status === "error").length;

  // Edit dialog
  const editProject = editIdx !== null ? projects[editIdx] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Importação em Lote de Projetos</h1>
          <p className="text-sm text-muted-foreground">Faça upload de múltiplos termos de outorga, concessão ou formulários de bolsa. A IA extrai os dados automaticamente.</p>
        </div>
      </div>

      {/* UPLOAD PHASE */}
      {phase === "upload" && (
        <div className="space-y-4">

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-lg font-medium text-foreground">Arraste PDFs aqui ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">Até 20 arquivos por vez</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">{files.length} arquivo(s) selecionado(s)</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={startExtraction} disabled={!files.length} className="gap-2">
            <Bot className="w-4 h-4" /> Iniciar Extração ({files.length} arquivo{files.length !== 1 ? "s" : ""})
          </Button>
        </div>
      )}

      {/* PROCESSING PHASE */}
      {(phase === "processing" || phase === "review") && (
        <div className="space-y-4">
          {retryMsg && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-yellow-700">
                <Loader2 className="w-4 h-4 animate-spin" /> {retryMsg}
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {successCount} extraídos</Badge>
            <Badge variant="outline" className="gap-1"><AlertTriangle className="w-3 h-3 text-yellow-600" /> {partialCount} parciais</Badge>
            <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3 text-destructive" /> {errorCount} erros</Badge>
            <Badge variant="secondary">Total: {projects.length} arquivos</Badge>
          </div>

          {/* Processing/Review Table */}
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {phase === "review" && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={projects.every(p => p.selected)}
                            onCheckedChange={(c) => toggleAll(!!c)}
                          />
                        </TableHead>
                      )}
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pesquisador</TableHead>
                      <TableHead>Título</TableHead>
                      {phase === "review" && (
                        <>
                          <TableHead>Edital</TableHead>
                          <TableHead>Financiador</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead>Área</TableHead>
                        </>
                      )}
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p, i) => (
                      <TableRow key={i} className={phase === "review" ? rowBg(p) : ""}>
                        {phase === "review" && (
                          <TableCell>
                            <Checkbox checked={p.selected} onCheckedChange={() => toggleSelect(i)} />
                          </TableCell>
                        )}
                        <TableCell className="max-w-[150px] truncate text-xs font-mono">{p.fileName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={p.status} />
                            <span className="text-xs">{statusLabel[p.status]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {phase === "review" ? (
                            <Input className="h-7 text-xs min-w-[120px]" value={p.pesquisador_principal}
                              onChange={e => updateField(i, "pesquisador_principal", e.target.value)} />
                          ) : <span className="text-sm truncate">{p.pesquisador_principal || "—"}</span>}
                        </TableCell>
                        <TableCell>
                          {phase === "review" ? (
                            <Input className="h-7 text-xs min-w-[150px]" value={p.titulo}
                              onChange={e => updateField(i, "titulo", e.target.value)} />
                          ) : <span className="text-sm truncate">{p.titulo || "—"}</span>}
                        </TableCell>
                        {phase === "review" && (
                          <>
                            <TableCell>
                              <Input className="h-7 text-xs min-w-[100px]" value={p.edital}
                                onChange={e => updateField(i, "edital", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-xs min-w-[100px]" value={p.orgao_financiador}
                                onChange={e => updateField(i, "orgao_financiador", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-xs min-w-[80px] text-right" value={p.valor_total}
                                onChange={e => updateField(i, "valor_total", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Select value={p.area || "none"} onValueChange={v => updateField(i, "area", v === "none" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs min-w-[100px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">—</SelectItem>
                                  {Object.entries(AREA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            {(p.status === "error") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryFile(i)} title="Tentar novamente">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {phase === "review" && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditIdx(i)}>
                                Editar completo
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {phase === "review" && (
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving || !saveable.length} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Selecionados ({saveable.length} projeto{saveable.length !== 1 ? "s" : ""})
              </Button>
              {selectedCount > saveable.length && (
                <p className="text-xs text-destructive self-center">
                  {selectedCount - saveable.length} selecionado(s) sem pesquisador/título (não serão salvos)
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* EDIT DIALOG */}
      <Dialog open={editIdx !== null} onOpenChange={() => setEditIdx(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Projeto — {editProject?.fileName}</DialogTitle>
          </DialogHeader>
          {editProject && editIdx !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <Label className="text-xs">Pesquisador Principal *</Label>
                <Input value={editProject.pesquisador_principal} onChange={e => updateField(editIdx, "pesquisador_principal", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Título *</Label>
                <Input value={editProject.titulo} onChange={e => updateField(editIdx, "titulo", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Edital</Label>
                <Input value={editProject.edital} onChange={e => updateField(editIdx, "edital", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Órgão Financiador</Label>
                <Input value={editProject.orgao_financiador} onChange={e => updateField(editIdx, "orgao_financiador", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor Total</Label>
                <Input type="number" value={editProject.valor_total} onChange={e => updateField(editIdx, "valor_total", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Ano</Label>
                <Input type="number" value={editProject.ano} onChange={e => updateField(editIdx, "ano", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Área</Label>
                <Select value={editProject.area || "none"} onValueChange={v => updateField(editIdx, "area", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {Object.entries(AREA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fonte</Label>
                <Select value={editProject.fonte || "none"} onValueChange={v => updateField(editIdx, "fonte", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {Object.entries(FONTE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editProject.status_projeto} onValueChange={v => updateField(editIdx, "status_projeto", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data Assinatura</Label>
                <Input type="date" value={editProject.data_assinatura} onChange={e => updateField(editIdx, "data_assinatura", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Vigência Início</Label>
                <Input type="date" value={editProject.vigencia_inicio} onChange={e => updateField(editIdx, "vigencia_inicio", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Vigência Fim</Label>
                <Input type="date" value={editProject.vigencia_fim} onChange={e => updateField(editIdx, "vigencia_fim", e.target.value)} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FomentoBatchImport;
