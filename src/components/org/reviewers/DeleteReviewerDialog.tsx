import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Ban } from "lucide-react";
import { toast } from "sonner";
import type { ReviewerListItem } from "./ReviewersList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  reviewer: ReviewerListItem;
}

const DeleteReviewerDialog = ({ open, onOpenChange, orgId, reviewer }: Props) => {
  const queryClient = useQueryClient();

  const { data: assignmentCount, isLoading: checkingAssignments } = useQuery({
    queryKey: ["reviewer-assignments-count", reviewer._id],
    queryFn: async () => {
      if (reviewer._type !== "active" || !reviewer.user_id) return 0;
      const { count, error } = await supabase
        .from("review_assignments")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_user_id", reviewer.user_id);
      if (error) return 0;
      return count || 0;
    },
    enabled: open,
  });

  const hasAssignments = (assignmentCount ?? 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (reviewer._type === "invite") {
        const inviteId = reviewer._id.replace("invite:", "");
        const { error } = await supabase.from("reviewer_invites").delete().eq("id", inviteId);
        if (error) throw error;
      } else if (reviewer.user_id) {
        // Delete reviewer_profiles and remove org membership
        await supabase.from("reviewer_profiles" as any).delete().eq("user_id", reviewer.user_id).eq("org_id", orgId);
        await supabase.from("organization_members").delete().eq("user_id", reviewer.user_id).eq("organization_id", orgId).eq("role", "reviewer" as any);
      }
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id, organization_id: orgId, entity: "reviewer",
        entity_id: reviewer.user_id || reviewer._id, action: "REVIEWER_DELETED",
        metadata_json: { full_name: reviewer.full_name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Avaliador excluído com sucesso.");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao excluir avaliador."),
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!reviewer.user_id) throw new Error("Sem user_id");
      const { error } = await supabase
        .from("organization_members")
        .update({ status: "suspenso" } as any)
        .eq("user_id", reviewer.user_id)
        .eq("organization_id", orgId)
        .eq("role", "reviewer" as any);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id, organization_id: orgId, entity: "reviewer",
        entity_id: reviewer.user_id, action: "REVIEWER_STATUS_CHANGED",
        metadata_json: { new_status: "suspenso", reason: "deactivated_instead_of_delete" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Avaliador desativado com sucesso.");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao desativar avaliador."),
  });

  const isPending = deleteMutation.isPending || deactivateMutation.isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            {hasAssignments ? "Não é possível excluir" : "Excluir avaliador"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {checkingAssignments ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Verificando dependências...</span>
            ) : hasAssignments ? (
              <>O avaliador <strong>{reviewer.full_name}</strong> possui <strong>{assignmentCount}</strong> avaliação(ões) e não pode ser excluído. Você pode <strong>desativá-lo</strong>.</>
            ) : (
              <>Tem certeza que deseja excluir o avaliador <strong>{reviewer.full_name}</strong>? Esta ação não pode ser desfeita.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          {hasAssignments ? (
            <Button variant="outline" onClick={() => deactivateMutation.mutate()} disabled={isPending || checkingAssignments}>
              {deactivateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Ban className="w-4 h-4 mr-2" /> Desativar avaliador
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isPending || checkingAssignments}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir definitivamente
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteReviewerDialog;
