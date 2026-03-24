import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, Upload, Bot, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL, MODALIDADE_LABELS, BOLSISTA_STATUS_LABELS, MODALIDADE_VALORES_SUGERIDOS } from "@/lib/fomento-utils";
import FomentoDocumentsSection from "./FomentoDocumentsSection";

interface Props {
  bolsistaId?: string;
  onBack: () => void;
}

interface SectionCardProps {
  id: string; title: string; children: React.ReactNode;
  openSections: Record<string, boolean>; toggleSection: (id: string) => void;
}

const SectionCard = ({ id, title, children, openSections, toggleSection }: SectionCardProps) => (
  <Collapsible open={openSections[id]} onOpenChange={() => toggleSection(id)}>
    <Card className="shadow-sm">
      <CollapsibleTrigger asChild>
        <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardTitle className="text-sm flex items-center justify-between">
            {title}
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections[id] ? "rotate-180" : ""}`} />
          </CardTitle>
        </CardHeader>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="pt-0 space-y-4">{children}</CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
);

const FomentoBolsistaForm = ({ bolsistaId, onBack }: Props) => {
  const { user, fomentoOrgId } = useFomentoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isEditing = !!bolsistaId;

  // Form state
  const [nome_bolsista, setNome] = useState("");
  const [email_bolsista, setEmail] = useState("");
  const [cpf_bolsista, setCpf] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [orientador, setOrientador] = useState("");
  const [coorientador, setCoorientador] = useState("");
  const [coordenador, setCoordenador] = useState("");
  const [edital, setEdital] = useState("");
  const [orgao_financiador, setOrgao] = useState("");
  const [numero_termo, setNumeroTermo] = useState("");
  const [cotas_total, setCotasTotal] = useState("");
  const [data_inicio, setDataInicio] = useState("");
  const [data_fim, setDataFim] = useState("");
  const [valor_mensal, setValorMensal] = useState("");
  const [status, setStatus] = useState("ativo");
  const [ppg_nome, setPpgNome] = useState("");
  const [titulo_plano, setTituloPlano] = useState("");
  const [area_conhecimento, setAreaConhecimento] = useState("");
  const [project_id, setProjectId] = useState(searchParams.get("project_id") || "");
  const [extractedByAi, setExtractedByAi] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("fomento_anthropic_key") || "");
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<"idle" | "success" | "error">("idle");
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ai: true, dados: true, acad: true, editalSec: true, vig: true, valor: true, vinculo: true, docs: true, statusSec: true,
  });
  const toggleSection = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  // Load existing
  const { data: existing, isLoading } = useQuery({
    queryKey: ["fomento-bolsista", bolsistaId],
    queryFn: async () => {
      if (!bolsistaId) return null;
      const { data, error } = await supabase.from("fomento_bolsistas" as any).select("*").eq("id", bolsistaId).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!bolsistaId,
  });

  // Load projects for linking
  const { data: projects } = useQuery({
    queryKey: ["fomento-projects-select", fomentoOrgId],
    queryFn: async () => {
      let query = supabase.from("fomento_projects").select("id, titulo, pesquisador_principal");
      if (fomentoOrgId) query = query.eq("organization_id", fomentoOrgId);
      const { data, error } = await query.order("titulo");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setNome(existing.nome_bolsista || "");
      setEmail(existing.email_bolsista || "");
      setCpf(existing.cpf_bolsista || "");
      setModalidade(existing.modalidade || "");
      setOrientador(existing.orientador || "");
      setCoorientador(existing.coorientador || "");
      setCoordenador(existing.coordenador || "");
      setEdital(existing.edital || "");
      setOrgao(existing.orgao_financiador || "");
      setNumeroTermo(existing.numero_termo || "");
      setCotasTotal(existing.cotas_total != null ? String(existing.cotas_total) : "");
      setDataInicio(existing.data_inicio || "");
      setDataFim(existing.data_fim || "");
      setValorMensal(existing.valor_mensal != null ? String(existing.valor_mensal) : "");
      setStatus(existing.status || "ativo");
      setPpgNome(existing.ppg_nome || "");
      setTituloPlano(existing.titulo_plano || "");
      setAreaConhecimento(existing.area_conhecimento || "");
      setProjectId(existing.project_id || "");
      setExtractedByAi(existing.extracted_by_ai ?? false);
    }
  }, [existing]);

  // Suggest valor when modalidade changes (only if valor_mensal is empty)
  const handleModalidadeChange = (val: string) => {
    setModalidade(val);
    if (!valor_mensal && MODALIDADE_VALORES_SUGERIDOS[val]) {
      setValorMensal(String(MODALIDADE_VALORES_SUGERIDOS[val]));
    }
  };

  // Calculated total
  const cotasNum = parseInt(cotas_total) || 0;
  const mensalNum = parseFloat(valor_mensal) || 0;
  const totalCalc = cotasNum * mensalNum;

  // AI Extraction via edge function
  const handleAiExtract = async (file: File) => {
    setExtracting(true); setExtractionStatus("idle"); setRetryMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      setRetryMessage("Extraindo dados do PDF via IA…");
      const { data: result, error } = await supabase.functions.invoke("extract-fomento-pdf", {
        body: { pdfBase64: base64, type: "bolsista" },
      });
      setRetryMessage(null);

      if (error) throw new Error(error.message || "Erro na extração");
      if (result?.error) throw new Error(result.error);

      const p = result.data;
      if (p.nome_bolsista) setNome(p.nome_bolsista);
      if (p.email_bolsista) setEmail(p.email_bolsista);
      if (p.modalidade) setModalidade(p.modalidade);
      if (p.orientador) setOrientador(p.orientador);
      if (p.coorientador) setCoorientador(p.coorientador);
      if (p.coordenador) setCoordenador(p.coordenador);
      if (p.edital) setEdital(p.edital);
      if (p.orgao_financiador) setOrgao(p.orgao_financiador);
      if (p.numero_termo) setNumeroTermo(p.numero_termo);
      if (p.cotas_total) setCotasTotal(String(p.cotas_total));
      if (p.data_inicio) setDataInicio(p.data_inicio);
      if (p.data_fim) setDataFim(p.data_fim);
      if (p.titulo_plano) setTituloPlano(p.titulo_plano);
      if (p.area_conhecimento) setAreaConhecimento(p.area_conhecimento);
      if (p.ppg_nome) setPpgNome(p.ppg_nome);
      setExtractedByAi(true); setExtractionStatus("success");
      toast({ title: "Dados extraídos com sucesso! Revise os campos." });
    } catch (err: any) {
      setRetryMessage(null); setExtractionStatus("error");
      toast({ title: "Erro na extração via IA.", description: err.message, variant: "destructive" });
    } finally { setExtracting(false); }
  };

  const handleFileDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type === "application/pdf") handleAiExtract(f); else toast({ title: "Selecione um PDF.", variant: "destructive" }); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleAiExtract(f); };

  // Save
  const handleSave = async () => {
    if (!nome_bolsista.trim()) { toast({ title: "Preencha o nome do bolsista.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        nome_bolsista, email_bolsista: email_bolsista || null, cpf_bolsista: cpf_bolsista || null,
        modalidade: modalidade || null, orientador: orientador || null, coorientador: coorientador || null,
        coordenador: coordenador || null, edital: edital || null, orgao_financiador: orgao_financiador || null,
        numero_termo: numero_termo || null, cotas_total: cotas_total ? parseInt(cotas_total) : null,
        data_inicio: data_inicio || null, data_fim: data_fim || null,
        valor_mensal: valor_mensal ? parseFloat(valor_mensal) : null,
        status: status || "ativo", ppg_nome: ppg_nome || null, titulo_plano: titulo_plano || null,
        area_conhecimento: area_conhecimento || null, project_id: project_id || null,
        extracted_by_ai: extractedByAi, created_by: user?.id, organization_id: fomentoOrgId || null,
      };

      if (isEditing && bolsistaId) {
        const { error } = await supabase.from("fomento_bolsistas" as any).update(payload).eq("id", bolsistaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fomento_bolsistas" as any).insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["fomento-bolsistas"] });
      toast({ title: isEditing ? "Bolsista atualizado." : "Bolsista criado." });
      onBack();
    } catch (err: any) {
      toast({ title: "Erro ao salvar.", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (isEditing && isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;

  const sectionProps = { openSections, toggleSection };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-2xl font-bold font-heading text-foreground">{isEditing ? "Editar Bolsista" : "Novo Bolsista"}</h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </Button>
      </div>

      {extractionStatus === "success" && <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">✅ Extraído via IA — revise os campos</Badge>}
      {extractionStatus === "error" && <Badge variant="destructive">⚠️ Erro na extração — preencha manualmente</Badge>}

      {/* [A] AI Extraction */}
      {!isEditing && (
        <SectionCard {...sectionProps} id="ai" title="[A] Extração via IA (PDF de Bolsa)">
          <div className="space-y-3">
            <div><Label>Anthropic API Key</Label><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-..." /></div>
            <div onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop} className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              {extracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  {retryMessage ? <p className="text-sm text-destructive font-medium">{retryMessage}</p> : <p className="text-sm text-muted-foreground">Extraindo dados do PDF…</p>}
                </div>
              ) : (
                <>
                  <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Arraste um PDF de formulário de bolsa ou clique para selecionar</p>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" /> Selecionar PDF</span></Button>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                  </label>
                </>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* [B] Dados do Bolsista */}
      <SectionCard {...sectionProps} id="dados" title="[B] Dados do Bolsista">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Nome do Bolsista *</Label><Input value={nome_bolsista} onChange={(e) => setNome(e.target.value)} required /></div>
          <div><Label>E-mail</Label><Input type="email" value={email_bolsista} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>CPF</Label><Input value={cpf_bolsista} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
        </div>
      </SectionCard>

      {/* [C] Dados Acadêmicos */}
      <SectionCard {...sectionProps} id="acad" title="[C] Dados Acadêmicos">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Modalidade</Label>
            <Select value={modalidade} onValueChange={handleModalidadeChange}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(MODALIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Orientador</Label><Input value={orientador} onChange={(e) => setOrientador(e.target.value)} /></div>
          <div><Label>Coorientador</Label><Input value={coorientador} onChange={(e) => setCoorientador(e.target.value)} /></div>
          <div><Label>Coordenador</Label><Input value={coordenador} onChange={(e) => setCoordenador(e.target.value)} /></div>
          <div><Label>PPG</Label><Input value={ppg_nome} onChange={(e) => setPpgNome(e.target.value)} /></div>
          <div><Label>Título do Plano</Label><Input value={titulo_plano} onChange={(e) => setTituloPlano(e.target.value)} /></div>
          <div className="md:col-span-2 lg:col-span-3"><Label>Área do Conhecimento</Label><Input value={area_conhecimento} onChange={(e) => setAreaConhecimento(e.target.value)} /></div>
        </div>
      </SectionCard>

      {/* [D] Edital */}
      <SectionCard {...sectionProps} id="editalSec" title="[D] Edital e Financiador">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Edital</Label><Input value={edital} onChange={(e) => setEdital(e.target.value)} /></div>
          <div><Label>Órgão Financiador</Label><Input value={orgao_financiador} onChange={(e) => setOrgao(e.target.value)} /></div>
          <div><Label>Nº do Termo</Label><Input value={numero_termo} onChange={(e) => setNumeroTermo(e.target.value)} /></div>
        </div>
      </SectionCard>

      {/* [E] Vigência */}
      <SectionCard {...sectionProps} id="vig" title="[E] Vigência">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Cotas (meses)</Label><Input type="number" min="0" value={cotas_total} onChange={(e) => setCotasTotal(e.target.value)} /></div>
          <div><Label>Data Início</Label><Input type="date" value={data_inicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
          <div><Label>Data Fim</Label><Input type="date" value={data_fim} onChange={(e) => setDataFim(e.target.value)} /></div>
        </div>
      </SectionCard>

      {/* [F] Valor */}
      <SectionCard {...sectionProps} id="valor" title="[F] Valor da Bolsa">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Valor Mensal (R$)</Label>
            <Input type="number" step="0.01" value={valor_mensal} onChange={(e) => setValorMensal(e.target.value)} placeholder="0.00" />
            {modalidade && MODALIDADE_VALORES_SUGERIDOS[modalidade] ? (
              <p className="text-xs text-muted-foreground mt-1">Sugerido (FAPES 2025): {formatBRL(MODALIDADE_VALORES_SUGERIDOS[modalidade])}</p>
            ) : null}
          </div>
          <div>
            <Label>Cotas (meses)</Label>
            <Input type="number" value={cotas_total} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Valor Total Calculado</Label>
            <Input value={totalCalc > 0 ? formatBRL(totalCalc) : "—"} disabled className="bg-muted font-mono" />
          </div>
        </div>
      </SectionCard>

      {/* [G] Vínculo a Projeto */}
      <SectionCard {...sectionProps} id="vinculo" title="[G] Vínculo a Projeto (Opcional)">
        <div>
          <Label>Projeto</Label>
          <Select value={project_id} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Nenhum projeto vinculado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nenhum</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.titulo} — {p.pesquisador_principal}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* [H] Documentos — placeholder until saved */}
      <SectionCard {...sectionProps} id="docs" title="[H] Documentos">
        <p className="text-sm text-muted-foreground text-center py-4">
          Para anexar documentos, utilize a seção de documentos do projeto vinculado.
        </p>
      </SectionCard>

      {/* [I] Status */}
      <SectionCard {...sectionProps} id="statusSec" title="[I] Status">
        <div className="max-w-xs">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BOLSISTA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Bolsista
        </Button>
      </div>
    </div>
  );
};

export default FomentoBolsistaForm;
