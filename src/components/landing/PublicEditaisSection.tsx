import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Globe, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const PublicEditaisSection = () => {
  const navigate = useNavigate();

  const { data: editais, isLoading } = useQuery({
    queryKey: ["public-editais"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("editais")
        .select("id, title, description, start_date, end_date, organization_id, organizations(name)")
        .eq("is_public", true)
        .eq("status", "published")
        .is("deleted_at", null)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order("end_date", { ascending: true, nullsFirst: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !editais || editais.length === 0) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Oportunidades Abertas</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
            Editais Públicos Abertos
          </h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Confira os editais com inscrições abertas e participe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {editais.map((edital: any) => (
            <Card key={edital.id} className="hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 border border-border/50">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-snug">{edital.title}</h3>
                  <Badge variant="outline" className="text-[10px] shrink-0">Público</Badge>
                </div>
                {edital.organizations?.name && (
                  <p className="text-xs text-muted-foreground">{edital.organizations.name}</p>
                )}
                {edital.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{edital.description}</p>
                )}
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {edital.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Abertura: {format(new Date(edital.start_date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                  {edital.end_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Encerramento: {format(new Date(edital.end_date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => navigate("/login")}>
                  Ver detalhes <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PublicEditaisSection;
