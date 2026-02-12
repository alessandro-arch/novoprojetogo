import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, FileText, Plus, Link2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  editalId: string;
  orgId: string;
  currentFormId: string | null;
  onFormLinked: (formId: string) => void;
}

const FormSelector = ({ editalId, orgId, currentFormId, onFormLinked }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState(false);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["published-forms", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, code, name, version, status, updated_at")
        .eq("organization_id", orgId)
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  const { data: currentForm } = useQuery({
    queryKey: ["form-detail-mini", currentFormId],
    queryFn: async () => {
      if (!currentFormId) return null;
      const { data } = await supabase
        .from("forms")
        .select("id, code, name, version")
        .eq("id", currentFormId)
        .single();
      return data;
    },
    enabled: !!currentFormId,
  });

  const filtered = forms?.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q);
  });

  const handleLink = async (fId: string) => {
    setLinking(true);
    const { error } = await supabase
      .from("editais")
      .update({ form_id: fId } as any)
      .eq("id", editalId);
    setLinking(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Formulário vinculado ao edital!");
      setDialogOpen(false);
      onFormLinked(fId);
    }
  };

  return (
    <div>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs text-muted-foreground">Formulário da Biblioteca</Label>
              {currentForm ? (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono text-xs">{currentForm.code}</Badge>
                  <span className="text-sm font-medium">{currentForm.name}</span>
                  <span className="text-xs text-muted-foreground">v{currentForm.version}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Nenhum formulário vinculado.</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Link2 className="w-4 h-4 mr-1" />
              {currentFormId ? "Trocar" : "Vincular"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Formulário da Biblioteca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-auto space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : filtered && filtered.length > 0 ? (
                filtered.map(f => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      f.id === currentFormId ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => handleLink(f.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                        <span className="text-xs text-muted-foreground">v{f.version}</span>
                      </div>
                    </div>
                    {f.id === currentFormId && (
                      <Badge variant="default" className="text-xs">Atual</Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {forms?.length === 0
                      ? "Nenhum formulário publicado na biblioteca."
                      : "Nenhum resultado para a busca."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormSelector;
