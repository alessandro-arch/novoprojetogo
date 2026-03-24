import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { MODALIDADE_LABELS, BOLSISTA_STATUS_LABELS } from "@/lib/fomento-utils";

interface Props { onBack: () => void; }

interface ExtractedBolsista {
  fileName: string;
  status: "waiting" | "extracting" | "success" | "partial" | "error";
  errorMsg?: string;
  nome_bolsista: string;
  email_bolsista: string;
  modalidade: string;
  orientador: string;
  coorientador: string;
  coordenador: string;
  edital: string;
  orgao_financiador: string;
  numero_termo: string;
  cotas_total: string;
  data_inicio: string;
  data_fim: string;
  titulo_plano: string;
  area_conhecimento: string;
  ppg_nome: string;
  status_bolsista: string;
  selected: boolean;
  isDuplicate?: boolean;
}

type Phase = "upload" | "processing" | "review";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const emptyBolsista = (fileName: string): ExtractedBolsista => ({
  fileName, status: "waiting", nome_bolsista: "", email_bolsista: "", modalidade: "",
  orientador: "", coorientador: "", coordenador: "", edital: "", orgao_financiador: "",
  numero_termo: "", cotas_total: "", data_inicio: "", data_fim: "", titulo_plano: "",
  area_conhecimento: "", ppg_nome: "", status_bolsista: "ativo", selected: true,
});

const getRowStatus = (b: ExtractedBolsista): "complete" | "partial" | "missing" => {
  if (!b.nome_bolsista) return "missing";
  const optional = [b.modalidade, b.orientador, b.edital, b.data_inicio, b.data_fim, b.cotas_total];
  const filled = optional.filter(Boolean).length;
  return filled >= 4 ? "complete" : "partial";
};

const rowBg = (b: ExtractedBolsista) => {
  const s = getRowStatus(b);
  if (s === "missing") return "bg-destructive/10";
  if (s === "partial") return "bg-yellow-500/10";
  return "bg-green-500/10";
};

const StatusIcon = ({ status }: { status: ExtractedBolsista["status"] }) => {
  switch (status) {
    case "waiting": return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "extracting": return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    case "success": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "partial": return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case "error": return <XCircle className="w-4 h-4 text-destructive" />;
  }
};

const statusLabel: Record<ExtractedBolsista["status"], string> = {
  waiting: "Aguardando", extracting: "Extraindo...", success: "Extraído",
  partial: "Parcial", error: "Erro",
};

