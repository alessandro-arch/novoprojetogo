import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle, Info, Pencil } from "lucide-react";
import { formatBRL, formatDateBR, daysRemaining } from "@/lib/fomento-utils";

interface Props {
  onEditProject: (id: string) => void;
}

const RANGES = [30, 60, 90, 180] as const;

const FomentoAlerts = ({ onEditProject }: Props) => {
  const { isSuperadmin, fomentoOrgId, fomentoRole } = useFomentoAuth();
  const isAuditor = fomentoRole === "auditor";
  const [range, setRange] = useState<number>(90);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["fomento-projects", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_projects").select("*");
      if (!isSuperadmin && fomentoOrgId) {
        query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const now = new Date();
  const active = (projects ?? []).filter((p) => p.status === "em_execucao" && p.vigencia_fim);

  const getExpiring = (maxDays: number) =>
    active.filter((p) => {
      const days = daysRemaining(p.vigencia_fim);
      return days != null && days >= 0 && days <= maxDays;
    });

  const critical = getExpiring(30).length;
  const attention = active.filter((p) => { const d = daysRemaining(p.vigencia_fim); return d != null && d > 30 && d <= 60; }).length;
  const monitor = active.filter((p) => { const d = daysRemaining(p.vigencia_fim); return d != null && d > 60 && d <= 90; }).length;

  const expiring = getExpiring(range).sort((a, b) => {
    const da = daysRemaining(a.vigencia_fim) ?? 999;
    const db = daysRemaining(b.vigencia_fim) ?? 999;
    return da - db;
  });

  const kpis = [
    { label: "Crítico ≤30d", count: critical, icon: AlertTriangle, color: "text-destructive", bg: "bg-[hsl(var(--danger-light))]" },
    { label: "Atenção 31-60d", count: attention, icon: AlertCircle, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-light))]" },
    { label: "Monitorar 61-90d", count: monitor, icon: Info, color: "text-[hsl(var(--info))]", bg: "bg-[hsl(var(--info-light))]" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading text-foreground">Alertas de Vigência</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold text-foreground">{k.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <Button key={r} variant={range === r ? "default" : "outline"} size="sm" onClick={() => setRange(r)}>
            {r} dias
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {expiring.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum projeto vencendo nos próximos {range} dias.
            </CardContent>
          </Card>
        ) : (
          expiring.map((p) => {
            const days = daysRemaining(p.vigencia_fim)!;
            const urgency = days <= 30 ? "destructive" : days <= 60 ? "secondary" : "outline";
            return (
              <Card key={p.id} className="shadow-sm">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{p.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.pesquisador_principal} · {p.orgao_financiador || "Financiador não informado"} · {formatBRL(Number(p.valor_total))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Vencimento: {formatDateBR(p.vigencia_fim)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={urgency as any}>{days}d restantes</Badge>
                    <Button variant="outline" size="sm" onClick={() => onEditProject(p.id)} className="gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FomentoAlerts;
