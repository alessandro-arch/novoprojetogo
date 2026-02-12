import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, FolderTree, Trash2, ChevronRight } from "lucide-react";

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

const KnowledgeAreas = ({ orgId }: { orgId: string }) => {
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");

  const fetchAreas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("knowledge_areas")
      .select("*")
      .eq("organization_id", orgId)
      .order("name");
    setAreas((data || []) as Area[]);
    setLoading(false);
  };

  useEffect(() => { fetchAreas(); }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("knowledge_areas").insert({
      name: newName.trim(),
      organization_id: orgId,
      parent_id: newParent || null,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Área criada!" });
      setNewName("");
      setNewParent("");
      setDialogOpen(false);
      fetchAreas();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("knowledge_areas").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Área removida" }); fetchAreas(); }
  };

  // Build tree structure
  const rootAreas = areas.filter((a) => !a.parent_id);
  const childrenOf = (parentId: string) => areas.filter((a) => a.parent_id === parentId);

  const renderArea = (area: Area, depth: number = 0) => (
    <div key={area.id}>
      <div className={`flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors ${depth > 0 ? "ml-6" : ""}`}>
        <div className="flex items-center gap-2">
          {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <FolderTree className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{area.name}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => handleDelete(area.id)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
      {childrenOf(area.id).map((child) => renderArea(child, depth + 1))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-heading text-foreground">Áreas do Conhecimento</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nova Área</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Área</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da área" className="mt-1" required />
              </div>
              <div>
                <Label>Área pai (opcional)</Label>
                <Select value={newParent} onValueChange={setNewParent}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : areas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma área cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rootAreas.map((area) => renderArea(area))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeAreas;