const FomentoBolsistaBatchImport = ({ onBack }: Props) => {
  const { user, fomentoOrgId } = useFomentoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [bolsistas, setBolsistas] = useState<ExtractedBolsista[]>([]);
  const [processingIdx, setProcessingIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const cancelRef = useRef(false);

  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(fomentoOrgId);

  useEffect(() => {
    if (fomentoOrgId) { setEffectiveOrgId(fomentoOrgId); return; }
    const fetchOrg = async () => {
      const { data } = await supabase.from("fomento_organizations").select("id").limit(1).single();
      if (data) setEffectiveOrgId(data.id);
    };
    fetchOrg();
  }, [fomentoOrgId]);

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

  const callExtractApi = async (base64: string): Promise<any> => {
    const { data: result, error } = await supabase.functions.invoke("extract-fomento-pdf", {
      body: { pdfBase64: base64, type: "bolsista" },
    });
    if (error) throw new Error(error.message || "Erro na extração");
    if (result?.error) throw new Error(result.error);
    return result.data;
  };

  const extractSingle = async (file: File, idx: number): Promise<ExtractedBolsista> => {
    const b = emptyBolsista(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const parsed = await callExtractApi(base64);

      b.nome_bolsista = parsed.nome_bolsista || "";
      b.email_bolsista = parsed.email_bolsista || "";
      b.modalidade = parsed.modalidade || "";
      b.orientador = parsed.orientador || "";
      b.coorientador = parsed.coorientador || "";
      b.coordenador = parsed.coordenador || "";
      b.edital = parsed.edital || "";
      b.orgao_financiador = parsed.orgao_financiador || "";
      b.numero_termo = parsed.numero_termo || "";
      b.cotas_total = parsed.cotas_total != null ? String(parsed.cotas_total) : "";
      b.data_inicio = parsed.data_inicio || "";
      b.data_fim = parsed.data_fim || "";
      b.titulo_plano = parsed.titulo_plano || "";
      b.area_conhecimento = parsed.area_conhecimento || "";
      b.ppg_nome = parsed.ppg_nome || "";

      const rs = getRowStatus(b);
      b.status = rs === "missing" ? "partial" : rs === "partial" ? "partial" : "success";
    } catch (err: any) {
      b.status = "error";
      b.errorMsg = err.message;
    }
    return b;
  };

  const checkDuplicates = async (results: ExtractedBolsista[]): Promise<ExtractedBolsista[]> => {
    const names = results.filter(b => b.nome_bolsista).map(b => b.nome_bolsista.toLowerCase().trim());
    if (!names.length) return results;

    const { data: existing } = await supabase.from("fomento_bolsistas" as any).select("nome_bolsista, edital");
    if (!existing?.length) return results;

    const existingKeys = new Set(
      (existing as any[]).map((e: any) => `${(e.nome_bolsista || "").toLowerCase().trim()}|${(e.edital || "").toLowerCase().trim()}`)
    );

    return results.map(b => {
      const key = `${b.nome_bolsista.toLowerCase().trim()}|${b.edital.toLowerCase().trim()}`;
      const isDuplicate = existingKeys.has(key);
      return { ...b, isDuplicate, selected: isDuplicate ? false : b.selected };
    });
  };

  const startExtraction = async () => {
    cancelRef.current = false;
    const initial = files.map(f => emptyBolsista(f.name));
    setBolsistas(initial);
    setPhase("processing");

    const results = [...initial];
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;
      setProcessingIdx(i);
      results[i] = { ...results[i], status: "extracting" };
      setBolsistas([...results]);

      const extracted = await extractSingle(files[i], i);
      results[i] = extracted;
      setBolsistas([...results]);

      if (i < files.length - 1 && !cancelRef.current) await delay(3000);
    }
    setProcessingIdx(-1);

    const checked = await checkDuplicates(results);
    setBolsistas(checked);
    const dupCount = checked.filter(b => b.isDuplicate).length;
    if (dupCount > 0) {
      toast({ title: `${dupCount} bolsista(s) já existente(s) detectado(s) e desmarcado(s).` });
    }
    setPhase("review");
  };

  const retryFile = async (idx: number) => {
    if (!files[idx]) return;
    const updated = [...bolsistas];
    updated[idx] = { ...updated[idx], status: "extracting" };
    setBolsistas(updated);

    const extracted = await extractSingle(files[idx], idx);
    updated[idx] = extracted;
    setBolsistas([...updated]);
  };

  const updateField = (idx: number, field: keyof ExtractedBolsista, value: string) => {
    setBolsistas(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const toggleSelect = (idx: number) => {
    setBolsistas(prev => prev.map((b, i) => i === idx ? { ...b, selected: !b.selected } : b));
  };

  const toggleAll = (checked: boolean) => {
    setBolsistas(prev => prev.map(b => ({ ...b, selected: checked })));
  };

  const saveable = bolsistas.filter(b => b.selected && b.nome_bolsista);
  const selectedCount = bolsistas.filter(b => b.selected).length;

  const handleSave = async () => {
    if (!saveable.length) { toast({ title: "Nenhum bolsista válido selecionado.", variant: "destructive" }); return; }
    setSaving(true);
    let saved = 0;
    try {
      for (const b of saveable) {
        const { error } = await supabase.from("fomento_bolsistas" as any).insert({
          nome_bolsista: b.nome_bolsista,
          email_bolsista: b.email_bolsista || null,
          modalidade: b.modalidade || null,
          orientador: b.orientador || null,
          coorientador: b.coorientador || null,
          coordenador: b.coordenador || null,
          edital: b.edital || null,
          orgao_financiador: b.orgao_financiador || null,
          numero_termo: b.numero_termo || null,
          cotas_total: b.cotas_total ? parseInt(b.cotas_total) : null,
          data_inicio: b.data_inicio || null,
          data_fim: b.data_fim || null,
          titulo_plano: b.titulo_plano || null,
          area_conhecimento: b.area_conhecimento || null,
          ppg_nome: b.ppg_nome || null,
          status: b.status_bolsista || "ativo",
          extracted_by_ai: true,
          created_by: user?.id || null,
          organization_id: effectiveOrgId,
        });
        if (error) {
          console.error("Erro ao inserir bolsista:", b.nome_bolsista, error);
        } else {
          saved++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["fomento-bolsistas"] });
      toast({ title: `${saved} bolsista(s) importado(s) com sucesso.` });
      onBack();
    } catch (err: any) {
      toast({ title: "Erro ao salvar.", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const successCount = bolsistas.filter(b => b.status === "success").length;
  const partialCount = bolsistas.filter(b => b.status === "partial").length;
  const errorCount = bolsistas.filter(b => b.status === "error").length;

  const editBolsista = editIdx !== null ? bolsistas[editIdx] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Importação em Lote de Bolsistas</h1>
          <p className="text-sm text-muted-foreground">Faça upload de múltiplos formulários de bolsa. A IA extrai os dados automaticamente.</p>
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

      {/* PROCESSING / REVIEW PHASE */}
      {(phase === "processing" || phase === "review") && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {successCount} extraídos</Badge>
            <Badge variant="outline" className="gap-1"><AlertTriangle className="w-3 h-3 text-yellow-600" /> {partialCount} parciais</Badge>
            <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3 text-destructive" /> {errorCount} erros</Badge>
            <Badge variant="secondary">Total: {bolsistas.length} arquivos</Badge>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {phase === "review" && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={bolsistas.every(b => b.selected)}
                            onCheckedChange={(c) => toggleAll(!!c)}
                          />
                        </TableHead>
                      )}
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Modalidade</TableHead>
                      {phase === "review" && (
                        <>
                          <TableHead>Orientador</TableHead>
                          <TableHead>Edital</TableHead>
                          <TableHead>Cotas</TableHead>
                        </>
                      )}
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bolsistas.map((b, i) => (
                      <TableRow key={i} className={phase === "review" ? rowBg(b) : ""}>
                        {phase === "review" && (
                          <TableCell>
                            <Checkbox checked={b.selected} onCheckedChange={() => toggleSelect(i)} />
                          </TableCell>
                        )}
                        <TableCell className="max-w-[150px] truncate text-xs font-mono">{b.fileName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={b.status} />
                            <span className="text-xs">{statusLabel[b.status]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {phase === "review" ? (
                            <Input className="h-7 text-xs min-w-[120px]" value={b.nome_bolsista}
                              onChange={e => updateField(i, "nome_bolsista", e.target.value)} />
                          ) : <span className="text-sm truncate">{b.nome_bolsista || "—"}</span>}
                        </TableCell>
                        <TableCell>
                          {phase === "review" ? (
                            <Select value={b.modalidade || "none"} onValueChange={v => updateField(i, "modalidade", v === "none" ? "" : v)}>
                              <SelectTrigger className="h-7 text-xs min-w-[100px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {Object.entries(MODALIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : <span className="text-sm truncate">{MODALIDADE_LABELS[b.modalidade] || b.modalidade || "—"}</span>}
                        </TableCell>
                        {phase === "review" && (
                          <>
                            <TableCell>
                              <Input className="h-7 text-xs min-w-[100px]" value={b.orientador}
                                onChange={e => updateField(i, "orientador", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-xs min-w-[100px]" value={b.edital}
                                onChange={e => updateField(i, "edital", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-xs min-w-[60px] text-right" type="number" value={b.cotas_total}
                                onChange={e => updateField(i, "cotas_total", e.target.value)} />
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            {b.status === "error" && (
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
                Salvar Selecionados ({saveable.length} bolsista{saveable.length !== 1 ? "s" : ""})
              </Button>
              {selectedCount > saveable.length && (
                <p className="text-xs text-destructive self-center">
                  {selectedCount - saveable.length} selecionado(s) sem nome (não serão salvos)
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
            <DialogTitle>Editar Bolsista — {editBolsista?.fileName}</DialogTitle>
          </DialogHeader>
          {editBolsista && editIdx !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <Label className="text-xs">Nome do Bolsista *</Label>
                <Input value={editBolsista.nome_bolsista} onChange={e => updateField(editIdx, "nome_bolsista", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={editBolsista.email_bolsista} onChange={e => updateField(editIdx, "email_bolsista", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Modalidade</Label>
                <Select value={editBolsista.modalidade || "none"} onValueChange={v => updateField(editIdx, "modalidade", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {Object.entries(MODALIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Orientador</Label>
                <Input value={editBolsista.orientador} onChange={e => updateField(editIdx, "orientador", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Coorientador</Label>
                <Input value={editBolsista.coorientador} onChange={e => updateField(editIdx, "coorientador", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Coordenador</Label>
                <Input value={editBolsista.coordenador} onChange={e => updateField(editIdx, "coordenador", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Edital</Label>
                <Input value={editBolsista.edital} onChange={e => updateField(editIdx, "edital", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Órgão Financiador</Label>
                <Input value={editBolsista.orgao_financiador} onChange={e => updateField(editIdx, "orgao_financiador", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nº Termo</Label>
                <Input value={editBolsista.numero_termo} onChange={e => updateField(editIdx, "numero_termo", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cotas Total</Label>
                <Input type="number" value={editBolsista.cotas_total} onChange={e => updateField(editIdx, "cotas_total", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={editBolsista.data_inicio} onChange={e => updateField(editIdx, "data_inicio", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={editBolsista.data_fim} onChange={e => updateField(editIdx, "data_fim", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Título do Plano de Trabalho</Label>
                <Input value={editBolsista.titulo_plano} onChange={e => updateField(editIdx, "titulo_plano", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Área de Conhecimento</Label>
                <Input value={editBolsista.area_conhecimento} onChange={e => updateField(editIdx, "area_conhecimento", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">PPG</Label>
                <Input value={editBolsista.ppg_nome} onChange={e => updateField(editIdx, "ppg_nome", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editBolsista.status_bolsista} onValueChange={v => updateField(editIdx, "status_bolsista", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BOLSISTA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FomentoBolsistaBatchImport;
