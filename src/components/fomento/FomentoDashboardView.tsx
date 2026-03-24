import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Briefcase, Users, AlertTriangle, Pencil, FileText, GraduationCap, Info, Handshake } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";
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

  const { data: parcerias } = useQuery({
    queryKey: ["fomento-parcerias-dashboard", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_parcerias").select("*");
      if (!isSuperadmin && fomentoOrgId) {
        query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
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
  const bList = bolsistas ?? [];

  const totalCaptadoProjetos = p.reduce((s, x) => s + (Number(x.valor_total) || 0), 0);
  const ativos = p.filter((x) => x.status === "em_execucao").length;
  const pesquisadores = new Set(p.map((x) => x.pesquisador_principal)).size;
  const now = new Date();
  const in60d = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const vencendo60 = p.filter((x) => {
    if (x.status !== "em_execucao" || !x.vigencia_fim) return false;
    const fim = new Date(x.vigencia_fim);
    return fim >= now && fim <= in60d;
  }).length;

  // Bolsistas KPIs
  const bolsistasAtivos = bList.filter((b) => b.status === "ativo");
  const totalMensalBolsas = bolsistasAtivos.reduce((s, b) => s + (Number(b.valor_mensal) || 0), 0);
  const totalComprometidoBolsas = bolsistasAtivos.reduce((s, b) => {
    const mensal = Number(b.valor_mensal) || 0;
    const cotas = Number(b.cotas_total) || 0;
    return s + mensal * cotas;
  }, 0);

  // Parcerias KPIs
  const parceriasList = parcerias ?? [];
  const parceriasAtivas = parceriasList.filter((p: any) => p.status === "ativa");
  const totalParceriasAtivas = parceriasAtivas.length;
  const totalCaptadoParcerias = parceriasAtivas.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);

  // Bolsas de parcerias ativas com modalidade "bolsa"
  const totalBolsasParcerias = parceriasAtivas
    .filter((p: any) => p.modalidade === "bolsa")
    .reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);
  const totalBolsasGeral = totalComprometidoBolsas + totalBolsasParcerias;

  const totalCaptado = totalCaptadoProjetos + totalBolsasGeral;

  const modalidades = ["ic", "mestrado", "doutorado", "pos_doc", "apoio_tecnico"] as const;
  const modalidadeStats = modalidades.map((m) => {
    const filtered = bolsistasAtivos.filter((b) => b.modalidade === m);
    const count = filtered.length;
    const mensalTotal = filtered.reduce((s, b) => s + (Number(b.valor_mensal) || 0), 0);
    const comprometido = filtered.reduce((s, b) => {
      const mensal = Number(b.valor_mensal) || 0;
      const cotas = Number(b.cotas_total) || 0;
      return s + mensal * cotas;
    }, 0);
    return { key: m, label: MODALIDADE_LABELS[m] || m, count, mensalTotal, comprometido };
  });

  const areaData = ["pesquisa", "inovacao", "extensao", "ensino", "servicos", "estagio_tecnico", "participacao_evento", "publicacao"].map((a) => {
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

  // Bolsas chart data
  const bolsasBarData = modalidadeStats.filter((m) => m.comprometido > 0 || m.count > 0);

  // Proportions for highlight card
  const pctProjetos = totalCaptado > 0 ? (totalCaptadoProjetos / totalCaptado) * 100 : 0;

  // Orientador chart
  const orientMap = new Map<string, number>();
  bList.forEach((b) => {
    const key = b.orientador || "Não informado";
    orientMap.set(key, (orientMap.get(key) || 0) + 1);
  });
  const orientData = Array.from(orientMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, value }));

  const kpis = [
    {
      label: "Total Captado",
      value: formatBRL(totalCaptado),
      icon: DollarSign,
      color: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success-light))]",
      tooltip: `${formatBRL(totalCaptadoProjetos)} em projetos + ${formatBRL(totalComprometidoBolsas)} em bolsas + ${formatBRL(totalCaptadoParcerias)} em parcerias`,
    },
    { label: "Projetos Ativos", value: String(ativos), icon: Briefcase, color: "text-primary", bg: "bg-[hsl(var(--info-light))]" },
    { label: "Bolsas", value: formatBRL(totalComprometidoBolsas), icon: GraduationCap, color: "text-[hsl(270,50%,50%)]", bg: "bg-[hsl(270,50%,90%)]" },
    { label: "Bolsas Mestrado", value: String(modalidadeStats.find(m => m.key === "mestrado")?.count ?? 0), icon: GraduationCap, color: "text-primary", bg: "bg-[hsl(var(--info-light))]" },
    { label: "Bolsas Doutorado", value: String(modalidadeStats.find(m => m.key === "doutorado")?.count ?? 0), icon: GraduationCap, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-light))]" },
    { label: "Parcerias Ativas", value: String(totalParceriasAtivas), icon: Handshake, color: "text-[hsl(152,55%,42%)]", bg: "bg-[hsl(152,55%,90%)]", tooltip: `Valor total: ${formatBRL(totalCaptadoParcerias)}` },
    { label: "Pesquisadores", value: String(pesquisadores), icon: Users, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-light))]" },
    { label: "Vencendo em 60d", value: String(vencendo60), icon: AlertTriangle, color: vencendo60 > 0 ? "text-destructive" : "text-muted-foreground", bg: vencendo60 > 0 ? "bg-[hsl(var(--danger-light))]" : "bg-muted" },
    { label: "Total de Documentos", value: String(totalDocs ?? 0), icon: FileText, color: "text-primary", bg: "bg-[hsl(var(--info-light))]" },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard</h1>

        {/* Project KPIs - Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.slice(0, 4).map((k) => (
            <Card key={k.label} className="shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-11 h-11 shrink-0 rounded-xl ${k.bg} flex items-center justify-center`}>
                  <k.icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                    {"tooltip" in k && k.tooltip && (
                      <UiTooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 shrink-0 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">{k.tooltip}</TooltipContent>
                      </UiTooltip>
                    )}
                  </div>
                  <p className="text-lg font-bold text-foreground truncate">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Project KPIs - Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.slice(4).map((k) => (
            <Card key={k.label} className="shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-11 h-11 shrink-0 rounded-xl ${k.bg} flex items-center justify-center`}>
                  <k.icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                    {"tooltip" in k && k.tooltip && (
                      <UiTooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 shrink-0 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">{k.tooltip}</TooltipContent>
                      </UiTooltip>
                    )}
                  </div>
                  <p className="text-lg font-bold text-foreground truncate">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Area breakdown */}
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

        {/* Project charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Pesquisadores por Valor Captado</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topResearchers} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatBRL(v)} fontSize={10} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                  <ReTooltip formatter={(v: number) => formatBRL(v)} />
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
                  <ReTooltip formatter={(v: number) => formatBRL(v)} />
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
                  <ReTooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" fill="hsl(38, 80%, 52%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por Rubrica (R$)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rubricaData
                  .sort((a, b) => b.value - a.value)
                  .map((item, i) => {
                    const maxVal = Math.max(...rubricaData.map(d => d.value), 1);
                    const pct = (item.value / maxVal) * 100;
                    return (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-4 h-4 shrink-0 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground w-48 shrink-0 truncate" title={item.name}>{item.name}</span>
                        <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-28 text-right shrink-0">{formatBRL(item.value)}</span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Por Rubrica (%)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const sorted = [...rubricaData].sort((a, b) => b.value - a.value);
                  const total = sorted.reduce((s, d) => s + d.value, 0) || 1;
                  return sorted.map((item, i) => {
                    const pctOfTotal = (item.value / total) * 100;
                    return (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-4 h-4 shrink-0 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground w-48 shrink-0 truncate" title={item.name}>{item.name}</span>
                        <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${pctOfTotal}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-16 text-right shrink-0">{pctOfTotal.toFixed(1)}%</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expiring table */}
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

        {/* ═══════════ SEÇÃO: BOLSAS ═══════════ */}
        <h2 className="text-lg font-bold font-heading text-foreground mt-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" /> Bolsas
        </h2>

        {/* Linha 1 — Totais gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[hsl(var(--info-light))] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Bolsas Ativas</p>
                <p className="text-lg font-bold text-foreground">{bolsistasAtivos.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[hsl(var(--success-light))] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[hsl(var(--success))]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Mensal Total em Bolsas</p>
                <p className="text-lg font-bold text-foreground">{formatBRL(totalMensalBolsas)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[hsl(var(--warning-light))] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total Comprometido</p>
                <p className="text-lg font-bold text-foreground">{formatBRL(totalComprometidoBolsas)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Linha 2 — Por modalidade */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {modalidadeStats.map((m) => (
            <Card key={m.key} className="shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{m.count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {m.count > 0
                    ? `${m.count} bolsista${m.count > 1 ? "s" : ""} · ${formatBRL(m.mensalTotal)}/mês`
                    : "Nenhum bolsista"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bolsas Mestrado/Doutorado por PPG — Rankings separados */}
        {(() => {
          const mdBolsistas = bolsistasAtivos.filter((b) => b.modalidade === "mestrado" || b.modalidade === "doutorado");
          const ppgMapM = new Map<string, number>();
          const ppgMapD = new Map<string, number>();
          mdBolsistas.forEach((b) => {
            const ppg = b.ppg_nome || "Sem PPG";
            if (b.modalidade === "mestrado") ppgMapM.set(ppg, (ppgMapM.get(ppg) || 0) + 1);
            else ppgMapD.set(ppg, (ppgMapD.get(ppg) || 0) + 1);
          });
          const mestData = Array.from(ppgMapM.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
          const doutData = Array.from(ppgMapD.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

          const RankingList = ({ title, data, color }: { title: string; data: { name: string; value: number }[]; color: string }) => {
            const maxVal = Math.max(...data.map(d => d.value), 1);
            return (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" style={{ color }} />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.map((item, i) => {
                      const pct = (item.value / maxVal) * 100;
                      return (
                        <div key={item.name} className="flex items-center gap-3">
                          <span className="w-4 h-4 shrink-0 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-muted-foreground min-w-[200px] max-w-[400px] shrink-0 truncate uppercase" title={item.name}>{item.name}</span>
                          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-xs font-bold text-foreground w-8 text-right shrink-0">{item.value}</span>
                        </div>
                      );
                    })}
                    {data.length === 0 && <p className="text-xs text-muted-foreground">Nenhum bolsista ativo</p>}
                  </div>
                </CardContent>
              </Card>
            );
          };

          return (
            <div className="grid grid-cols-1 gap-6">
              <RankingList title="Bolsas Mestrado por PPG" data={mestData} color="hsl(215, 65%, 30%)" />
              <RankingList title="Bolsas Doutorado por PPG" data={doutData} color="hsl(270, 50%, 50%)" />
            </div>
          );
        })()}
        {/* Gráficos de bolsas + Card Investimento em Formação */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de barras: Distribuição de Investimento em Bolsas */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de Investimento em Bolsas</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bolsasBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                  <ReTooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="comprometido" name="Total Comprometido" fill="hsl(270, 50%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Card Investimento em Formação */}
          <Card className="shadow-sm border-2 border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento em Formação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor total em projetos</span>
                  <span className="font-semibold text-foreground">{formatBRL(totalCaptadoProjetos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor total em bolsas</span>
                  <span className="font-semibold text-foreground">{formatBRL(totalComprometidoBolsas)}</span>
                </div>
                <div className="border-t border-border my-2" />
                <div className="flex justify-between text-base">
                  <span className="font-bold text-foreground">TOTAL CAPTADO</span>
                  <span className="font-bold text-foreground">{formatBRL(totalCaptado)}</span>
                </div>
              </div>

              {/* Barra de proporção */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Projetos ({pctProjetos.toFixed(1)}%)</span>
                  <span>Bolsas ({(100 - pctProjetos).toFixed(1)}%)</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pctProjetos}%` }}
                  />
                  <div
                    className="h-full bg-[hsl(270,50%,50%)] transition-all"
                    style={{ width: `${100 - pctProjetos}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Projetos</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[hsl(270,50%,50%)] inline-block" /> Bolsas</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bolsistas por orientador */}
        {orientData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Bolsistas por Orientador</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orientData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <ReTooltip />
                    <Bar dataKey="value" fill="hsl(270, 50%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default FomentoDashboardView;
