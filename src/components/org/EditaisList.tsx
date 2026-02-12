import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ScrollText, Search, Copy, AlertTriangle, Globe } from "lucide-react";
import EditalDetail from "@/components/org/EditalDetail";
import { getComputedStatus, getStatusVariant } from "@/lib/edital-status";

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

const EditaisList = ({ orgId }: { orgId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  // Duplicate state
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [dupSource, setDupSource] = useState<Edital | null>(null);
  const [dupTitle, setDupTitle] = useState("");
  const [dupCloneForm, setDupCloneForm] = useState(true);
  const [dupCloneAreas, setDupCloneAreas] = useState(true);
  const [dupCloneCriteria, setDupCloneCriteria] = useState(true);
  const [dupCloneReviewers, setDupCloneReviewers] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const fetchEditais = async () => {
    setLoading(true);
    let query = supabase.from("editais").select("*").eq("organization_id", orgId).is("deleted_at", null).order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter as any);
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
    if (visibilityFilter === "public") query = query.eq("is_public", true);
    if (visibilityFilter === "private") query = query.eq("is_public", false);
    const { data } = await query;
    setEditais((data || []) as Edital[]);
    setLoading(false);
  };

  useEffect(() => { fetchEditais(); }, [orgId, filter, search, visibilityFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newTitle.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o título da chamada.", variant: "destructive" });
      return;
    }
    if (!newDesc.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe a descrição da chamada.", variant: "destructive" });
      return;
    }
    if (!newStartDate) {
      toast({ title: "Campo obrigatório", description: "Informe a data de abertura.", variant: "destructive" });
      return;
    }
    if (!newEndDate) {
      toast({ title: "Campo obrigatório", description: "Informe a data de encerramento.", variant: "destructive" });
      return;
    }
    if (new Date(newEndDate) <= new Date(newStartDate)) {
      toast({ title: "Datas inválidas", description: "A data de encerramento deve ser posterior à de abertura.", variant: "destructive" });
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("editais").insert({
      title: newTitle.trim(),
      description: newDesc.trim(),
      start_date: new Date(newStartDate).toISOString(),
      end_date: new Date(newEndDate).toISOString(),
      organization_id: orgId,
      created_by: user.id,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Edital criado!" });
      setNewTitle("");
      setNewDesc("");
      setNewStartDate("");
      setNewEndDate("");
      setDialogOpen(false);
      fetchEditais();
    }
  };

  const handleOpenDuplicate = (sourceEdital: Edital) => {
    setDupSource(sourceEdital);
    setDupTitle(`${sourceEdital.title} (cópia)`);
    setDupCloneForm(true);
    setDupCloneAreas(true);
    setDupCloneCriteria(true);
    setDupCloneReviewers(false);
    setDupDialogOpen(true);
    // Close detail view so modal is visible
    setSelectedEdital(null);
  };

  const handleDuplicate = async () => {
    if (!user || !dupSource) return;
    if (!dupTitle.trim()) {
      toast({ title: "Título obrigatório", description: "Informe o título do novo edital.", variant: "destructive" });
      return;
    }

    setDuplicating(true);

    try {
      // 1. Create new edital as draft (no dates)
      const { data: newEdital, error: editalErr } = await supabase.from("editais").insert({
        title: dupTitle.trim(),
        description: dupSource.description,
        organization_id: orgId,
        created_by: user.id,
        status: "draft" as "draft" | "published" | "closed",
        blind_review_enabled: dupSource.blind_review_enabled,
        min_reviewers_per_proposal: dupSource.min_reviewers_per_proposal,
        review_deadline: null,
        start_date: null,
        end_date: null,
      }).select().single();

      if (editalErr || !newEdital) throw editalErr || new Error("Falha ao criar edital");

      const newEditalId = newEdital.id;

      // 2. Clone form structure
      if (dupCloneForm) {
        const { data: srcForm } = await supabase
          .from("edital_forms")
          .select("*")
          .eq("edital_id", dupSource.id)
          .maybeSingle();

        if (srcForm) {
          const { data: newForm, error: formErr } = await supabase.from("edital_forms").insert({
            edital_id: newEditalId,
            organization_id: orgId,
            status: "draft",
            knowledge_area_mode: (srcForm as any).knowledge_area_mode,
            knowledge_area_required: (srcForm as any).knowledge_area_required,
          }).select().single();

          if (!formErr && newForm) {
            const newFormId = newForm.id;

            // Clone sections
            const { data: srcSections } = await supabase
              .from("form_sections")
              .select("*")
              .eq("form_id", srcForm.id)
              .order("sort_order");

            if (srcSections && srcSections.length > 0) {
              const sectionIdMap = new Map<string, string>();

              for (const sec of srcSections) {
                const { data: newSec } = await supabase.from("form_sections").insert({
                  form_id: newFormId,
                  title: sec.title,
                  description: sec.description,
                  sort_order: sec.sort_order,
                }).select().single();
                if (newSec) sectionIdMap.set(sec.id, newSec.id);
              }

              // Clone questions
              const { data: srcQuestions } = await supabase
                .from("form_questions")
                .select("*")
                .eq("form_id", srcForm.id)
                .order("sort_order");

              if (srcQuestions && srcQuestions.length > 0) {
                for (const q of srcQuestions) {
                  const newSectionId = q.section_id ? sectionIdMap.get(q.section_id) : null;
                  const { data: newQ } = await supabase.from("form_questions").insert({
                    form_id: newFormId,
                    section_id: newSectionId || null,
                    section: q.section,
                    label: q.label,
                    type: q.type,
                    help_text: q.help_text,
                    is_required: q.is_required,
                    options: q.options,
                    options_source: q.options_source,
                    validation_rules: q.validation_rules,
                    sort_order: q.sort_order,
                  }).select().single();

                  // Clone question options
                  if (newQ) {
                    const { data: srcOpts } = await supabase
                      .from("form_question_options")
                      .select("*")
                      .eq("question_id", q.id)
                      .order("sort_order");
                    if (srcOpts && srcOpts.length > 0) {
                      await supabase.from("form_question_options").insert(
                        srcOpts.map(o => ({
                          question_id: newQ.id,
                          label: o.label,
                          value: o.value,
                          sort_order: o.sort_order,
                        }))
                      );
                    }
                  }
                }
              }
            }

            // Clone form knowledge areas
            if (dupCloneAreas) {
              const { data: srcKAs } = await supabase
                .from("form_knowledge_areas")
                .select("*")
                .eq("form_id", srcForm.id)
                .order("sort_order");
              if (srcKAs && srcKAs.length > 0) {
                await supabase.from("form_knowledge_areas").insert(
                  srcKAs.map(ka => ({
                    form_id: newFormId,
                    name: ka.name,
                    code: ka.code,
                    description: ka.description,
                    sort_order: ka.sort_order,
                    is_active: ka.is_active,
                  }))
                );
              }
            }
          }
        }
      }

      // 3. Clone scoring criteria
      if (dupCloneCriteria) {
        const { data: srcCriteria } = await supabase
          .from("scoring_criteria")
          .select("*")
          .eq("edital_id", dupSource.id)
          .order("sort_order");
        if (srcCriteria && srcCriteria.length > 0) {
          await supabase.from("scoring_criteria").insert(
            srcCriteria.map(c => ({
              edital_id: newEditalId,
              name: c.name,
              description: c.description,
              max_score: c.max_score,
              weight: c.weight,
              sort_order: c.sort_order,
            }))
          );
        }
      }

      // 4. Clone knowledge areas (edital_areas)
      if (dupCloneAreas) {
        const { data: srcAreas } = await supabase
          .from("edital_areas")
          .select("*")
          .eq("edital_id", dupSource.id);
        if (srcAreas && srcAreas.length > 0) {
          await supabase.from("edital_areas").insert(
            srcAreas.map(a => ({
              edital_id: newEditalId,
              knowledge_area_id: a.knowledge_area_id,
            }))
          );
        }
      }

      // 5. Audit log
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        organization_id: orgId,
        entity: "edital",
        entity_id: newEditalId,
        action: "edital.duplicate",
        metadata_json: {
          source_edital_id: dupSource.id,
          source_title: dupSource.title,
          cloned_form: dupCloneForm,
          cloned_areas: dupCloneAreas,
          cloned_criteria: dupCloneCriteria,
          cloned_reviewers: dupCloneReviewers,
        },
      });

      setDuplicating(false);
      setDupDialogOpen(false);
      toast({ title: "Edital duplicado com sucesso!", description: "O novo edital foi criado como rascunho." });

      // Refresh and navigate to new edital
      await fetchEditais();
      setSelectedEdital(newEdital as Edital);

    } catch (err: any) {
      setDuplicating(false);
      toast({ title: "Erro ao duplicar", description: err?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const statusBadge = (e: Edital) => {
    const computed = getComputedStatus(e.status, e.start_date, e.end_date);
    const variant = getStatusVariant(computed);
    return <Badge variant={variant}>{computed}</Badge>;
  };

  const formatDateTime = (dt: string) => {
    return new Date(dt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  if (selectedEdital) {
    return (
      <EditalDetail
        edital={selectedEdital}
        orgId={orgId}
        onBack={() => { setSelectedEdital(null); fetchEditais(); }}
        onDuplicate={handleOpenDuplicate}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-heading text-foreground">Editais</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Edital</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Criar Edital</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Título da Chamada <span className="text-destructive">*</span></Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título do edital" className="mt-1" />
              </div>
              <div>
                <Label>Descrição da Chamada <span className="text-destructive">*</span></Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descreva brevemente o edital..." className="mt-1" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Abertura <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Data de Encerramento <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="mt-1" />
                </div>
              </div>
              {newStartDate && newEndDate && new Date(newEndDate) <= new Date(newStartDate) && (
                <p className="text-sm text-destructive">A data de encerramento deve ser posterior à de abertura.</p>
              )}
              <Button type="submit" className="w-full" disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Duplicate dialog */}
      <Dialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" /> Duplicar Edital
            </DialogTitle>
            <DialogDescription>
              Crie uma nova chamada a partir de <strong>{dupSource?.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título do novo edital <span className="text-destructive">*</span></Label>
              <Input value={dupTitle} onChange={(e) => setDupTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">O que clonar:</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="dup-form" checked={dupCloneForm} onCheckedChange={(c) => setDupCloneForm(!!c)} />
                <label htmlFor="dup-form" className="text-sm">Clonar formulário de submissão</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="dup-areas" checked={dupCloneAreas} onCheckedChange={(c) => setDupCloneAreas(!!c)} />
                <label htmlFor="dup-areas" className="text-sm">Clonar áreas do conhecimento vinculadas</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="dup-criteria" checked={dupCloneCriteria} onCheckedChange={(c) => setDupCloneCriteria(!!c)} />
                <label htmlFor="dup-criteria" className="text-sm">Clonar critérios de avaliação e baremas</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="dup-reviewers" checked={dupCloneReviewers} onCheckedChange={(c) => setDupCloneReviewers(!!c)} />
                <label htmlFor="dup-reviewers" className="text-sm">Clonar avaliadores vinculados</label>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-md border border-border bg-muted/30">
              <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Submissões, avaliações, notas, pareceres e dados financeiros <strong>NÃO</strong> serão copiados.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDupDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleDuplicate} disabled={duplicating}>
              {duplicating && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Copy className="w-4 h-4 mr-1" /> Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar edital..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="closed">Encerrado</SelectItem>
            <SelectItem value="em_avaliacao">Em Avaliação</SelectItem>
            <SelectItem value="resultado_preliminar">Resultado Preliminar</SelectItem>
            <SelectItem value="resultado_final">Resultado Final</SelectItem>
            <SelectItem value="homologado">Homologado</SelectItem>
            <SelectItem value="outorgado">Outorgado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas visibilidades</SelectItem>
            <SelectItem value="public">Público</SelectItem>
            <SelectItem value="private">Privado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : editais.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum edital encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {editais.map((e) => (
            <Card key={e.id} className="cursor-pointer hover:shadow-card transition-shadow" onClick={() => setSelectedEdital(e)}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{e.title}</p>
                    {statusBadge(e)}
                    {(e as any).is_public && <Badge variant="outline" className="text-xs">Público</Badge>}
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground line-clamp-1">{e.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    Criado em {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    {e.start_date && ` · Abertura: ${formatDateTime(e.start_date)}`}
                    {e.end_date && ` · Encerramento: ${formatDateTime(e.end_date)}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditaisList;
