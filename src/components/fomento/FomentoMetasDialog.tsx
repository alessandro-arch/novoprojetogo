import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Target } from "lucide-react";

interface Meta {
  id?: string;
  ano: number;
  meta_captacao: number;
  meta_projetos: number;
  meta_bolsas: number;
  meta_pesquisadores: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ano: number;
  current?: Meta | null;
}

const FomentoMetasDialog = ({ open, onOpenChange, ano, current }: Props) => {
  const { fomentoOrgId, user } = useFomentoAuth();
  const qc = useQueryClient();

  const [captacao, setCaptacao] = useState("");
  const [projetos, setProjetos] = useState("");
  const [bolsas, setBolsas] = useState("");
  const [pesquisadores, setPesquisadores] = useState("");

  useEffect(() => {
    if (!open) return;
    setCaptacao(current?.meta_captacao ? String(current.meta_captacao) : "");
    setProjetos(current?.meta_projetos ? String(current.meta_projetos) : "");
    setBolsas(current?.meta_bolsas ? String(current.meta_bolsas) : "");
    setPesquisadores(current?.meta_pesquisadores ? String(current.meta_pesquisadores) : "");
  }, [open, current]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: fomentoOrgId,
        ano,
        meta_captacao: Number(captacao) || 0,
        meta_projetos: Number(projetos) || 0,
        meta_bolsas: Number(bolsas) || 0,
        meta_pesquisadores: Number(pesquisadores) || 0,
        created_by: user?.id ?? null,
      };
      if (current?.id) {
        const { error } = await supabase.from("fomento_metas" as any).update(payload).eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fomento_metas" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Metas de ${ano} salvas com sucesso.`);
      qc.invalidateQueries({ queryKey: ["fomento-metas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível salvar as metas."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Metas de {ano}
          </DialogTitle>
          <DialogDescription>
            Defina os objetivos do ano. O dashboard passa a mostrar o percentual atingido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meta-captacao">Meta de captação (R$)</Label>
            <Input id="meta-captacao" type="number" min="0" step="1000" value={captacao} onChange={(e) => setCaptacao(e.target.value)} placeholder="Ex.: 10000000" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meta-projetos">Projetos</Label>
              <Input id="meta-projetos" type="number" min="0" value={projetos} onChange={(e) => setProjetos(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-bolsas">Bolsas</Label>
              <Input id="meta-bolsas" type="number" min="0" value={bolsas} onChange={(e) => setBolsas(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-pesq">Pesquisadores</Label>
              <Input id="meta-pesq" type="number" min="0" value={pesquisadores} onChange={(e) => setPesquisadores(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar metas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FomentoMetasDialog;
