import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, Plus, Trash2, Upload, Bot, Loader2, Save, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL, MODALIDADE_LABELS, BOLSISTA_STATUS_LABELS } from "@/lib/fomento-utils";
import FomentoDocumentsSection from "./FomentoDocumentsSection";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  projectId?: string;
  onBack: () => void;
}

interface Rubrica { tipo: string; valor: string; }
interface TeamMember { nome: string; funcao: string; email: string; }

const RUBRICA_SUGGESTIONS = ["Bolsas", "Custeio", "Capital", "Diárias", "Passagens"];

interface SectionCardProps {
  id: string;
  title: string;
  children: React.ReactNode;
  openSections: Record<string, boolean>;
  toggleSection: (id: string) => void;
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

const LinkedBolsistas = ({ projectId, navigate }: { projectId: string; navigate: (path: string) => void }) => {
  const { data: linked, isLoading } = useQuery({
    queryKey: ["fomento-bolsistas-linked", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_bolsistas" as any).select("*").eq("project_id", projectId);
      if (error) throw error;
      return data as any[];
    },
  });
  if (isLoading) return <Skeleton className="h-20 rounded-lg" />;
  const items = linked ?? [];
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum bolsista vinculado a este projeto.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bolsista</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Orientador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor/mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/fomento/bolsistas/${b.id}/editar`)}>
                  <TableCell className="font-medium">{b.nome_bolsista}</TableCell>
                  <TableCell><Badge variant="outline">{MODALIDADE_LABELS[b.modalidade || ""] || b.modalidade || "—"}</Badge></TableCell>
                  <TableCell>{b.orientador || "—"}</TableCell>
                  <TableCell><Badge variant={b.status === "ativo" ? "default" : "secondary"}>{BOLSISTA_STATUS_LABELS[b.status || ""] || "—"}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{b.valor_mensal != null ? formatBRL(Number(b.valor_mensal)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => navigate(`/fomento/bolsistas/novo?project_id=${projectId}`)} className="gap-1">
        <GraduationCap className="w-4 h-4" /> Novo Bolsista vinculado
      </Button>
    </div>
  );
};

const FomentoProjectForm = ({ projectId, onBack }: Props) => {
  const { user, fomentoOrgId } = useFomentoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEditing = !!projectId;

  // Form state
  const [processo_uvv, setProcessoUvv] = useState("");
  const [processoAutoGenerated, setProcessoAutoGenerated] = useState(false);
  const [pesquisador_principal, setPesquisador] = useState("");
  const [orgao_financiador, setOrgao] = useState("");
  const [titulo, setTitulo] = useState("");
  const [edital, setEdital] = useState("");
  const [ano, setAno] = useState("");
  const [fonte, setFonte] = useState("");
  const [natureza, setNatureza] = useState("");
  const [area, setArea] = useState("");
  const [tipo_servico, setTipoServico] = useState("");
  const [vinculo_academico, setVinculo] = useState("");
  const [ppg_nome, setPpgNome] = useState("");
  const [valor_total, setValorTotal] = useState("");
  const [data_assinatura, setDataAssinatura] = useState("");
  const [vigencia_inicio, setVigenciaInicio] = useState("");
  const [vigencia_fim, setVigenciaFim] = useState("");
  const [status, setStatus] = useState("em_execucao");
  const [bolsistas_ic, setBolsistasIc] = useState("0");
  const [bolsistas_mestrado, setBolsistasMestrado] = useState("0");
  const [bolsistas_doutorado, setBolsistasDoutorado] = useState("0");
  const [bolsistas_pos_doc, setBolsistasPosDoc] = useState("0");
  const [bolsistas_extensao, setBolsistasExtensao] = useState("0");
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [extractedByAi, setExtractedByAi] = useState(false);

  // AI extraction state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("fomento_anthropic_key") || "");
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<"idle" | "success" | "error">("idle");
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sections open state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ai: true, ident: true, class: true, fin: true, equipe: true, vigencia: true, docs: true, bolsistas: true,
  });

  const toggleSection = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  // Resolve effective org id — fallback to first available org
  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(fomentoOrgId);

  useEffect(() => {
    if (fomentoOrgId) {
      setEffectiveOrgId(fomentoOrgId);
      return;
    }
    // Fallback: fetch first org the user can see
    const fetchOrg = async () => {
      const { data } = await supabase.from("fomento_organizations").select("id").limit(1).single();
      if (data) setEffectiveOrgId(data.id);
    };
    fetchOrg();
  }, [fomentoOrgId]);

  // Auto-generate processo_uvv for new projects
  useEffect(() => {
    if (isEditing || !effectiveOrgId) return;
    const generate = async () => {
      try {
        const { data, error } = await supabase.rpc("generate_fomento_processo" as any, { _org_id: effectiveOrgId });
        if (!error && data) {
          setProcessoUvv(data as string);
          setProcessoAutoGenerated(true);
        }
      } catch {}
    };
    generate();
  }, [isEditing, effectiveOrgId]);

  // Load existing project
  const { isLoading } = useQuery({
    queryKey: ["fomento-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase.from("fomento_projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    meta: { onSuccess: undefined },
  });

  const { data: existingProject } = useQuery({
    queryKey: ["fomento-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase.from("fomento_projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: existingRubricas } = useQuery({
    queryKey: ["fomento-rubricas", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_rubricas").select("*").eq("project_id", projectId!);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: existingTeam } = useQuery({
    queryKey: ["fomento-team", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_team").select("*").eq("project_id", projectId!);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Populate form when data loads
  useEffect(() => {
    if (existingProject) {
      setProcessoUvv(existingProject.processo_uvv || "");
      setPesquisador(existingProject.pesquisador_principal);
      setOrgao(existingProject.orgao_financiador || "");
      setTitulo(existingProject.titulo);
      setEdital(existingProject.edital || "");
      setAno(existingProject.ano ? String(existingProject.ano) : "");
      setFonte(existingProject.fonte || "");
      setNatureza(existingProject.natureza || "");
      setArea(existingProject.area || "");
      setTipoServico(existingProject.tipo_servico || "");
      setVinculo(existingProject.vinculo_academico || "");
      setPpgNome(existingProject.ppg_nome || "");
      setValorTotal(existingProject.valor_total != null ? String(existingProject.valor_total) : "");
      setDataAssinatura(existingProject.data_assinatura || "");
      setVigenciaInicio(existingProject.vigencia_inicio || "");
      setVigenciaFim(existingProject.vigencia_fim || "");
      setStatus(existingProject.status || "em_execucao");
      setBolsistasIc(String(existingProject.bolsistas_ic ?? 0));
      setBolsistasMestrado(String(existingProject.bolsistas_mestrado ?? 0));
      setBolsistasDoutorado(String(existingProject.bolsistas_doutorado ?? 0));
      setBolsistasPosDoc(String(existingProject.bolsistas_pos_doc ?? 0));
      setBolsistasExtensao(String(existingProject.bolsistas_extensao ?? 0));
      setExtractedByAi(existingProject.extracted_by_ai ?? false);
    }
  }, [existingProject]);

  useEffect(() => {
    if (existingRubricas) {
      setRubricas(existingRubricas.map((r) => ({ tipo: r.tipo, valor: String(r.valor) })));
    }
  }, [existingRubricas]);

  useEffect(() => {
    if (existingTeam) {
      setTeam(existingTeam.map((t) => ({ nome: t.nome, funcao: t.funcao || "", email: t.email || "" })));
    }
  }, [existingTeam]);

  // AI Extraction via edge function
  const handleAiExtract = async (file: File) => {
    setExtracting(true);
    setExtractionStatus("idle");
    setRetryMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      setRetryMessage("Extraindo dados do PDF via IA…");
      const { data: result, error } = await supabase.functions.invoke("extract-fomento-pdf", {
        body: { pdfBase64: base64, type: "project" },
      });

      setRetryMessage(null);

      if (error) throw new Error(error.message || "Erro na extração");
      if (result?.error) throw new Error(result.error);

      const parsed = result.data;
      if (parsed.pesquisador_principal) setPesquisador(parsed.pesquisador_principal);
      if (parsed.titulo) setTitulo(parsed.titulo);
      if (parsed.edital) setEdital(parsed.edital);
      if (parsed.orgao_financiador) setOrgao(parsed.orgao_financiador);
      if (parsed.ano) setAno(String(parsed.ano));
      if (parsed.data_assinatura) setDataAssinatura(parsed.data_assinatura);
      if (parsed.vigencia_inicio) setVigenciaInicio(parsed.vigencia_inicio);
      if (parsed.vigencia_fim) setVigenciaFim(parsed.vigencia_fim);
      if (parsed.valor_total) setValorTotal(String(parsed.valor_total));
      if (parsed.fonte) setFonte(parsed.fonte);
      if (parsed.natureza) setNatureza(parsed.natureza);
      if (parsed.rubricas && Array.isArray(parsed.rubricas)) {
        setRubricas(parsed.rubricas.filter((r: any) => r.tipo).map((r: any) => ({ tipo: r.tipo, valor: r.valor != null ? String(r.valor) : "0" })));
      }
      setExtractedByAi(true);
      setExtractionStatus("success");
      toast({ title: "Dados extraídos com sucesso! Revise os campos." });
    } catch (err: any) {
      setRetryMessage(null);
      setExtractionStatus("error");
      toast({ title: "Erro na extração via IA.", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") handleAiExtract(file);
    else toast({ title: "Selecione um arquivo PDF.", variant: "destructive" });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAiExtract(file);
  };

  // Save
  const handleSave = async () => {
    if (!titulo.trim() || !pesquisador_principal.trim()) {
      toast({ title: "Preencha os campos obrigatórios: Título e Pesquisador.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        processo_uvv: processo_uvv || null,
        pesquisador_principal,
        orgao_financiador: orgao_financiador || null,
        titulo,
        edital: edital || null,
        ano: ano ? parseInt(ano) : null,
        fonte: fonte || null,
        natureza: natureza || null,
        area: area || null,
        tipo_servico: area === "servicos" ? tipo_servico || null : null,
        vinculo_academico: vinculo_academico || null,
        ppg_nome: vinculo_academico === "ppg" ? ppg_nome || null : null,
        valor_total: valor_total ? parseFloat(valor_total) : null,
        data_assinatura: data_assinatura || null,
        vigencia_inicio: vigencia_inicio || null,
        vigencia_fim: vigencia_fim || null,
        status: status || "em_execucao",
        bolsistas_ic: parseInt(bolsistas_ic) || 0,
        bolsistas_mestrado: parseInt(bolsistas_mestrado) || 0,
        bolsistas_doutorado: parseInt(bolsistas_doutorado) || 0,
        bolsistas_pos_doc: parseInt(bolsistas_pos_doc) || 0,
        bolsistas_extensao: parseInt(bolsistas_extensao) || 0,
        extracted_by_ai: extractedByAi,
        created_by: user?.id,
        organization_id: effectiveOrgId || fomentoOrgId || null,
      };

      let savedId = projectId;

      if (isEditing && projectId) {
        const { error } = await supabase.from("fomento_projects").update(payload).eq("id", projectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("fomento_projects").insert(payload).select("id").single();
        if (error) throw error;
        savedId = data.id;
      }

      // Upsert rubricas: delete all + re-insert
      if (savedId) {
        await supabase.from("fomento_rubricas").delete().eq("project_id", savedId);
        const validRubricas = rubricas.filter((r) => r.tipo.trim());
        if (validRubricas.length > 0) {
          const { error } = await supabase.from("fomento_rubricas").insert(
            validRubricas.map((r) => ({ project_id: savedId!, tipo: r.tipo, valor: parseFloat(r.valor) || 0 }))
          );
          if (error) throw error;
        }

        // Upsert team
        await supabase.from("fomento_team").delete().eq("project_id", savedId);
        const validTeam = team.filter((t) => t.nome.trim());
        if (validTeam.length > 0) {
          const { error } = await supabase.from("fomento_team").insert(
            validTeam.map((t) => ({ project_id: savedId!, nome: t.nome, funcao: t.funcao || null, email: t.email || null }))
          );
          if (error) throw error;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["fomento-projects"] });
      queryClient.invalidateQueries({ queryKey: ["fomento-rubricas"] });
      queryClient.invalidateQueries({ queryKey: ["fomento-team"] });
      toast({ title: isEditing ? "Projeto atualizado com sucesso." : "Projeto criado com sucesso." });
      onBack();
    } catch (err: any) {
      toast({ title: "Erro ao salvar projeto.", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const sectionProps = { openSections, toggleSection };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            {isEditing ? "Editar Projeto" : "Novo Projeto"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      {extractionStatus === "success" && (
        <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">✅ Extraído via IA — revise os campos</Badge>
      )}
      {extractionStatus === "error" && (
        <Badge variant="destructive">⚠️ Erro na extração — preencha manualmente</Badge>
      )}

      {/* [A] AI Extraction — available on new and edit */}
      {true && (
        <SectionCard {...sectionProps} id="ai" title="[A] Extração via IA">
          <div className="space-y-3">
            <div>
              <Label>Anthropic API Key</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-..." />
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors"
            >
              {extracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  {retryMessage ? (
                    <p className="text-sm text-destructive font-medium">{retryMessage}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Extraindo dados do PDF…</p>
                  )}
                </div>
              ) : (
                <>
                  <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Arraste um PDF aqui ou clique para selecionar</p>
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

      {/* [B] Identification */}
      <SectionCard {...sectionProps} id="ident" title="[B] Identificação">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Processo Interno</Label>
            <div className="relative">
              <Input
                value={processo_uvv}
                onChange={(e) => { setProcessoUvv(e.target.value); setProcessoAutoGenerated(false); }}
                className={processoAutoGenerated ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 pr-36" : ""}
              />
              {processoAutoGenerated && (
                <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  Gerado automaticamente
                </Badge>
              )}
            </div>
          </div>
          <div><Label>Pesquisador Principal *</Label><Input value={pesquisador_principal} onChange={(e) => setPesquisador(e.target.value)} required /></div>
          <div><Label>Órgão Financiador</Label><Input value={orgao_financiador} onChange={(e) => setOrgao(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Título do Projeto *</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required /></div>
          <div><Label>Edital</Label><Input value={edital} onChange={(e) => setEdital(e.target.value)} /></div>
          <div><Label>Ano</Label><Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} /></div>
        </div>
      </SectionCard>

      {/* [C] Classification */}
      <SectionCard {...sectionProps} id="class" title="[C] Classificação">
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Origem do Recurso</Label>
            <RadioGroup value={fonte} onValueChange={setFonte} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="publica" id="fonte-pub" /><Label htmlFor="fonte-pub">Pública</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="privada" id="fonte-priv" /><Label htmlFor="fonte-priv">Privada</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label className="mb-2 block">Natureza</Label>
            <RadioGroup value={natureza} onValueChange={setNatureza} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="auxilio_financeiro" id="nat-aux" /><Label htmlFor="nat-aux">Auxílio Financeiro</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="bolsa" id="nat-bol" /><Label htmlFor="nat-bol">Bolsa</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label className="mb-2 block">Área / Atividade</Label>
            <RadioGroup value={area} onValueChange={setArea} className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="pesquisa" id="area-pesq" /><Label htmlFor="area-pesq">Pesquisa</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="inovacao" id="area-inov" /><Label htmlFor="area-inov">Inovação</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="extensao" id="area-ext" /><Label htmlFor="area-ext">Extensão</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="ensino" id="area-ens" /><Label htmlFor="area-ens">Ensino</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="servicos" id="area-serv" /><Label htmlFor="area-serv">Serviços</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="estagio_tecnico" id="area-est" /><Label htmlFor="area-est">Estágio Técnico</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="participacao_evento" id="area-part" /><Label htmlFor="area-part">Participação em Evento</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="publicacao" id="area-pub" /><Label htmlFor="area-pub">Publicação</Label></div>
            </RadioGroup>
            {area === "servicos" && (
              <div className="mt-3"><Label>Tipo de Serviço</Label><Input value={tipo_servico} onChange={(e) => setTipoServico(e.target.value)} /></div>
            )}
          </div>
          <div>
            <Label className="mb-2 block">Vínculo Acadêmico</Label>
            <RadioGroup value={vinculo_academico} onValueChange={setVinculo} className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="ppg" id="vinc-ppg" /><Label htmlFor="vinc-ppg">Programa de Pós-Graduação</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="graduacao" id="vinc-grad" /><Label htmlFor="vinc-grad">Graduação</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nenhum" id="vinc-nen" /><Label htmlFor="vinc-nen">Nenhum</Label></div>
            </RadioGroup>
            {vinculo_academico === "ppg" && (
              <div className="mt-3">
                <Label>Nome do PPG</Label>
                <Input value={ppg_nome} onChange={(e) => setPpgNome(e.target.value)} placeholder="Ex: PPG em Ciências Ambientais" />
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* [D] Financial */}
      <SectionCard {...sectionProps} id="fin" title="[D] Financeiro">
        <div>
          <Label>Valor Total (R$)</Label>
          <Input type="number" step="0.01" value={valor_total} onChange={(e) => setValorTotal(e.target.value)} placeholder="0.00" />
          {valor_total && <p className="text-xs text-muted-foreground mt-1">{formatBRL(parseFloat(valor_total))}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Rubricas</Label>
            <Button variant="outline" size="sm" onClick={() => setRubricas([...rubricas, { tipo: "", valor: "0" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {rubricas.map((r, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Input placeholder="Tipo" value={r.tipo} onChange={(e) => { const n = [...rubricas]; n[i].tipo = e.target.value; setRubricas(n); }} list="rubrica-suggestions" className="flex-1" />
              <Input type="number" step="0.01" placeholder="Valor" value={r.valor} onChange={(e) => { const n = [...rubricas]; n[i].valor = e.target.value; setRubricas(n); }} className="w-32" />
              <Button variant="ghost" size="icon" onClick={() => setRubricas(rubricas.filter((_, j) => j !== i))} className="text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <datalist id="rubrica-suggestions">
            {RUBRICA_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      </SectionCard>

      {/* [E] Team */}
      <SectionCard {...sectionProps} id="equipe" title="[E] Equipe">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Membros da Equipe</Label>
            <Button variant="outline" size="sm" onClick={() => setTeam([...team, { nome: "", funcao: "", email: "" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {team.map((t, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Input placeholder="Nome" value={t.nome} onChange={(e) => { const n = [...team]; n[i].nome = e.target.value; setTeam(n); }} className="flex-1" />
              <Input placeholder="Função" value={t.funcao} onChange={(e) => { const n = [...team]; n[i].funcao = e.target.value; setTeam(n); }} className="w-32" />
              <Input placeholder="E-mail" type="email" value={t.email} onChange={(e) => { const n = [...team]; n[i].email = e.target.value; setTeam(n); }} className="w-48" />
              <Button variant="ghost" size="icon" onClick={() => setTeam(team.filter((_, j) => j !== i))} className="text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div>
          <Label className="mb-2 block">Bolsistas por Categoria</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div><Label className="text-xs">IC</Label><Input type="number" min="0" value={bolsistas_ic} onChange={(e) => setBolsistasIc(e.target.value)} /></div>
            <div><Label className="text-xs">Mestrado</Label><Input type="number" min="0" value={bolsistas_mestrado} onChange={(e) => setBolsistasMestrado(e.target.value)} /></div>
            <div><Label className="text-xs">Doutorado</Label><Input type="number" min="0" value={bolsistas_doutorado} onChange={(e) => setBolsistasDoutorado(e.target.value)} /></div>
            <div><Label className="text-xs">Pós-Doc</Label><Input type="number" min="0" value={bolsistas_pos_doc} onChange={(e) => setBolsistasPosDoc(e.target.value)} /></div>
            <div><Label className="text-xs">Extensão</Label><Input type="number" min="0" value={bolsistas_extensao} onChange={(e) => setBolsistasExtensao(e.target.value)} /></div>
          </div>
        </div>
      </SectionCard>

      {/* [F] Status & Dates */}
      <SectionCard {...sectionProps} id="vigencia" title="[F] Vigência & Status">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><Label>Data Assinatura</Label><Input type="date" value={data_assinatura} onChange={(e) => setDataAssinatura(e.target.value)} /></div>
          <div><Label>Início Vigência</Label><Input type="date" value={vigencia_inicio} onChange={(e) => setVigenciaInicio(e.target.value)} /></div>
          <div><Label>Fim Vigência</Label><Input type="date" value={vigencia_fim} onChange={(e) => setVigenciaFim(e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_execucao">Em execução</SelectItem>
                <SelectItem value="prestacao_contas">Prestação de Contas</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* [G] Documents */}
      <SectionCard {...sectionProps} id="docs" title="[G] Documentos do Projeto">
        {projectId ? (
          <FomentoDocumentsSection projectId={projectId} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Salve o projeto primeiro para anexar documentos.
          </p>
        )}
      </SectionCard>

      {/* [H] Bolsistas Vinculados */}
      {projectId && (
        <SectionCard {...sectionProps} id="bolsistas" title="[H] Bolsistas Vinculados">
          <LinkedBolsistas projectId={projectId} navigate={navigate} />
        </SectionCard>
      )}

      {/* Bottom save button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Projeto
        </Button>
      </div>
    </div>
  );
};

export default FomentoProjectForm;
