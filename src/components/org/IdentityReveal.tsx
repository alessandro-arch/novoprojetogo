import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, EyeOff, Eye, ShieldAlert, AlertTriangle } from "lucide-react";

interface IdentityRevealProps {
  editalId: string;
  editalTitle: string;
  editalStatus: string;
  proposals: { id: string; blind_code: string; status: string }[];
}

interface RevealedIdentity {
  proposal_id: string;
  blind_code: string;
  proponente_name: string | null;
  proponente_email: string | null;
  institution: string | null;
}

const IdentityReveal = ({ editalId, editalTitle, editalStatus, proposals }: IdentityRevealProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState<RevealedIdentity[]>([]);
  const [hasRevealed, setHasRevealed] = useState(false);

  const canReveal = editalStatus === "closed";

  const handleReveal = async () => {
    if (!user || !reason.trim()) return;
    setRevealing(true);

    try {
      // Record each reveal
      for (const p of proposals) {
        await supabase.from("identity_reveals").insert({
          proposal_id: p.id,
          edital_id: editalId,
          revealed_by: user.id,
          reason: reason.trim(),
        });
      }

      // Now fetch proponent identities via org staff access
      const proposalIds = proposals.map(p => p.id);
      const { data: proposalsData } = await supabase
        .from("proposals")
        .select("id, proponente_user_id, blind_code")
        .in("id", proposalIds);

      if (proposalsData) {
        const userIds = proposalsData.map((p: any) => p.proponente_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, institution_affiliation")
          .in("user_id", userIds);

        const revealedList: RevealedIdentity[] = proposalsData.map((p: any) => {
          const profile = (profiles || []).find((pr: any) => pr.user_id === p.proponente_user_id);
          return {
            proposal_id: p.id,
            blind_code: p.blind_code || p.id.slice(0, 8),
            proponente_name: profile?.full_name || "Não informado",
            proponente_email: profile?.email || null,
            institution: profile?.institution_affiliation || null,
          };
        });

        setRevealed(revealedList);
        setHasRevealed(true);
      }

      toast({ title: "Identidades reveladas e registradas na auditoria" });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setRevealing(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-accent/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-accent-foreground" />
            Controle de Identidade — Blind Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            As identidades dos proponentes estão protegidas pelo sistema de avaliação cega.
            A revelação só é permitida após o <strong>encerramento do edital</strong>.
          </p>

          {!canReveal ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/20 border border-accent/30">
              <ShieldAlert className="w-4 h-4 text-accent-foreground flex-shrink-0" />
              <p className="text-xs text-accent-foreground">
                O edital precisa estar <strong>encerrado</strong> para revelar identidades.
                Status atual: <Badge variant="outline" className="ml-1">{editalStatus}</Badge>
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              disabled={hasRevealed}
            >
              <Eye className="w-4 h-4 mr-1" />
              {hasRevealed ? "Identidades já reveladas" : "Revelar Identidades"}
            </Button>
          )}

          {/* Revealed identities */}
          {hasRevealed && revealed.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Identidades reveladas:</p>
              {revealed.map((r) => (
                <div key={r.proposal_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card text-sm">
                  <div>
                    <span className="font-mono font-bold text-primary">{r.blind_code}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="font-medium">{r.proponente_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-x-3">
                    {r.proponente_email && <span>{r.proponente_email}</span>}
                    {r.institution && <span>· {r.institution}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm reveal dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Revelar Identidades — {editalTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                <strong>Atenção:</strong> Esta ação é irreversível e será registrada na trilha de auditoria.
                As identidades de {proposals.length} proponente(s) serão reveladas.
              </p>
            </div>
            <div>
              <Label>Motivo da revelação *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Encerramento formal do edital para publicação dos resultados..."
                rows={3}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleReveal}
              className="w-full"
              variant="destructive"
              disabled={revealing || !reason.trim()}
            >
              {revealing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              Confirmar Revelação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IdentityReveal;
