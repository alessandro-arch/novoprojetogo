import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Ban, UserCheck, RefreshCw, ExternalLink, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EditReviewerModal from "./EditReviewerModal";
import DeleteReviewerDialog from "./DeleteReviewerDialog";
import { formatInstitutionDisplay } from "@/components/InstitutionSelector";
import type { ReviewerListItem } from "./ReviewersList";

interface Props {
  reviewerId: string; // "active:uuid" or "invite:uuid"
  orgId: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = { convidado: "Convidado", ativo: "Ativo", suspenso: "Suspenso" };

const AUDIT_LABELS: Record<string, string> = {
  REVIEWER_CREATED: "Avaliador cadastrado", REVIEWER_UPDATED: "Dados atualizados",
  REVIEWER_INVITE_SENT: "Convite enviado", REVIEWER_TERMS_ACCEPTED: "Termos aceitos",
  REVIEWER_STATUS_CHANGED: "Status alterado", REVIEWER_DELETED: "Avaliador excluído",
};

function getAreaLabel(a: any): string { return typeof a === "string" ? a : a?.name || a?.code || ""; }
function getPrimaryArea(areas: any[]): string | null { const p = areas.find((a: any) => a?.role === "primary"); return p ? getAreaLabel(p) : areas.length > 0 ? getAreaLabel(areas[0]) : null; }
function getSecondaryArea(areas: any[]): string | null { const s = areas.find((a: any) => a?.role === "secondary"); return s ? getAreaLabel(s) : areas.length > 1 ? getAreaLabel(areas[1]) : null; }

const ReviewerDetail = ({ reviewerId, orgId, onBack }: Props) => {
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [type, id] = reviewerId.includes(":") ? reviewerId.split(":") as ["active" | "invite", string] : ["active", reviewerId];

  const { data: reviewer, isLoading } = useQuery({
    queryKey: ["reviewer-detail", reviewerId],
    queryFn: async (): Promise<ReviewerListItem | null> => {
      if (type === "active") {
        const [profileRes, rpRes, omRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", id).single(),
          (supabase.from("reviewer_profiles" as any).select("*").eq("user_id", id).eq("org_id", orgId).maybeSingle() as any),
          supabase.from("organization_members").select("status").eq("user_id", id).eq("organization_id", orgId).eq("role", "reviewer" as any).maybeSingle(),
        ]);
        const profile = profileRes.data;
        const rp = rpRes.data as any;
        const om = omRes.data as any;
        if (!profile) return null;

        let instName = "";
        if (profile.institution_id) {
          const { data: inst } = await supabase.from("institutions").select("name").eq("id", profile.institution_id).single();
          instName = inst?.name || "";
        }

        return {
          _type: "active", _id: reviewerId, user_id: id,
          full_name: profile.full_name || "", email: profile.email || "",
          institution: profile.institution_custom_name || instName,
          institution_custom_name: profile.institution_custom_name, institution_type: profile.institution_type,
          areas: Array.isArray(rp?.areas) ? rp.areas : [], keywords: rp?.keywords || null,
          lattes_url: profile.lattes_url, orcid: rp?.orcid || null, bio: rp?.bio || null,
          status: (om as any)?.status || "ativo", created_at: rp?.created_at || profile.created_at,
          cpf_last4: profile.cpf?.slice(-4) || null,
        };
      } else {
        const { data: inv } = await supabase.from("reviewer_invites").select("*").eq("id", id).single();
        if (!inv) return null;
        return {
          _type: "invite", _id: reviewerId,
          full_name: (inv as any).full_name || inv.email, email: inv.email,
          institution: (inv as any).institution || "",
          institution_custom_name: (inv as any).institution_custom_name, institution_type: (inv as any).institution_type,
          areas: Array.isArray((inv as any).areas) ? (inv as any).areas : [],
          keywords: (inv as any).keywords || null, lattes_url: (inv as any).lattes_url || null,
          orcid: (inv as any).orcid || null, bio: null,
          status: "convidado", created_at: inv.created_at,
        };
      }
    },
  });

  const entityId = type === "active" ? id : reviewer?._id;

