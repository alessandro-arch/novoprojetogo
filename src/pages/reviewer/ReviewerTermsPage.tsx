import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const TERMS_VERSION = "v1";
const TERMS_TEXT = `Declaro que tratarei como confidenciais todas as informações e documentos acessados nesta plataforma. Comprometo-me a não copiar, compartilhar, divulgar ou utilizar os conteúdos para qualquer finalidade externa à avaliação. Declaro, ainda, que não possuo conflito de interesses com a proposta e seus participantes. Caso identifique conflito, informarei imediatamente e solicitarei meu impedimento.`;

const ReviewerTermsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [acceptConfidentiality, setAcceptConfidentiality] = useState(false);
  const [acceptNoConflict, setAcceptNoConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const [conflictSubmitting, setConflictSubmitting] = useState(false);

  const canAccept = acceptConfidentiality && acceptNoConflict;

  const handleAccept = async () => {
    if (!user || !canAccept) return;
    setSubmitting(true);
    try {
      // Update reviewer_profiles
      const { error: updateError } = await supabase
        .from("reviewer_profiles" as any)
        .update({
          first_terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
        } as any)
        .eq("user_id", user.id);

      if (updateError) {
        toast.error("Erro ao salvar aceite dos termos.");
        console.error(updateError);
        setSubmitting(false);
        return;
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id, action: "TERMS_ACCEPTED", entity: "reviewer",
        metadata_json: { terms_version: TERMS_VERSION, timestamp: new Date().toISOString() },
      });

      toast.success("Termos aceitos com sucesso!");
      navigate("/reviewer", { replace: true });
    } catch { toast.error("Erro inesperado."); }
    setSubmitting(false);
  };

  const handleConflictSubmit = async () => {
    if (!user || !conflictReason.trim()) return;
    setConflictSubmitting(true);
    try {
      // Get user's org from organization_members
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "reviewer" as any)
        .maybeSingle();

      if (!membership) {
        toast.error("Vínculo de avaliador não encontrado.");
        setConflictSubmitting(false);
        return;
      }

      const { error: conflictError } = await supabase
        .from("reviewer_conflicts")
        .insert({
          reviewer_id: user.id, // legacy field
          user_id: user.id,
          org_id: membership.organization_id,
          conflict_type: "general",
          description: conflictReason.trim(),
          declared_by: user.id,
        } as any);

      if (conflictError) { toast.error("Erro ao registrar conflito."); setConflictSubmitting(false); return; }

      await supabase.from("audit_logs").insert({
        user_id: user.id, action: "CONFLICT_DECLARED", entity: "reviewer_conflict",
        metadata_json: { reason: conflictReason.trim(), timestamp: new Date().toISOString() },
      });

      toast.success("Conflito registrado.");
      setConflictOpen(false);
    } catch { toast.error("Erro inesperado."); }
    setConflictSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-2"><ShieldCheck className="w-6 h-6 text-primary-foreground" /></div>
          <CardTitle className="text-xl">Declaração de Confidencialidade e Conflito de Interesses</CardTitle>
          <CardDescription>Antes de acessar o painel de avaliação, é necessário aceitar os termos abaixo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 border border-border"><p className="text-sm text-foreground leading-relaxed">{TERMS_TEXT}</p></div>
          <div className="space-y-4">
            <div className="flex items-start gap-3"><Checkbox id="confidentiality" checked={acceptConfidentiality} onCheckedChange={(v) => setAcceptConfidentiality(!!v)} className="mt-0.5" /><Label htmlFor="confidentiality" className="text-sm leading-relaxed cursor-pointer">Li e aceito a confidencialidade.</Label></div>
            <div className="flex items-start gap-3"><Checkbox id="no-conflict" checked={acceptNoConflict} onCheckedChange={(v) => setAcceptNoConflict(!!v)} className="mt-0.5" /><Label htmlFor="no-conflict" className="text-sm leading-relaxed cursor-pointer">Declaro ausência de conflito de interesses.</Label></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex-1" onClick={handleAccept} disabled={!canAccept || submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Aceitar e continuar</Button>
            <Button variant="outline" className="flex-1" onClick={() => setConflictOpen(true)}><AlertTriangle className="w-4 h-4 mr-2" />Sinalizar conflito</Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sinalizar Conflito de Interesses</DialogTitle><DialogDescription>Descreva o motivo do conflito.</DialogDescription></DialogHeader>
          <div className="space-y-3"><Label>Motivo do conflito <span className="text-destructive">*</span></Label><Textarea value={conflictReason} onChange={(e) => setConflictReason(e.target.value)} rows={4} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConflictSubmit} disabled={!conflictReason.trim() || conflictSubmitting}>{conflictSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enviar e bloquear acesso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewerTermsPage;
