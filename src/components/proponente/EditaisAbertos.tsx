import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Calendar, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import SubmissionForm from "@/components/proponente/SubmissionForm";
import { getComputedStatus, isSubmissionOpen, getStatusVariant } from "@/lib/edital-status";

interface Props {
  orgId: string;
  userId: string;
  onStartProposal: () => void;
}

const EditaisAbertos = ({ orgId, userId, onStartProposal }: Props) => {
  const [search, setSearch] = useState("");
  const [selectedEdital, setSelectedEdital] = useState<any>(null);

  const { data: editais, isLoading } = useQuery({
    queryKey: ["proponente-editais", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editais")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Check existing submissions
  const { data: mySubmissions } = useQuery({
    queryKey: ["my-submissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edital_submissions")
        .select("edital_id, status, protocol")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
  });

  // Check existing drafts
  const { data: myDrafts } = useQuery({
    queryKey: ["my-submission-drafts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edital_submission_drafts")
        .select("edital_id")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
  });

  const submissionsByEdital = new Map((mySubmissions || []).map((s: any) => [s.edital_id, s]));
  const draftEditalIds = new Set((myDrafts || []).map((d: any) => d.edital_id));

  const filtered = editais?.filter((e) => e.title.toLowerCase().includes(search.toLowerCase())) ?? [];

  if (selectedEdital) {
    return (
      <SubmissionForm
        editalId={selectedEdital.id}
        editalTitle={selectedEdital.title}
        editalStartDate={selectedEdital.start_date}
        editalEndDate={selectedEdital.end_date}
        onBack={() => setSelectedEdital(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Editais Abertos</h1>
        <p className="text-muted-foreground mt-1">Veja os editais publicados e inicie sua submissão.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar edital..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum edital publicado encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((edital) => {
            const existingSub = submissionsByEdital.get(edital.id);
            const hasDraft = draftEditalIds.has(edital.id);
            const computed = getComputedStatus(edital.status, edital.start_date, edital.end_date);
            const open = isSubmissionOpen(edital.status, edital.start_date, edital.end_date);
            const isSubmitted = existingSub && existingSub.status === "submitted";

            return (
              <Card key={edital.id} className="hover:shadow-card-hover transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{edital.title}</CardTitle>
                      {edital.description && (
                        <CardDescription className="mt-1 line-clamp-2">{edital.description}</CardDescription>
                      )}
                    </div>
                    {isSubmitted ? (
                      <Badge variant="default">Submetida</Badge>
                    ) : (
                      <Badge variant={getStatusVariant(computed)}>{computed}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {edital.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Abertura: {format(new Date(edital.start_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      {edital.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Encerramento: {format(new Date(edital.end_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {isSubmitted ? (
                      <Button size="sm" variant="outline" onClick={() => setSelectedEdital(edital)}>
                        Visualizar proposta
                      </Button>
                    ) : hasDraft && open ? (
                      <Button size="sm" onClick={() => setSelectedEdital(edital)}>
                        Continuar rascunho <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : open ? (
                      <Button size="sm" onClick={() => setSelectedEdital(edital)}>
                        Preencher proposta <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : computed === "Agendado" ? (
                      <span className="text-sm text-muted-foreground">Aguardando abertura</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Submissões indisponíveis. Verifique o período de vigência do edital.</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EditaisAbertos;
