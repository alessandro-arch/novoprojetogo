import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, GripVertical, BarChart3 } from "lucide-react";

interface Criteria {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  max_score: number;
  sort_order: number;
}

const ScoringCriteriaManager = ({ editalId }: { editalId: string }) => {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New criteria form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newWeight, setNewWeight] = useState(1);
  const [newMax, setNewMax] = useState(10);

  const fetchCriteria = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("scoring_criteria")
      .select("*")
      .eq("edital_id", editalId)
      .order("sort_order");
    setCriteria((data || []) as Criteria[]);
    setLoading(false);
  };

  useEffect(() => { fetchCriteria(); }, [editalId]);

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("scoring_criteria").insert({
      edital_id: editalId,
      name: newName.trim(),
      description: newDesc.trim() || null,
      weight: newWeight,
      max_score: newMax,
      sort_order: criteria.length,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewName("");
      setNewDesc("");
      setNewWeight(1);
      setNewMax(10);
      fetchCriteria();
      toast({ title: "Critério adicionado!" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("scoring_criteria").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchCriteria();
    }
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    await supabase.from("scoring_criteria").update({ [field]: value }).eq("id", id);
    setCriteria(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Barema de Avaliação
        </CardTitle>
        <CardDescription>
          Configure os critérios de avaliação para este edital. Adicione quantos critérios desejar.
          <span className={`ml-1 font-semibold ${totalWeight === 100 ? "text-success" : totalWeight > 100 ? "text-destructive" : "text-warning-foreground"}`}>
            Peso total: {totalWeight.toFixed(1)} / 100
            {totalWeight === 100 && " ✓"}
            {totalWeight !== 100 && ` (${totalWeight < 100 ? "faltam " + (100 - totalWeight).toFixed(1) : "excede em " + (totalWeight - 100).toFixed(1)})`}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing criteria */}
        {criteria.map((c) => (
          <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <GripVertical className="w-4 h-4 text-muted-foreground mt-2 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Input
                value={c.name}
                onChange={e => handleUpdate(c.id, "name", e.target.value)}
                className="font-medium"
              />
              <Input
                value={c.description || ""}
                onChange={e => handleUpdate(c.id, "description", e.target.value || null)}
                placeholder="Descrição (opcional)"
                className="text-sm"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Peso</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={c.weight}
                    onChange={e => handleUpdate(c.id, "weight", parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Nota máxima</Label>
                  <Input
                    type="number"
                    min={1}
                    value={c.max_score}
                    onChange={e => handleUpdate(c.id, "max_score", parseFloat(e.target.value) || 10)}
                  />
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive mt-1">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {/* Add new */}
        <div className="p-4 rounded-lg border-2 border-dashed border-border space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Adicionar critério</p>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do critério (ex: Mérito científico)"
          />
          <Input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Descrição (opcional)"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Peso</Label>
              <Input type="number" min={0.1} step={0.1} value={newWeight} onChange={e => setNewWeight(parseFloat(e.target.value) || 1)} />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Nota máxima</Label>
              <Input type="number" min={1} value={newMax} onChange={e => setNewMax(parseFloat(e.target.value) || 10)} />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving || !newName.trim()} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoringCriteriaManager;
