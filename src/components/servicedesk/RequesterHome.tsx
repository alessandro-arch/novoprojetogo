import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const db = supabase as any;
const fmt = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

interface Props { userId: string; onSignOut: () => void; noAccessMessage: string }

const RequesterHome = ({ userId, onSignOut, noAccessMessage }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ["sd-requester", userId],
    queryFn: async () => {
      const { data: st } = await db.from("sd_students").select("*, sd_programs(name, sigla)").eq("user_id", userId).maybeSingle();
      if (st) return { kind: "aluno" as const, row: st };
      const { data: fa } = await db.from("sd_faculty").select("*, sd_faculty_programs(relationship_type, sd_programs(name, sigla))").eq("user_id", userId).maybeSingle();
      if (fa) return { kind: "professor" as const, row: fa };
      return null;
    },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold font-heading">Service Desk Acadêmico</h1>
        <p className="text-muted-foreground mt-2">{noAccessMessage}</p>
        <Button variant="outline" className="mt-4" onClick={onSignOut}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
      </div>
    </div>
  );

  const r = data.row;
  const fields: [string, string][] = data.kind === "aluno"
    ? [
        ["Matrícula", r.enrollment], ["Nome", r.name], ["Programa", r.sd_programs?.name || "—"],
        ["Nível", r.level || "—"], ["Ingresso", fmt(r.entry_date ?? r.ingress_date)], ["Término previsto", fmt(r.expected_end ?? r.current_deadline)],
        ["Situação", r.status || "—"], ["E-mail", r.email || "—"],
      ]
    : [
        ["Matrícula", r.enrollment], ["Nome", r.name], ["Tipo de vínculo", r.contract_type || "—"],
        ["Programas", (r.sd_faculty_programs || []).map((p: any) => `${p.sd_programs?.sigla || p.sd_programs?.name}${p.relationship_type ? " · " + p.relationship_type : ""}`).join(", ") || "—"],
        ["Situação", r.status || "—"],
      ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-heading">Service Desk Acadêmico</h1>
            <p className="text-sm text-muted-foreground">Olá, {r.name?.split(" ")[0]} — área do {data.kind === "aluno" ? "aluno" : "professor"}</p>
          </div>
          <Button variant="outline" onClick={onSignOut}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
        </div>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Meus dados institucionais</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm font-medium">{v || "—"}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground mt-4">Estes dados vêm da base oficial da instituição e não podem ser alterados aqui.</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Em breve: solicitação de acesso VPN ao Portal de Periódicos CAPES, atualização de contato e "Informar divergência".
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RequesterHome;
