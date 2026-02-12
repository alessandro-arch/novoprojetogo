import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Search, AlertCircle } from "lucide-react";

interface KnowledgeArea {
  id: string;
  form_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface FormKnowledgeAreasProps {
  formId: string | null;
}

const FormKnowledgeAreas = ({ formId }: FormKnowledgeAreasProps) => {
  const { toast } = useToast();
  const [areas, setAreas] = useState<KnowledgeArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<KnowledgeArea | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (formId) loadAreas();
  }, [formId]);

  const loadAreas = async () => {
    if (!formId) return;
    setLoading(true);
    const { data } = await supabase
      .from("form_knowledge_areas")
      .select("*")
      .eq("form_id", formId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setAreas((data as KnowledgeArea[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingArea(null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (area: KnowledgeArea) => {
    setEditingArea(area);
    setFormName(area.name);
    setFormCode(area.code || "");
    setFormDescription(area.description || "");
    setFormIsActive(area.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formId || !formName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    // Check duplicate name (case-insensitive, client-side)
    const duplicate = areas.find(
      (a) =>
        a.name.toLowerCase() === formName.trim().toLowerCase() &&
        a.id !== editingArea?.id
    );
    if (duplicate) {
      toast({ title: "Área duplicada", description: `Já existe uma área com o nome "${duplicate.name}".`, variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editingArea) {
      // Update
      const { error } = await supabase
        .from("form_knowledge_areas")
        .update({
          name: formName.trim(),
          code: formCode.trim() || null,
          description: formDescription.trim() || null,
          is_active: formIsActive,
        })
        .eq("id", editingArea.id);

      if (error) {
        if (error.message.includes("form_knowledge_areas_form_name_unique")) {
          toast({ title: "Área duplicada", description: "Já existe uma área com este nome neste formulário.", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Área atualizada!" });
        setDialogOpen(false);
        loadAreas();
      }
    } else {
      // Create with next sort_order
      const maxOrder = areas.length > 0 ? Math.max(...areas.map((a) => a.sort_order)) : -1;
      const { error } = await supabase.from("form_knowledge_areas").insert({
        form_id: formId,
        name: formName.trim(),
        code: formCode.trim() || null,
        description: formDescription.trim() || null,
        is_active: formIsActive,
        sort_order: maxOrder + 1,
      });

      if (error) {
        if (error.message.includes("form_knowledge_areas_form_name_unique")) {
          toast({ title: "Área duplicada", description: "Já existe uma área com este nome neste formulário.", variant: "destructive" });
        } else {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Área criada!" });
        setDialogOpen(false);
        loadAreas();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (area: KnowledgeArea) => {
    if (!confirm(`Excluir a área "${area.name}"?`)) return;
    const { error } = await supabase.from("form_knowledge_areas").delete().eq("id", area.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Área excluída!" });
      loadAreas();
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newAreas = [...areas];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newAreas.length) return;

    // Swap sort_order values
    const tempOrder = newAreas[index].sort_order;
    newAreas[index].sort_order = newAreas[swapIndex].sort_order;
    newAreas[swapIndex].sort_order = tempOrder;

    // Swap in array
    [newAreas[index], newAreas[swapIndex]] = [newAreas[swapIndex], newAreas[index]];
    setAreas(newAreas);

    // Persist both
    await Promise.all([
      supabase.from("form_knowledge_areas").update({ sort_order: newAreas[index].sort_order }).eq("id", newAreas[index].id),
      supabase.from("form_knowledge_areas").update({ sort_order: newAreas[swapIndex].sort_order }).eq("id", newAreas[swapIndex].id),
    ]);
  };

  const filteredAreas = search.trim()
    ? areas.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : areas;

  // Disabled state - no form yet
  if (!formId) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Áreas do Conhecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">Crie o formulário para habilitar as áreas.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Áreas do Conhecimento</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre e organize as áreas disponíveis para seleção no formulário deste edital.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nova Área
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        {areas.length > 0 && (
          <div className="relative mb-4 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar área..."
              className="pl-9"
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredAreas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {areas.length === 0 ? "Nenhuma área cadastrada." : "Nenhuma área encontrada."}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredAreas.map((area, idx) => (
              <div
                key={area.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(idx, "up")}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleMove(idx, "down")}
                    disabled={idx === filteredAreas.length - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{area.name}</span>
                    {area.code && (
                      <span className="text-xs text-muted-foreground font-mono">{area.code}</span>
                    )}
                    <Badge variant={area.is_active ? "default" : "outline"} className="text-xs">
                      {area.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(area)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(area)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? "Editar Área" : "Nova Área"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Engenharia de Software"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Código (opcional)</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Ex: ENG-01"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descrição da área..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FormKnowledgeAreas;
