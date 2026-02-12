import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  userId: string;
  orgId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const ProjectSelector = ({ userId, orgId, selectedId, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: executions, refetch } = useQuery({
    queryKey: ["project-executions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_executions" as any)
        .select("id, title, status, proposal_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: proposals } = useQuery({
    queryKey: ["user-proposals-accepted", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, edital_id, status, editais(title)")
        .eq("proponente_user_id", userId)
        .eq("status", "accepted");
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      // For now, create without linking to a specific proposal
      const { data, error } = await supabase
        .from("project_executions" as any)
        .insert({
          title,
          organization_id: orgId,
          edital_id: proposals?.[0]?.edital_id || "00000000-0000-0000-0000-000000000000",
          proposal_id: proposals?.[0]?.id || "00000000-0000-0000-0000-000000000000",
          created_by: userId,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Projeto criado!");
      setOpen(false);
      setTitle("");
      refetch();
      onSelect((data as any).id);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar projeto");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Projeto</Label>
      <Select value={selectedId || ""} onValueChange={(v) => onSelect(v || null)}>
        <SelectTrigger className="w-full text-sm">
          <SelectValue placeholder="Selecione um projeto" />
        </SelectTrigger>
        <SelectContent>
          {executions?.map((e: any) => (
            <SelectItem key={e.id} value={e.id}>
              {e.title || "Sem título"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Projeto
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto de Execução</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título do Projeto</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Execução Edital 2026" />
            </div>
            <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full">
              {creating ? "Criando..." : "Criar Projeto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectSelector;
