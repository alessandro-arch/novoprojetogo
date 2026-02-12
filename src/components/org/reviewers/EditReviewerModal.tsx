import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import CnpqAreaSelector from "@/components/CnpqAreaSelector";
import InstitutionSelector from "@/components/InstitutionSelector";
import type { ReviewerListItem } from "./ReviewersList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  reviewer: ReviewerListItem;
}

function areaToValue(a: any): string | null {
  if (!a) return null;
  if (typeof a === "string") return a;
  const code = a.code || "";
  const name = a.name || a.full_path || "";
  return code ? `${code} - ${name}` : null;
}

function parseAreaValue(value: string): { code: string; name: string } | null {
  if (!value) return null;
  const parts = value.split(" - ");
  const code = parts[0]?.trim();
  const name = parts.slice(1).join(" - ").trim();
  if (!code) return null;
  return { code, name: name || code };
}

function getPrimaryAreaValue(areas: any[]): string | null {
  const primary = areas.find((a: any) => a?.role === "primary");
  if (primary) return areaToValue(primary);
  return areas.length > 0 ? areaToValue(areas[0]) : null;
}

function getSecondaryAreaValue(areas: any[]): string | null {
  const secondary = areas.find((a: any) => a?.role === "secondary");
  if (secondary) return areaToValue(secondary);
  return areas.length > 1 ? areaToValue(areas[1]) : null;
}

const EditReviewerModal = ({ open, onOpenChange, orgId, reviewer }: Props) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", lattes_url: "", orcid: "", bio: "" });
  const [institution, setInstitution] = useState({
    institution_id: null as string | null, institution_name: "", institution_custom_name: null as string | null, institution_type: null as string | null, institution_sigla: null as string | null,
  });
  const [primaryArea, setPrimaryArea] = useState<string | null>(null);
  const [secondaryArea, setSecondaryArea] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (open && reviewer) {
      const areas: any[] = Array.isArray(reviewer.areas) ? reviewer.areas : [];
      setForm({
        full_name: reviewer.full_name || "", email: reviewer.email || "",
        lattes_url: reviewer.lattes_url || "", orcid: reviewer.orcid || "", bio: reviewer.bio || "",
      });
      setInstitution({
        institution_id: null, institution_name: reviewer.institution || "",
        institution_custom_name: reviewer.institution_custom_name || null,
        institution_type: reviewer.institution_type || null, institution_sigla: null,
      });
      setPrimaryArea(getPrimaryAreaValue(areas));
      setSecondaryArea(getSecondaryAreaValue(areas));
      setKeywords(reviewer.keywords || []);
      setKeywordInput("");
    }
  }, [open, reviewer]);

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) setKeywords([...keywords, kw]);
    setKeywordInput("");
  };

  const buildAreasArray = () => {
    const result: { code: string; name: string; role: string }[] = [];
    const p = parseAreaValue(primaryArea || "");
    if (p) result.push({ ...p, role: "primary" });
    const s = parseAreaValue(secondaryArea || "");
    if (s) result.push({ ...s, role: "secondary" });
    return result;
  };

  const primaryParsed = parseAreaValue(primaryArea || "");
  const secondaryParsed = parseAreaValue(secondaryArea || "");
  const isDuplicate = primaryParsed && secondaryParsed && primaryParsed.code === secondaryParsed.code;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (isDuplicate) throw new Error("Área principal e secundária não podem ser iguais.");
      if (reviewer._type !== "active" || !reviewer.user_id) throw new Error("Só é possível editar avaliadores ativos.");

      const areas = buildAreasArray();

      // Update personal data in profiles
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          email: form.email.toLowerCase().trim(),
          institution_custom_name: institution.institution_custom_name || null,
          institution_type: institution.institution_type || null,
          institution_id: institution.institution_id || null,
          lattes_url: form.lattes_url || null,
        })
        .eq("user_id", reviewer.user_id);
      if (profileErr) throw profileErr;

      // Update reviewer-specific data in reviewer_profiles
      const { error: rpErr } = await supabase
        .from("reviewer_profiles" as any)
        .update({
          areas: areas as any,
          keywords: keywords.length > 0 ? keywords : null,
          orcid: form.orcid || null,
          bio: form.bio || null,
        } as any)
        .eq("user_id", reviewer.user_id)
        .eq("org_id", orgId);
      if (rpErr) throw rpErr;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id, organization_id: orgId, entity: "reviewer",
        entity_id: reviewer.user_id, action: "REVIEWER_UPDATED",
        metadata_json: { full_name: form.full_name.trim(), email: form.email.trim() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Avaliador atualizado com sucesso.");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar avaliador."),
  });

  const customSiglaValid = institution.institution_sigla ? institution.institution_sigla.trim().length >= 2 && institution.institution_sigla.trim().length <= 10 : false;
  const institutionValid = !!institution.institution_id || (!!institution.institution_custom_name?.trim() && !!institution.institution_type && customSiglaValid);
  const isValid = form.full_name.trim() && form.email.trim() && !!primaryArea && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Avaliador</DialogTitle>
          <DialogDescription>Atualize os dados cadastrais do avaliador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Nome completo <span className="text-destructive">*</span></Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>E-mail <span className="text-destructive">*</span></Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <InstitutionSelector label="Instituição de vínculo" required value={institution} onChange={(val) => setInstitution({ ...val, institution_sigla: val.institution_sigla ?? null })} />
          <div className="space-y-1.5"><Label>Área do Conhecimento Principal (CNPq) <span className="text-destructive">*</span></Label><CnpqAreaSelector value={primaryArea} onChange={(v) => setPrimaryArea(v)} /></div>
          <div className="space-y-1.5">
            <Label>Área do Conhecimento Secundária (CNPq)</Label>
            <CnpqAreaSelector value={secondaryArea} onChange={(v) => setSecondaryArea(v)} />
            {isDuplicate && <p className="text-xs text-destructive">A área secundária não pode ser igual à principal.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Palavras-chave</Label>
            <div className="flex gap-2">
              <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} placeholder="Digite e pressione Enter" />
              <Button type="button" variant="outline" onClick={addKeyword}>Adicionar</Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((kw) => (<Badge key={kw} variant="outline" className="gap-1">{kw}<button type="button" onClick={() => setKeywords(keywords.filter((k) => k !== kw))}><X className="w-3 h-3" /></button></Badge>))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Lattes URL</Label><Input value={form.lattes_url} onChange={(e) => setForm({ ...form, lattes_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>ORCID</Label><Input value={form.orcid} onChange={(e) => setForm({ ...form, orcid: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Mini bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={!isValid || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditReviewerModal;
