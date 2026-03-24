import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Briefcase, Users, AlertTriangle, Pencil, FileText, GraduationCap } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatBRL, formatDateBR, daysRemaining, AREA_LABELS, MODALIDADE_LABELS } from "@/lib/fomento-utils";

const COLORS = [
  "hsl(215, 65%, 30%)", "hsl(38, 80%, 52%)", "hsl(152, 55%, 42%)",
  "hsl(0, 68%, 52%)", "hsl(270, 50%, 50%)", "hsl(180, 50%, 40%)",
  "hsl(330, 60%, 50%)", "hsl(60, 70%, 45%)",
];

interface Props {
  onEditProject: (id: string) => void;
}

const FomentoDashboardView = ({ onEditProject }: Props) => {
  const { isSuperadmin, fomentoOrgId } = useFomentoAuth();

  const { data: projects, isLoading: loadingProjects } = useQuery({
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

  const { data: rubricas, isLoading: loadingRubricas } = useQuery({
    queryKey: ["fomento-rubricas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_rubricas").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: totalDocs } = useQuery({
    queryKey: ["fomento-docs-total"],
    queryFn: async () => {
      const { count, error } = await supabase.from("fomento_documents").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: bolsistas } = useQuery({
    queryKey: ["fomento-bolsistas-dashboard", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_bolsistas" as any).select("*");
      if (!isSuperadmin && fomentoOrgId) {
        query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const isLoading = loadingProjects || loadingRubricas;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const p = projects ?? [];
  const r = rubricas ?? [];

  const totalCaptado = p.reduce((s, x) => s + (Number(x.valor_total) || 0), 0);
  const ativos = p.filter((x) => x.status === "em_execucao").length;
  const pesquisadores = new Set(p.map((x) => x.pesquisador_principal)).size;
  const now = new Date();
  const in60d = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const vencendo60 = p.filter((x) => {
    if (x.status !== "em_execucao" || !x.vigencia_fim) return false;
    const fim = new Date(x.vigencia_fim);
    return fim >= now && fim <= in60d;
  }).length;

  const areaData = ["pesquisa", "inovacao", "extensao", "ensino", "servicos"].map((a) => {
    const filtered = p.filter((x) => x.area === a);
    return {
      area: AREA_LABELS[a] || a,
      count: filtered.length,
      value: filtered.reduce((s, x) => s + (Number(x.valor_total) || 0), 0),
    };
  });

  const researcherMap = new Map<string, number>();
  p.forEach((x) => {
    const cur = researcherMap.get(x.pesquisador_principal) || 0;
    researcherMap.set(x.pesquisador_principal, cur + (Number(x.valor_total) || 0));
  });
  const topResearchers = Array.from(researcherMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, value }));

  const agencyMap = new Map<string, number>();
  p.forEach((x) => {
    const key = x.orgao_financiador || "Não informado";
    agencyMap.set(key, (agencyMap.get(key) || 0) + (Number(x.valor_total) || 0));
  });
  const agencyData = Array.from(agencyMap.entries()).map(([name, value]) => ({ name, value }));

  const yearMap = new Map<number, number>();
  p.forEach((x) => {
    if (x.ano) yearMap.set(x.ano, (yearMap.get(x.ano) || 0) + (Number(x.valor_total) || 0));
  });
  const yearData = Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year: String(year), value }));

  const rubricaMap = new Map<string, number>();
  r.forEach((x) => {
    rubricaMap.set(x.tipo, (rubricaMap.get(x.tipo) || 0) + Number(x.valor));
  });
  const rubricaData = Array.from(rubricaMap.entries()).map(([name, value]) => ({ name, value }));

  const in90d = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const expiring = p
    .filter((x) => x.status === "em_execucao" && x.vigencia_fim && new Date(x.vigencia_fim) >= now && new Date(x.vigencia_fim) <= in90d)
    .sort((a, b) => new Date(a.vigencia_fim!).getTime() - new Date(b.vigencia_fim!).getTime());

  const kpis = [
    { label: "Total Captado", value: formatBRL(totalCaptado), icon: DollarSign, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success-light))]" },
    { label: "Projetos Ativos", value: String(ativos), icon: Briefcase, color: "text-primary", bg: "bg-[hsl(var(--info-light))]" },
    { label: "Pesquisadores", value: String(pesquisadores), icon: Users, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-light))]" },
    { label: "Vencendo em 60d", value: String(vencendo60), icon: AlertTriangle, color: vencendo60 > 0 ? "text-destructive" : "text-muted-foreground", bg: vencendo60 > 0 ? "bg-[hsl(var(--danger-light))]" : "bg-muted" },
    { label: "Total de Documentos", value: String(totalDocs ?? 0), icon: FileText, color: "text-primary", bg: "bg-[hsl(var(--info-light))]" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold text-foreground">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {areaData.map((a) => (
          <Card key={a.area} className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{a.area}</p>
              <p className="text-xl font-bold text-foreground">{a.count}</p>
              <p className="text-xs text-muted-foreground">{formatBRL(a.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Pesquisadores por Valor Captado</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topResearchers} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatBRL(v)} fontSize={10} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="value" fill="hsl(215, 65%, 30%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por Órgão Financiador</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agencyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name.length > 15 ? name.slice(0, 15) + "…" : name} fontSize={10}>
                  {agencyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução por Ano</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" fontSize={11} />
                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="value" fill="hsl(38, 80%, 52%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por Rubrica</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rubricaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name} fontSize={10}>
                  {rubricaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {expiring.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-sm">Vigências Vencendo em 90 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Pesquisador</TableHead>
                    <TableHead>Financiador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring.map((p) => {
                    const days = daysRemaining(p.vigencia_fim);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{p.titulo}</TableCell>
                        <TableCell>{p.pesquisador_principal}</TableCell>
                        <TableCell>{p.orgao_financiador || "—"}</TableCell>
                        <TableCell>{formatBRL(Number(p.valor_total))}</TableCell>
                        <TableCell>{formatDateBR(p.vigencia_fim)}</TableCell>
                        <TableCell>
                          <Badge variant={days != null && days <= 30 ? "destructive" : "secondary"}>
                            {days}d
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => onEditProject(p.id)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FomentoDashboardView;
