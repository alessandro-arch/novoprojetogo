import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Send, Lock, Plus, FileText, Settings, Inbox, ClipboardCheck, AlertTriangle, Trash2, Copy, Eye, EyeOff, ShieldCheck, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormKnowledgeAreas from "@/components/org/FormKnowledgeAreas";
import FormSectionBuilder from "@/components/org/FormSectionBuilder";
import FormPreview from "@/components/org/FormPreview";
import SubmissionsList from "@/components/org/SubmissionsList";
import ReviewManagement from "@/components/org/ReviewManagement";
import ProposalDistribution from "@/components/org/ProposalDistribution";
import ScoringCriteriaManager from "@/components/org/ScoringCriteriaManager";
import IdentityReveal from "@/components/org/IdentityReveal";
import FormSelector from "@/components/org/FormSelector";
import EditalTimeline from "@/components/org/EditalTimeline";
import {
  getComputedStatus,
  getStatusVariant,
  getAllowedTransitions,
  type ComputedEditalStatus,
  type DbEditalStatus,
  type WorkflowTransition,
} from "@/lib/edital-status";

interface Edital {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  review_deadline: string | null;
  min_reviewers_per_proposal: number | null;
  blind_review_enabled: boolean;
  is_public: boolean;
}

// ─── Blind Review Settings Component ───
const BlindReviewSettings = ({ editalId, blindReviewEnabled }: { editalId: string; blindReviewEnabled: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(blindReviewEnabled);
  const [prefix, setPrefix] = useState("");
  const [strategy, setStrategy] = useState("sequential");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasSubmittedReviews, setHasSubmittedReviews] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingConfig(true);
      const [editalRes, reviewsRes] = await Promise.all([
        supabase.from("editais").select("blind_review_enabled, blind_code_prefix, blind_code_strategy").eq("id", editalId).single(),
        supabase.from("review_assignments").select("id", { count: "exact", head: true }).eq("status", "submitted").in("proposal_id",
          supabase.from("proposals").select("id").eq("edital_id", editalId) as any
        ),
      ]);
      if (editalRes.data) {
        setEnabled(editalRes.data.blind_review_enabled);
        setPrefix((editalRes.data as any).blind_code_prefix || "");
        setStrategy((editalRes.data as any).blind_code_strategy || "sequential");
      }
      // Check for submitted reviews
      const { count } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .in("proposal_id", (await supabase.from("proposals").select("id").eq("edital_id", editalId)).data?.map((p: any) => p.id) || []);
      setHasSubmittedReviews((count || 0) > 0);
      setLoadingConfig(false);
    };
    load();
  }, [editalId]);

  const handleToggle = async (newValue: boolean) => {
    if (hasSubmittedReviews) {
      toast({ title: "Não é possível alterar", description: "Existem avaliações já submetidas para este edital.", variant: "destructive" });
      return;
    }
    // If changing, show confirm
    setConfirmOpen(true);
  };

  const confirmToggle = async () => {
    setSaving(true);
    const newValue = !enabled;
    const { error } = await supabase.from("editais").update({
      blind_review_enabled: newValue,
    } as any).eq("id", editalId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setEnabled(newValue);
      // Audit log
      if (user) {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "blind_review_toggled",
          entity: "edital",
          entity_id: editalId,
          metadata_json: { blind_review_enabled: newValue, previous: !newValue },
        });
      }
      toast({ title: `Avaliação cega ${newValue ? "ativada" : "desativada"}` });
    }
    setSaving(false);
    setConfirmOpen(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    const { error } = await supabase.from("editais").update({
      blind_code_prefix: prefix || null,
      blind_code_strategy: strategy,
    } as any).eq("id", editalId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva!" });
    }
    setSaving(false);
  };

  if (loadingConfig) return <Card><CardContent className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></CardContent></Card>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Avaliação Cega (Blind Review)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex-1">
              <Label className="text-sm font-medium">Ativar Avaliação Cega</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Ao ativar, os avaliadores não terão acesso a nome, CPF, instituição ou qualquer dado pessoal do proponente.
                O sistema exibirá apenas um código cego e o conteúdo técnico.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={hasSubmittedReviews || saving}
            />
          </div>

          {hasSubmittedReviews && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">
                Não é possível alterar o modo de avaliação cega porque já existem avaliações submetidas para este edital.
              </p>
            </div>
          )}

          {enabled && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Prefixo do Código Cego</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder={`ED${new Date().getFullYear()}`}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Ex: ED2026, FAPES-2026</p>
                </div>
                <div>
                  <Label className="text-sm">Estratégia de Código</Label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">Sequencial (ED2026-001)</SelectItem>
                      <SelectItem value="uuid_short">Aleatório (ED2026-A7K3QZ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={handleSaveConfig} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Salvar Configurações
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{enabled ? "Desativar" : "Ativar"} Avaliação Cega</DialogTitle>
            <DialogDescription>
              {enabled
                ? "Ao desativar, os avaliadores poderão ver os dados do proponente. Deseja continuar?"
                : "Ao ativar, os avaliadores não terão acesso aos dados pessoais do proponente. Deseja continuar?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={confirmToggle} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const EditalDetail = ({ edital, orgId, onBack, onDuplicate }: { edital: Edital; orgId: string; onBack: () => void; onDuplicate?: (sourceEdital: Edital) => void }) => {
  const { user, globalRole, membership } = useAuth();
  const { toast } = useToast();
  const [dbStatus, setDbStatus] = useState(edital.status);
  const [startDate, setStartDate] = useState(edital.start_date);
  const [endDate, setEndDate] = useState(edital.end_date);
  const [editingDates, setEditingDates] = useState(false);
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Workflow transition state
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<WorkflowTransition | null>(null);
  const [transitionInput, setTransitionInput] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // Form state
  const [formId, setFormId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState("draft");
  const [loadingForm, setLoadingForm] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const computedStatus = getComputedStatus(dbStatus, startDate, endDate);
  const isReadOnly = ["Encerrado", "Em Avaliação", "Resultado Preliminar", "Resultado Final", "Homologado", "Outorgado", "Cancelado"].includes(computedStatus);
  const isRascunho = computedStatus === "Rascunho";
  const isCancelled = dbStatus === "cancelado";
  const isGestorMaster = globalRole === "icca_admin" || membership?.role === "org_admin";

  const canEditDates = isRascunho || computedStatus === "Agendado" || (dbStatus === "published" && isGestorMaster);

  const allowedTransitions = isGestorMaster ? getAllowedTransitions(dbStatus, startDate, endDate) : [];

  useEffect(() => { loadForm(); }, [edital.id]);

  const loadForm = async () => {
    setLoadingForm(true);
    const { data } = await supabase
      .from("edital_forms")
      .select("id, status")
      .eq("edital_id", edital.id)
      .maybeSingle();
    setFormId(data?.id || null);
    setFormStatus((data as any)?.status || "draft");
    setLoadingForm(false);
  };

  const handleCreateForm = async () => {
    if (!user) return;
    setCreatingForm(true);
    const { data, error } = await supabase
      .from("edital_forms")
      .insert({ edital_id: edital.id, organization_id: orgId, status: "draft" })
      .select()
      .single();
    setCreatingForm(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setFormId(data.id);
      setFormStatus("draft");
      toast({ title: "Formulário criado!" });
    }
  };

  const handlePublishEdital = async () => {
    if (!edital.title?.trim()) {
      toast({ title: "Título obrigatório", description: "O edital precisa de um título.", variant: "destructive" });
      return;
    }
    if (!edital.description?.trim()) {
      toast({ title: "Descrição obrigatória", description: "O edital precisa de uma descrição.", variant: "destructive" });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: "Datas obrigatórias", description: "Defina as datas de abertura e encerramento antes de publicar.", variant: "destructive" });
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast({ title: "Datas inválidas", description: "A data de encerramento deve ser posterior à de abertura.", variant: "destructive" });
      return;
    }
    if (!formId) {
      toast({ title: "Formulário necessário", description: "Crie e configure o formulário antes de publicar.", variant: "destructive" });
      return;
    }

    setPublishing(true);
    const [secRes, qRes, criteriaRes] = await Promise.all([
      supabase.from("form_sections").select("id").eq("form_id", formId),
      supabase.from("form_questions").select("id").eq("form_id", formId),
      supabase.from("scoring_criteria").select("id").eq("edital_id", edital.id),
    ]);

    if (!secRes.data || secRes.data.length === 0) {
      toast({ title: "Formulário incompleto", description: "Adicione pelo menos 1 seção ao formulário.", variant: "destructive" });
      setPublishing(false);
      return;
    }
    if (!qRes.data || qRes.data.length === 0) {
      toast({ title: "Formulário incompleto", description: "Adicione pelo menos 1 pergunta ao formulário.", variant: "destructive" });
      setPublishing(false);
      return;
    }
    if (!criteriaRes.data || criteriaRes.data.length === 0) {
      toast({ title: "Critérios obrigatórios", description: "Defina pelo menos 1 critério de avaliação antes de publicar.", variant: "destructive" });
      setPublishing(false);
      return;
    }

    const { error } = await supabase
      .from("editais")
      .update({ status: "published" as any, published_at: new Date().toISOString() } as any)
      .eq("id", edital.id);

    setPublishing(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setDbStatus("published");
      toast({ title: "Edital publicado com sucesso!" });
    }
  };

  const handleDeleteEdital = async () => {
    const { count } = await supabase
      .from("edital_submissions")
      .select("id", { count: "exact", head: true })
      .eq("edital_id", edital.id)
      .eq("status", "submitted");
    if (count && count > 0) {
      toast({ title: "Não é possível excluir", description: "Este edital possui inscrições submetidas.", variant: "destructive" });
      setConfirmDeleteOpen(false);
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("editais")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", edital.id);
    setDeleting(false);
    setConfirmDeleteOpen(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Edital excluído com sucesso." });
      onBack();
    }
  };

  const openTransitionDialog = (transition: WorkflowTransition) => {
    setPendingTransition(transition);
    setTransitionInput("");
    setTransitionDialogOpen(true);
  };

  const handleTransition = async () => {
    if (!pendingTransition || !user) return;

    // Validate required inputs
    if (pendingTransition.requiresInput === "end_date") {
      if (!transitionInput) {
        toast({ title: "Data obrigatória", description: "Informe a nova data de encerramento.", variant: "destructive" });
        return;
      }
      if (new Date(transitionInput) <= new Date()) {
        toast({ title: "Data inválida", description: "A nova data deve ser futura.", variant: "destructive" });
        return;
      }
    }
    if (pendingTransition.requiresInput === "cancellation_reason" && !transitionInput.trim()) {
      toast({ title: "Justificativa obrigatória", description: "Informe o motivo do cancelamento.", variant: "destructive" });
      return;
    }

    setTransitioning(true);

    const updatePayload: Record<string, any> = {
      status: pendingTransition.targetStatus,
    };

    if (pendingTransition.requiresInput === "end_date") {
      updatePayload.end_date = new Date(transitionInput).toISOString();
    }
    if (pendingTransition.requiresInput === "cancellation_reason") {
      updatePayload.cancellation_reason = transitionInput.trim();
    }

    const { error } = await supabase
      .from("editais")
      .update(updatePayload as any)
      .eq("id", edital.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setTransitioning(false);
      return;
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      organization_id: orgId,
      entity: "edital",
      entity_id: edital.id,
      action: `edital.${pendingTransition.targetStatus}`,
      metadata_json: {
        from_status: dbStatus,
        to_status: pendingTransition.targetStatus,
        ...(pendingTransition.requiresInput === "end_date" && { new_end_date: transitionInput }),
        ...(pendingTransition.requiresInput === "cancellation_reason" && { reason: transitionInput.trim() }),
      },
    });

    setDbStatus(pendingTransition.targetStatus);
    if (pendingTransition.requiresInput === "end_date") {
      setEndDate(new Date(transitionInput).toISOString());
    }
    setTransitioning(false);
    setTransitionDialogOpen(false);
    toast({ title: `Status atualizado para "${pendingTransition.label}"` });
  };

  const handleSaveDates = async () => {
    if (!tempStart || !tempEnd) {
      toast({ title: "Preencha ambas as datas", variant: "destructive" });
      return;
    }
    if (new Date(tempEnd) <= new Date(tempStart)) {
      toast({ title: "Datas inválidas", description: "Encerramento deve ser posterior à abertura.", variant: "destructive" });
      return;
    }
    const newStart = new Date(tempStart).toISOString();
    const newEnd = new Date(tempEnd).toISOString();
    const { error } = await supabase
      .from("editais")
      .update({ start_date: newStart, end_date: newEnd })
      .eq("id", edital.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setStartDate(newStart);
      setEndDate(newEnd);
      setEditingDates(false);
      toast({ title: "Datas atualizadas!" });
    }
  };

  const formatDateTime = (dt: string) => new Date(dt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const toInputValue = (dt: string | null) => {
    if (!dt) return "";
    const d = new Date(dt);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const showFormTab = true;
  const showSubmissionsTab = true;
  const showReviewsTab = !isRascunho;
  const showSettingsTab = isRascunho || dbStatus === "published";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold font-heading text-foreground">{edital.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={getStatusVariant(computedStatus)}>{computedStatus}</Badge>
            {isReadOnly && !isCancelled && (
              <span className="text-xs text-muted-foreground">(somente leitura)</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {dbStatus === "draft" && (
            <Button size="sm" onClick={handlePublishEdital} disabled={publishing}>
              {publishing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Send className="w-4 h-4 mr-1" /> Publicar
            </Button>
          )}
          {dbStatus === "draft" && isGestorMaster && (
            <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir
            </Button>
          )}
          {isGestorMaster && onDuplicate && !isCancelled && (
            <Button size="sm" variant="outline" onClick={() => onDuplicate(edital)}>
              <Copy className="w-4 h-4 mr-1" /> Duplicar
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Timeline */}
      <div className="mb-6">
        <EditalTimeline
          editalId={edital.id}
          currentStatus={dbStatus}
          isCancelled={isCancelled}
          isGestor={isGestorMaster}
          startDate={startDate}
          endDate={endDate}
          allowedTransitions={allowedTransitions}
          onTransition={openTransitionDialog}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="form">
            {isRascunho ? "Configurar Formulário" : "Formulário"}
          </TabsTrigger>
          <TabsTrigger value="submissions">
            <Inbox className="w-4 h-4 mr-1" /> Submissões
          </TabsTrigger>
          {showReviewsTab && (
            <TabsTrigger value="reviews">
              <ClipboardCheck className="w-4 h-4 mr-1" /> Avaliação
            </TabsTrigger>
          )}
          {showSettingsTab && (
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-1" /> Configurações
            </TabsTrigger>
          )}
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo do Edital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Título</Label>
                <p className="text-foreground font-medium">{edital.title}</p>
              </div>
              {edital.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="text-foreground">{edital.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Data de criação</Label>
                  <p className="text-foreground">{new Date(edital.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="text-foreground">{computedStatus}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Abertura</Label>
                  <p className="text-foreground">{startDate ? formatDateTime(startDate) : "Não definida"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Encerramento</Label>
                  <p className="text-foreground">{endDate ? formatDateTime(endDate) : "Não definido"}</p>
                </div>
              </div>

              {canEditDates && !isReadOnly && (
                <div className="pt-2">
                  {!editingDates ? (
                    <Button size="sm" variant="outline" onClick={() => {
                      setTempStart(toInputValue(startDate));
                      setTempEnd(toInputValue(endDate));
                      setEditingDates(true);
                    }}>
                      Editar datas
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Abertura</Label>
                          <Input type="datetime-local" value={tempStart} onChange={e => setTempStart(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <Label>Encerramento</Label>
                          <Input type="datetime-local" value={tempEnd} onChange={e => setTempEnd(e.target.value)} className="mt-1" />
                        </div>
                      </div>
                      {tempStart && tempEnd && new Date(tempEnd) <= new Date(tempStart) && (
                        <p className="text-sm text-destructive">Encerramento deve ser posterior à abertura.</p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveDates}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDates(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formulário */}
        <TabsContent value="form">
          {isReadOnly && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-muted bg-muted/30 mb-4">
              <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">Formulário em modo somente leitura.</p>
            </div>
          )}

          {/* Form Library Link */}
          {!isReadOnly && (
            <div className="mb-6">
              <FormSelector
                editalId={edital.id}
                orgId={orgId}
                currentFormId={(edital as any).form_id ?? null}
                onFormLinked={() => {}}
              />
            </div>
          )}

          {loadingForm ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !formId ? (
            <>
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhum formulário criado para este edital.</p>
                  {!isReadOnly && (
                    <Button onClick={handleCreateForm} disabled={creatingForm}>
                      {creatingForm && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Plus className="w-4 h-4 mr-2" /> Criar Formulário
                    </Button>
                  )}
                </CardContent>
              </Card>
              <FormKnowledgeAreas formId={null} />
            </>
          ) : showPreview ? (
            <FormPreview formId={formId} editalId={edital.id} onBack={() => setShowPreview(false)} />
          ) : (
            <div className="space-y-6">
              <FormSectionBuilder
                formId={formId}
                formStatus={formStatus}
                editalId={edital.id}
                editalDbStatus={dbStatus}
                onStatusChange={(s) => setFormStatus(s)}
                onPreview={() => setShowPreview(true)}
              />
              <FormKnowledgeAreas formId={formId} />
            </div>
          )}
        </TabsContent>

        {/* Submissões */}
        <TabsContent value="submissions">
          <SubmissionsList editalId={edital.id} editalTitle={edital.title} orgId={orgId} />
        </TabsContent>

        {/* Avaliação */}
        {showReviewsTab && (
          <TabsContent value="reviews">
            <Tabs defaultValue="distribution">
              <TabsList className="mb-4">
                <TabsTrigger value="distribution">Distribuição</TabsTrigger>
                <TabsTrigger value="tracking">Acompanhamento</TabsTrigger>
                <TabsTrigger value="consolidation">Consolidação</TabsTrigger>
                <TabsTrigger value="final">Parecer Final</TabsTrigger>
              </TabsList>
              <TabsContent value="distribution">
                <ProposalDistribution
                  editalId={edital.id}
                  orgId={orgId}
                  minReviewers={edital.min_reviewers_per_proposal || 2}
                />
              </TabsContent>
              <TabsContent value="tracking">
                <ReviewManagement editalId={edital.id} editalTitle={edital.title} />
              </TabsContent>
              <TabsContent value="consolidation">
                <Card>
                  <CardContent className="py-12 text-center">
                    <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Consolidação de avaliações será implementada na próxima iteração.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="final">
                <Card>
                  <CardContent className="py-12 text-center">
                    <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Parecer final será implementado na próxima iteração.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        {/* Configurações */}
        {showSettingsTab && (
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Visibility Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Visibilidade do Edital
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Edital Público</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Editais públicos aparecem na página inicial para qualquer visitante. Editais privados ficam restritos à organização.
                      </p>
                    </div>
                    <Switch
                      checked={(edital as any).is_public ?? false}
                      disabled={!["draft", "published"].includes(edital.status)}
                      onCheckedChange={async (val) => {
                        const { error } = await supabase.from("editais").update({ is_public: val } as any).eq("id", edital.id);
                        if (!error) {
                          (edital as any).is_public = val;
                          toast({ title: val ? "Edital agora é público" : "Edital agora é privado" });
                        }
                      }}
                    />
                  </div>
                  {!["draft", "published"].includes(edital.status) && (
                    <p className="text-xs text-muted-foreground">A visibilidade só pode ser alterada em editais com status Rascunho ou Publicado.</p>
                  )}
                </CardContent>
              </Card>

              {/* Blind Review Config */}
              <BlindReviewSettings editalId={edital.id} blindReviewEnabled={edital.blind_review_enabled} />

              {/* Min reviewers config */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Número de Avaliadores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-w-xs">
                    <Label>Mínimo de avaliadores por proposta</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={edital.min_reviewers_per_proposal || 2}
                      onChange={async (e) => {
                        const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 2));
                        await supabase.from("editais").update({ min_reviewers_per_proposal: val }).eq("id", edital.id);
                      }}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">De 1 a 10. Governa a distribuição e alertas.</p>
                  </div>
                </CardContent>
              </Card>
              <ScoringCriteriaManager editalId={edital.id} />
              <IdentityReveal
                editalId={edital.id}
                editalTitle={edital.title}
                editalStatus={dbStatus}
                proposals={[]}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Edital</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Deseja realmente excluir este edital?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteEdital} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Trash2 className="w-4 h-4 mr-1" /> Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow transition dialog */}
      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingTransition?.label}</DialogTitle>
            <DialogDescription>
              {pendingTransition?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {pendingTransition?.requiresInput === "end_date" && (
              <div>
                <Label>Nova data/hora de encerramento <span className="text-destructive">*</span></Label>
                <Input
                  type="datetime-local"
                  value={transitionInput}
                  onChange={e => setTransitionInput(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            {pendingTransition?.requiresInput === "cancellation_reason" && (
              <div>
                <Label>Justificativa do cancelamento <span className="text-destructive">*</span></Label>
                <Textarea
                  value={transitionInput}
                  onChange={e => setTransitionInput(e.target.value)}
                  placeholder="Informe o motivo do cancelamento..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            )}
            {!pendingTransition?.requiresInput && (
              <p className="text-sm text-muted-foreground">
                Confirma a transição do edital para <strong>{pendingTransition?.label}</strong>?
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransitionDialogOpen(false)}>Cancelar</Button>
            <Button
              variant={pendingTransition?.variant === "destructive" ? "destructive" : "default"}
              onClick={handleTransition}
              disabled={transitioning}
            >
              {transitioning && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditalDetail;