  const { data: auditLogs } = useQuery({
    queryKey: ["reviewer-audit", entityId],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").eq("entity", "reviewer").eq("entity_id", entityId!).order("created_at", { ascending: false }).limit(20);
      return data;
    },
    enabled: !!entityId,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!reviewer?.user_id) throw new Error("No user_id");
      await supabase.from("organization_members").update({ status: newStatus } as any).eq("user_id", reviewer.user_id).eq("organization_id", orgId).eq("role", "reviewer" as any);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({ user_id: user?.id, organization_id: orgId, entity: "reviewer", entity_id: reviewer.user_id, action: "REVIEWER_STATUS_CHANGED", metadata_json: { new_status: newStatus } });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reviewer-detail", reviewerId] }); queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] }); toast.success("Status atualizado."); },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!reviewer) return <p className="text-muted-foreground text-center py-12">Avaliador não encontrado.</p>;

  const primaryArea = getPrimaryArea(reviewer.areas);
  const secondaryArea = getSecondaryArea(reviewer.areas);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-heading text-foreground">{reviewer.full_name}</h1>
          <p className="text-sm text-muted-foreground">{reviewer.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {reviewer._type === "active" && <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar</Button>}
          <Badge variant={reviewer.status === "ativo" ? "default" : reviewer.status === "suspenso" ? "destructive" : "outline"}>
            {STATUS_LABELS[reviewer.status] || reviewer.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Dados Cadastrais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Instituição</p><p className="text-sm font-medium">{formatInstitutionDisplay(reviewer.institution, null)}</p></div>
              <div><p className="text-xs text-muted-foreground">CPF</p><p className="text-sm font-medium">{reviewer.cpf_last4 ? `***.***.***${reviewer.cpf_last4.slice(0, 2)}-${reviewer.cpf_last4.slice(2)}` : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">ORCID</p><p className="text-sm font-medium">{reviewer.orcid || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Lattes</p>{reviewer.lattes_url ? <a href={reviewer.lattes_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">Ver Lattes <ExternalLink className="w-3 h-3" /></a> : <p className="text-sm text-muted-foreground">—</p>}</div>
              <div><p className="text-xs text-muted-foreground">Cadastrado em</p><p className="text-sm font-medium">{format(new Date(reviewer.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div>
            </div>
            {reviewer.bio && (<><Separator /><div><p className="text-xs text-muted-foreground mb-1">Mini bio</p><p className="text-sm">{reviewer.bio}</p></div></>)}
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Áreas do Conhecimento (CNPq)</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2"><Badge variant="default" className="text-[10px] shrink-0 mt-0.5">Principal</Badge><span className="text-sm">{primaryArea || "Nenhuma área cadastrada."}</span></div>
                {secondaryArea && <div className="flex items-start gap-2"><Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">Secundária</Badge><span className="text-sm">{secondaryArea}</span></div>}
              </div>
            </div>
            {reviewer.keywords && reviewer.keywords.length > 0 && (<><Separator /><div><p className="text-xs text-muted-foreground mb-2">Palavras-chave</p><div className="flex flex-wrap gap-1.5">{reviewer.keywords.map((kw: string) => <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>)}</div></div></>)}
            <Separator />
            <div className="flex items-center gap-2">
              {reviewer.status === "ativo" && <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate("suspenso")}><Ban className="w-4 h-4 mr-1" /> Suspender</Button>}
              {reviewer.status === "suspenso" && <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate("ativo")}><UserCheck className="w-4 h-4 mr-1" /> Reativar</Button>}
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowDelete(true)}><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Conflitos de Interesse</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground mb-3">Funcionalidade em desenvolvimento.</p><Button variant="outline" size="sm" disabled>Registrar Conflito</Button></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Auditoria</CardTitle></CardHeader>
            <CardContent>
              {!auditLogs || auditLogs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p> : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{AUDIT_LABELS[log.action] || log.action}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        {log.metadata_json && typeof log.metadata_json === "object" && (log.metadata_json as any).new_status && <p className="text-xs text-muted-foreground">Novo status: {STATUS_LABELS[(log.metadata_json as any).new_status] || (log.metadata_json as any).new_status}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showEdit && <EditReviewerModal open={showEdit} onOpenChange={setShowEdit} orgId={orgId} reviewer={reviewer} />}
      {showDelete && <DeleteReviewerDialog open={showDelete} onOpenChange={(v) => { setShowDelete(v); if (!v && !reviewer) onBack(); }} orgId={orgId} reviewer={reviewer} />}
    </div>
  );
};

export default ReviewerDetail;
