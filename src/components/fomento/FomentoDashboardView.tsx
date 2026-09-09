import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFomentoAuth } from "@/contexts/FomentoAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign, Briefcase, Users, AlertTriangle, Pencil, GraduationCap, Info,
  Handshake, TrendingUp, TrendingDown, Minus, Target, Building2, GitCompare, Layers,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
  Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";
import { formatBRL, formatDateBR, daysRemaining, AREA_LABELS, MODALIDADE_LABELS } from "@/lib/fomento-utils";
import { PPG_CANONICOS, normalizePPG, isPpgCanonico, SEM_PPG } from "@/lib/fomento-ppg";
import FomentoMetasDialog from "./FomentoMetasDialog";

const COLORS = [
  "hsl(215, 65%, 30%)", "hsl(38, 80%, 52%)", "hsl(152, 55%, 42%)",
  "hsl(0, 68%, 52%)", "hsl(270, 50%, 50%)", "hsl(180, 50%, 40%)",
  "hsl(330, 60%, 50%)", "hsl(60, 70%, 45%)",
];

const ALL = "__todos__";
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_OPTIONS = [
  { value: "em_execucao", label: "Ativo (em execução)" },
  { value: "prestacao_contas", label: "Prestação de Contas" },
  { value: "concluido", label: "Encerrado" },
  { value: "inadimplente", label: "Inadimplente" },
];

interface Props {
  onEditProject: (id: string) => void;
}

/** Ano de referência do projeto: início da vigência, com fallback para o campo ano */
const projectYear = (x: any): number | null => {
  if (x?.vigencia_inicio) {
    const y = new Date(String(x.vigencia_inicio) + "T12:00:00").getFullYear();
    if (!isNaN(y)) return y;
  }
  return x?.ano ?? null;
};
const projectMonth = (x: any): number | null => {
  if (!x?.vigencia_inicio) return null;
  const d = new Date(String(x.vigencia_inicio) + "T12:00:00");
  return isNaN(d.getTime()) ? null : d.getMonth();
};
const bolsistaYear = (b: any): number | null => {
  if (!b?.data_inicio) return null;
  const y = new Date(String(b.data_inicio) + "T12:00:00").getFullYear();
  return isNaN(y) ? null : y;
};

const sumProjects = (list: any[]) => list.reduce((s, x) => s + (Number(x.valor_total) || 0), 0);
const sumBolsas = (list: any[]) =>
  list.reduce((s, b) => s + (Number(b.valor_mensal) || 0) * (Number(b.cotas_total) || 0), 0);

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

/* ── Pequenos componentes visuais ─────────────────────────── */

const InfoHint = ({ text }: { text: string }) => (
  <UiTooltip>
    <TooltipTrigger asChild>
      <Info className="w-3.5 h-3.5 shrink-0 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
  </UiTooltip>
);

const Delta = ({ current, previous, suffix }: { current: number; previous: number; suffix?: string }) => {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">sem histórico</span>;
  const diff = current - previous;
  const variation = previous > 0 ? (diff / previous) * 100 : null;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone = diff > 0 ? "text-[hsl(var(--success))]" : diff < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${tone}`}>
      <Icon className="w-3 h-3" />
      {variation != null ? `${diff > 0 ? "+" : ""}${variation.toFixed(1)}%` : `${diff > 0 ? "+" : ""}${diff}${suffix ?? ""}`}
      <span className="text-muted-foreground font-normal">vs. ano anterior</span>
    </span>
  );
};

const KpiCard = ({
  label, value, icon: Icon, color, bg, hint, delta, meta,
}: any) => (
  <Card className="shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 shrink-0 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {hint && <InfoHint text={hint} />}
          </div>
          <p className="text-xl font-bold text-foreground truncate">{value}</p>
          {delta}
        </div>
      </div>
      {meta}
    </CardContent>
  </Card>
);

const BarRow = ({ label, valueLabel, ratio, color }: { label: string; valueLabel: string; ratio: number; color: string }) => (
  <div className="flex items-center gap-3">
    <span className="w-4 h-4 shrink-0 rounded" style={{ backgroundColor: color }} />
    <span className="text-xs text-muted-foreground w-48 shrink-0 truncate" title={label}>{label}</span>
    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
      <div className="h-full rounded" style={{ width: `${Math.max(ratio, 0)}%`, backgroundColor: color }} />
    </div>
    <span className="text-xs font-medium text-foreground w-28 text-right shrink-0">{valueLabel}</span>
  </div>
);

/* ── Componente principal ─────────────────────────────────── */

const FomentoDashboardView = ({ onEditProject }: Props) => {
  const { isSuperadmin, fomentoOrgId, fomentoRole } = useFomentoAuth();
  const isAuditor = fomentoRole === "auditor";
  const canEditMetas = isSuperadmin || fomentoRole === "admin" || fomentoRole === "gestor";
  const currentYear = new Date().getFullYear();

  const [ano, setAno] = useState<string>(String(currentYear));
  const [ppgFilter, setPpgFilter] = useState<string>(ALL);
  const [tipoFilter, setTipoFilter] = useState<string>(ALL);
  const [agencyFilter, setAgencyFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [compare, setCompare] = useState(false);
  const [tab, setTab] = useState("executiva");
  const [rubricaMode, setRubricaMode] = useState<"valor" | "pct">("valor");
  const [serieMode, setSerieMode] = useState<"anual" | "mensal">("anual");
  const [researcherMetric, setResearcherMetric] = useState<"captacao" | "projetos" | "bolsistas">("captacao");
  const [metasOpen, setMetasOpen] = useState(false);

  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["fomento-projects", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_projects").select("*");
      if (!isSuperadmin && fomentoOrgId) query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
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

  const { data: docs } = useQuery({
    queryKey: ["fomento-docs-project-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_documents").select("id, project_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: bolsistas } = useQuery({
    queryKey: ["fomento-bolsistas-dashboard", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_bolsistas" as any).select("*");
      if (!isSuperadmin && fomentoOrgId) query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: parcerias } = useQuery({
    queryKey: ["fomento-parcerias-dashboard", fomentoOrgId, isSuperadmin],
    queryFn: async () => {
      let query = supabase.from("fomento_parcerias").select("*");
      if (!isSuperadmin && fomentoOrgId) query = query.or(`organization_id.eq.${fomentoOrgId},organization_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["fomento-metas", fomentoOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fomento_metas" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const allProjects = useMemo(() => projects ?? [], [projects]);
  const allBolsistas = useMemo(() => bolsistas ?? [], [bolsistas]);
  const allRubricas = useMemo(() => rubricas ?? [], [rubricas]);
  const parceriasList = useMemo(() => parcerias ?? [], [parcerias]);

  /* Opções dos filtros */
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    allProjects.forEach((x) => { const y = projectYear(x); if (y) set.add(y); });
    allBolsistas.forEach((b) => { const y = bolsistaYear(b); if (y) set.add(y); });
    set.add(currentYear);
    const arr = Array.from(set);
    const min = Math.min(...arr), max = Math.max(...arr);
    // preenche anos vazios para não parecer dado faltante
    const full: number[] = [];
    for (let y = min; y <= max; y++) full.push(y);
    return full.sort((a, b) => b - a);
  }, [allProjects, allBolsistas, currentYear]);

  // Lista controlada: os 7 PPGs institucionais + eventuais nomes pendentes de revisão
  const ppgOptions = useMemo(() => {
    const extras = new Set<string>();
    [...allProjects, ...allBolsistas].forEach((x: any) => {
      const n = normalizePPG(x.ppg_nome);
      if (n && !isPpgCanonico(n)) extras.add(n);
    });
    return [...PPG_CANONICOS, ...Array.from(extras).sort()];
  }, [allProjects, allBolsistas]);

  const agencyOptions = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((x) => { const v = (x.orgao_financiador || "").trim(); if (v) set.add(v.toUpperCase()); });
    return Array.from(set).sort();
  }, [allProjects]);

  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((x) => { if (x.area) set.add(x.area); });
    return Array.from(set).sort();
  }, [allProjects]);

  /* Filtragem (sem o ano — usado para séries temporais) */
  const matchesNonYear = (x: any) => {
    if (ppgFilter !== ALL && normalizePPG(x.ppg_nome) !== ppgFilter) return false;
    if (tipoFilter !== ALL && x.area !== tipoFilter) return false;
    if (agencyFilter !== ALL && (x.orgao_financiador || "").trim().toUpperCase() !== agencyFilter) return false;
    if (statusFilter !== ALL && x.status !== statusFilter) return false;
    return true;
  };

  const baseProjects = useMemo(() => allProjects.filter(matchesNonYear),
    [allProjects, ppgFilter, tipoFilter, agencyFilter, statusFilter]);

  const selectedYear = ano === ALL ? null : Number(ano);
  const previousYear = selectedYear != null ? selectedYear - 1 : null;

  const projectsOfYear = (y: number | null) =>
    y == null ? baseProjects : baseProjects.filter((x) => projectYear(x) === y);

  const p = useMemo(() => projectsOfYear(selectedYear), [baseProjects, selectedYear]);
  const pPrev = useMemo(() => projectsOfYear(previousYear), [baseProjects, previousYear]);

  const bolsistasBase = useMemo(() => allBolsistas.filter((b) => {
    if (ppgFilter !== ALL && (b.ppg_nome || "").toUpperCase() !== ppgFilter) return false;
    return true;
  }), [allBolsistas, ppgFilter]);

  const bolsistasOfYear = (y: number | null) =>
    y == null ? bolsistasBase : bolsistasBase.filter((b) => bolsistaYear(b) === y);

  const bList = useMemo(() => bolsistasOfYear(selectedYear), [bolsistasBase, selectedYear]);
  const bListPrev = useMemo(() => bolsistasOfYear(previousYear), [bolsistasBase, previousYear]);

  const bolsistasAtivos = bList.filter((b) => b.status === "ativo");
  const bolsistasAtivosPrev = bListPrev.filter((b) => b.status === "ativo");

  const projIds = useMemo(() => new Set(p.map((x) => x.id)), [p]);
  const rubricasFiltered = useMemo(() => allRubricas.filter((x: any) => projIds.has(x.project_id)), [allRubricas, projIds]);

  /* ── Definições financeiras padronizadas ────────────────── */
  const captacaoProjetos = sumProjects(p);
  const captacaoProjetosPrev = sumProjects(pPrev);
  const bolsasDiretas = sumBolsas(bolsistasAtivos);
  const bolsasDiretasPrev = sumBolsas(bolsistasAtivosPrev);

  const parceriasAtivas = parceriasList.filter((x: any) => x.status === "ativa");
  const bolsasViaParceria = parceriasAtivas
    .filter((x: any) => x.modalidade === "bolsa")
    .reduce((s: number, x: any) => s + (Number(x.valor_total) || 0), 0);

  // Captação total: parcerias entram apenas na visão "Todos os anos" (não possuem data de referência)
  const incluiParcerias = selectedYear == null;
  const captacaoTotal = captacaoProjetos + bolsasDiretas + (incluiParcerias ? bolsasViaParceria : 0);
  const captacaoTotalPrev = captacaoProjetosPrev + bolsasDiretasPrev;

  const DEF_PROJETOS = "Captação em projetos: soma do valor total dos projetos que atendem aos filtros. Ano de referência = início da vigência.";
  const DEF_DIRETAS = "Bolsas institucionais/diretas: valor mensal × número de cotas dos bolsistas ativos cadastrados em Bolsas.";
  const DEF_PARCERIA = 'Bolsas via parceria: valor total das parcerias ativas com modalidade "Bolsa". Não possuem ano de referência, portanto só entram na visão "Todos os anos".';
  const DEF_TOTAL = `Captação total = capação em projetos + bolsas diretas${incluiParcerias ? " + bolsas via parceria" : " (bolsas via parceria não entram em recortes anuais)"}.`;

  const ativos = p.filter((x) => x.status === "em_execucao").length;
  const ativosPrev = pPrev.filter((x) => x.status === "em_execucao").length;
  const pesquisadores = new Set(p.map((x) => x.pesquisador_principal)).size;
  const pesquisadoresPrev = new Set(pPrev.map((x) => x.pesquisador_principal)).size;
  const ppgsComCaptacao = new Set(p.filter((x) => x.ppg_nome).map((x) => x.ppg_nome!.toUpperCase())).size;
  const ppgsComCaptacaoPrev = new Set(pPrev.filter((x) => x.ppg_nome).map((x) => x.ppg_nome!.toUpperCase())).size;

  const meta = useMemo(() => (metas ?? []).find((m: any) => m.ano === (selectedYear ?? currentYear)) ?? null,
    [metas, selectedYear, currentYear]);

  /* ── Séries temporais ───────────────────────────────────── */
  const yearSeries = useMemo(() => {
    const map = new Map<number, number>();
    baseProjects.forEach((x) => {
      const y = projectYear(x);
      if (y) map.set(y, (map.get(y) || 0) + (Number(x.valor_total) || 0));
    });
    if (map.size === 0) return [];
    const years = Array.from(map.keys());
    const min = Math.min(...years), max = Math.max(...years, currentYear);
    const out: { year: string; value: number }[] = [];
    for (let y = min; y <= max; y++) out.push({ year: String(y), value: map.get(y) || 0 });
    return out;
  }, [baseProjects, currentYear]);

  const monthlySeries = useMemo(() => {
    const yA = selectedYear ?? currentYear;
    const yB = yA - 1;
    const acc = (y: number) => {
      const per = Array(12).fill(0);
      baseProjects.forEach((x) => {
        if (projectYear(x) !== y) return;
        const m = projectMonth(x);
        if (m == null) return;
        per[m] += Number(x.valor_total) || 0;
      });
      let run = 0;
      return per.map((v) => (run += v));
    };
    const a = acc(yA), b = acc(yB);
    return MONTHS.map((m, i) => ({ mes: m, [String(yA)]: a[i], [String(yB)]: b[i] } as any));
  }, [baseProjects, selectedYear, currentYear]);

  const bolsasYearSeries = useMemo(() => {
    const map = new Map<number, { count: number; valor: number }>();
    bolsistasBase.forEach((b) => {
      const y = bolsistaYear(b);
      if (!y) return;
      const cur = map.get(y) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += (Number(b.valor_mensal) || 0) * (Number(b.cotas_total) || 0);
      map.set(y, cur);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
      .map(([year, v]) => ({ year: String(year), bolsas: v.count, valor: v.valor }));
  }, [bolsistasBase]);

  /* ── Agregações ─────────────────────────────────────────── */
  const agencyData = useMemo(() => {
    const map = new Map<string, number>();
    p.forEach((x) => {
      const raw = (x.orgao_financiador || "").trim();
      const key = raw ? raw.toUpperCase() : "NÃO INFORMADO";
      map.set(key, (map.get(key) || 0) + (Number(x.valor_total) || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [p]);

  const normalizeRubrica = (tipo: string): string => {
    const t = tipo.trim().toLowerCase();
    if (/^bolsa/i.test(t)) return "Bolsas";
    if (/equip.*perman|mat.*perman|perman.*equip/i.test(t)) return "Equipamentos e Material Permanente";
    if (/m(aterial|\.)?\s*(de\s+)?consumo/i.test(t)) return "Material de Consumo";
    if (/servi.*(terceiro|3)|s\.\s*de\s+terceiro/i.test(t)) return "Serviços de Terceiros";
    if (/outro.*servi.*terceiro/i.test(t)) return "Serviços de Terceiros";
    if (/di[áa]ria/i.test(t)) return "Diárias";
    if (/passagen/i.test(t)) return "Passagens";
    if (/hospeda|alimenta/i.test(t)) return "Hospedagem/Alimentação";
    if (/^pessoal$/i.test(t)) return "Pessoal";
    if (/encargo/i.test(t)) return "Encargos";
    return tipo.trim().charAt(0).toUpperCase() + tipo.trim().slice(1);
  };

  const rubricaData = useMemo(() => {
    const map = new Map<string, number>();
    rubricasFiltered.forEach((x: any) => {
      const n = normalizeRubrica(x.tipo);
      map.set(n, (map.get(n) || 0) + Number(x.valor));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rubricasFiltered]);

  const ppgTable = useMemo(() => {
    const map = new Map<string, { value: number; projetos: number; pesquisadores: Set<string>; bolsistas: number }>();
    p.forEach((x) => {
      const key = (x.ppg_nome || "SEM PPG").toUpperCase();
      const cur = map.get(key) || { value: 0, projetos: 0, pesquisadores: new Set<string>(), bolsistas: 0 };
      cur.value += Number(x.valor_total) || 0;
      cur.projetos += 1;
      cur.pesquisadores.add(x.pesquisador_principal);
      map.set(key, cur);
    });
    bolsistasAtivos.forEach((b) => {
      const key = (b.ppg_nome || "SEM PPG").toUpperCase();
      const cur = map.get(key) || { value: 0, projetos: 0, pesquisadores: new Set<string>(), bolsistas: 0 };
      cur.bolsistas += 1;
      map.set(key, cur);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v.value, 0);
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        value: v.value,
        share: pct(v.value, total),
        projetos: v.projetos,
        pesquisadores: v.pesquisadores.size,
        bolsistas: v.bolsistas,
        porPesquisador: v.pesquisadores.size > 0 ? v.value / v.pesquisadores.size : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [p, bolsistasAtivos]);

  const researcherTable = useMemo(() => {
    const map = new Map<string, { captacao: number; projetos: number; bolsistas: number }>();
    p.forEach((x) => {
      const key = x.pesquisador_principal;
      const cur = map.get(key) || { captacao: 0, projetos: 0, bolsistas: 0 };
      cur.captacao += Number(x.valor_total) || 0;
      cur.projetos += 1;
      map.set(key, cur);
    });
    bolsistasAtivos.forEach((b) => {
      const key = b.orientador;
      if (!key) return;
      const cur = map.get(key) || { captacao: 0, projetos: 0, bolsistas: 0 };
      cur.bolsistas += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b[researcherMetric] - a[researcherMetric]);
  }, [p, bolsistasAtivos, researcherMetric]);

  const areaData = useMemo(() =>
    ["pesquisa", "inovacao", "extensao", "ensino", "servicos", "estagio_tecnico", "participacao_evento", "publicacao"].map((a) => {
      const filtered = p.filter((x) => x.area === a);
      return { area: AREA_LABELS[a] || a, count: filtered.length, value: sumProjects(filtered) };
    }), [p]);

  const modalidadeStats = useMemo(() => {
    const modalidades = ["ic", "mestrado", "doutorado", "pos_doc", "apoio_tecnico"] as const;
    return modalidades.map((m) => {
      const filtered = bolsistasAtivos.filter((b) => b.modalidade === m);
      return {
        key: m,
        label: MODALIDADE_LABELS[m] || m,
        count: filtered.length,
        mensalTotal: filtered.reduce((s, b) => s + (Number(b.valor_mensal) || 0), 0),
        comprometido: sumBolsas(filtered),
      };
    });
  }, [bolsistasAtivos]);

  /* ── Indicadores derivados & alertas ────────────────────── */
  const now = new Date();
  const in90d = new Date(now.getTime() + 90 * 864e5);
  const expiring = useMemo(() => p
    .filter((x) => x.status === "em_execucao" && x.vigencia_fim && new Date(x.vigencia_fim) >= now && new Date(x.vigencia_fim) <= in90d)
    .sort((a, b) => new Date(a.vigencia_fim!).getTime() - new Date(b.vigencia_fim!).getTime()), [p]);

  const projetosComDoc = useMemo(() => new Set((docs ?? []).map((d: any) => d.project_id)), [docs]);
  const semDocumentos = p.filter((x) => !projetosComDoc.has(x.id));

  const ppgsSemCaptacao = useMemo(() => {
    if (selectedYear == null) return [];
    const comCaptacao = new Set(p.filter((x) => x.ppg_nome).map((x) => x.ppg_nome!.toUpperCase()));
    return ppgOptions.filter((ppg) => !comCaptacao.has(ppg));
  }, [p, ppgOptions, selectedYear]);

  const bolsasEncerrando90 = bolsistasAtivos.filter((b) => {
    const d = daysRemaining(b.data_fim);
    return d != null && d >= 0 && d <= 90;
  }).length;

  const mesesMediosRestantes = useMemo(() => {
    const vals = bolsistasAtivos.map((b) => daysRemaining(b.data_fim)).filter((d): d is number => d != null && d > 0);
    if (!vals.length) return 0;
    return vals.reduce((s, d) => s + d, 0) / vals.length / 30.4;
  }, [bolsistasAtivos]);

  const totalMensalBolsas = bolsistasAtivos.reduce((s, b) => s + (Number(b.valor_mensal) || 0), 0);
  const custoAnualizadoBolsas = totalMensalBolsas * 12;

  const concentracaoFinanciador = agencyData.length ? pct(agencyData[0].value, captacaoProjetos) : 0;
  const top3Concentracao = pct(
    researcherTable.slice(0, 3).reduce((s, r) => s + r.captacao, 0),
    researcherTable.reduce((s, r) => s + r.captacao, 0)
  );
  const semPpg = ppgTable.find((x) => x.name === "SEM PPG");
  const captacaoMediaProjeto = p.length ? captacaoProjetos / p.length : 0;
  const captacaoMediaPesquisador = pesquisadores ? captacaoProjetos / pesquisadores : 0;
  const pesquisadoresAtivos = new Set(p.filter((x) => x.status === "em_execucao").map((x) => x.pesquisador_principal)).size;

  const alerts = [
    expiring.length > 0 && { tone: "warn", text: `${expiring.length} projeto${expiring.length > 1 ? "s" : ""} encerra${expiring.length > 1 ? "m" : ""} nos próximos 90 dias` },
    ppgsSemCaptacao.length > 0 && { tone: "warn", text: `${ppgsSemCaptacao.length} PPG${ppgsSemCaptacao.length > 1 ? "s" : ""} sem nova captação em ${selectedYear}` },
    semDocumentos.length > 0 && { tone: "danger", text: `${semDocumentos.length} projeto${semDocumentos.length > 1 ? "s" : ""} sem nenhum documento anexado` },
    bolsasEncerrando90 > 0 && { tone: "warn", text: `${bolsasEncerrando90} bolsa${bolsasEncerrando90 > 1 ? "s" : ""} encerra${bolsasEncerrando90 > 1 ? "m" : ""} em até 90 dias` },
    concentracaoFinanciador >= 70 && agencyData.length > 0 && { tone: "info", text: `Concentração de financiamento: ${concentracaoFinanciador.toFixed(0)}% dos recursos vêm de ${agencyData[0].name}` },
    semPpg && semPpg.value > 0 && { tone: "info", text: `${formatBRL(semPpg.value)} (${semPpg.share.toFixed(1)}%) de captação sem vínculo com PPG` },
    bolsistasAtivos.length > 0 && { tone: "ok", text: `${bolsistasAtivos.length} bolsas ativas · ${formatBRL(totalMensalBolsas)}/mês` },
  ].filter(Boolean) as { tone: string; text: string }[];

  const toneDot: Record<string, string> = {
    danger: "bg-destructive",
    warn: "bg-[hsl(var(--warning))]",
    info: "bg-[hsl(var(--info))]",
    ok: "bg-[hsl(var(--success))]",
  };

  if (loadingProjects || loadingRubricas) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const periodoLabel = selectedYear == null ? "todos os anos" : String(selectedYear);

  const MetaBar = ({ atual, alvo, formatter }: { atual: number; alvo: number; formatter: (n: number) => string }) => {
    if (!alvo) return null;
    const perc = Math.min(pct(atual, alvo), 100);
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>Meta {selectedYear ?? currentYear}: {formatter(alvo)}</span>
          <span className="font-semibold text-foreground">{pct(atual, alvo).toFixed(1)}%</span>
        </div>
        <Progress value={perc} className="h-1.5" />
      </div>
    );
  };

  const kpiCards = [
    {
      label: "Captação total",
      value: formatBRL(captacaoTotal),
      icon: DollarSign,
      color: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success-light))]",
      hint: `${DEF_TOTAL}\n\n${formatBRL(captacaoProjetos)} em projetos + ${formatBRL(bolsasDiretas)} em bolsas diretas${incluiParcerias ? ` + ${formatBRL(bolsasViaParceria)} em bolsas via parceria` : ""}.`,
      delta: <Delta current={captacaoTotal} previous={captacaoTotalPrev} />,
      meta: <MetaBar atual={captacaoTotal} alvo={Number(meta?.meta_captacao) || 0} formatter={formatBRL} />,
    },
    {
      label: "Captação em projetos",
      value: formatBRL(captacaoProjetos),
      icon: Briefcase, color: "text-primary", bg: "bg-[hsl(var(--info-light))]",
      hint: DEF_PROJETOS,
      delta: <Delta current={captacaoProjetos} previous={captacaoProjetosPrev} />,
    },
    {
      label: "Projetos ativos",
      value: String(ativos),
      icon: Layers, color: "text-primary", bg: "bg-[hsl(var(--info-light))]",
      hint: `${p.length} projetos no período; ${ativos} com status "em execução".`,
      delta: <Delta current={ativos} previous={ativosPrev} suffix="" />,
      meta: <MetaBar atual={p.length} alvo={Number(meta?.meta_projetos) || 0} formatter={(n) => `${n} projetos`} />,
    },
    {
      label: "Bolsas ativas",
      value: String(bolsistasAtivos.length),
      icon: GraduationCap, color: "text-[hsl(270,50%,50%)]", bg: "bg-[hsl(270,50%,90%)]",
      hint: `${DEF_DIRETAS} Comprometido no período: ${formatBRL(bolsasDiretas)}.`,
      delta: <Delta current={bolsistasAtivos.length} previous={bolsistasAtivosPrev.length} />,
      meta: <MetaBar atual={bolsistasAtivos.length} alvo={Number(meta?.meta_bolsas) || 0} formatter={(n) => `${n} bolsas`} />,
    },
    {
      label: "Pesquisadores envolvidos",
      value: String(pesquisadores),
      icon: Users, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-light))]",
      hint: `Pesquisadores principais distintos no período. ${pesquisadoresAtivos} com projeto em execução.`,
      delta: <Delta current={pesquisadores} previous={pesquisadoresPrev} />,
      meta: <MetaBar atual={pesquisadores} alvo={Number(meta?.meta_pesquisadores) || 0} formatter={(n) => `${n} pesquisadores`} />,
    },
    {
      label: "PPGs com captação",
      value: `${ppgsComCaptacao}${ppgOptions.length ? ` de ${ppgOptions.length}` : ""}`,
      icon: Building2, color: "text-[hsl(152,55%,42%)]", bg: "bg-[hsl(152,55%,90%)]",
      hint: "Programas de pós-graduação com ao menos um projeto captado no período, sobre o total de PPGs já registrados.",
      delta: <Delta current={ppgsComCaptacao} previous={ppgsComCaptacaoPrev} />,
    },
  ];

  const maxRubrica = Math.max(...rubricaData.map((d) => d.value), 1);
  const totalRubrica = rubricaData.reduce((s, d) => s + d.value, 0) || 1;
  const maxAgency = Math.max(...agencyData.map((d) => d.value), 1);
  const totalAgency = agencyData.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Cabeçalho + barra global de filtros */}
        <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold font-heading text-foreground">
                Dashboard de Pesquisa, Pós-Graduação e Inovação
              </h1>
              <p className="text-xs text-muted-foreground">Período: {periodoLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={compare ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setCompare((v) => !v)} disabled={selectedYear == null}>
                <GitCompare className="w-4 h-4" />
                Comparar {(selectedYear ?? currentYear) - 1} × {selectedYear ?? currentYear}
              </Button>
              {canEditMetas && !isAuditor && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMetasOpen(true)}>
                  <Target className="w-4 h-4" /> Metas
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os anos</SelectItem>
                {anosDisponiveis.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={ppgFilter} onValueChange={setPpgFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="PPG" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os PPGs</SelectItem>
                {ppgOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os tipos</SelectItem>
                {tipoOptions.map((v) => <SelectItem key={v} value={v}>{AREA_LABELS[v] || v}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Financiador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos financiadores</SelectItem>
                {agencyOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="executiva">Visão Executiva</TabsTrigger>
            <TabsTrigger value="captacao">Captação</TabsTrigger>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="bolsas">Bolsas</TabsTrigger>
            <TabsTrigger value="ppgs">PPGs</TabsTrigger>
            <TabsTrigger value="pesquisadores">Pesquisadores</TabsTrigger>
          </TabsList>

          {/* ═══ VISÃO EXECUTIVA ═══ */}
          <TabsContent value="executiva" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  Evolução da Captação <InfoHint text="Valores de projetos, agrupados pelo ano/mês de início da vigência." />
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant={serieMode === "anual" ? "default" : "outline"} onClick={() => setSerieMode("anual")}>Anual</Button>
                  <Button size="sm" variant={serieMode === "mensal" ? "default" : "outline"} onClick={() => setSerieMode("mensal")}>Mensal acumulado</Button>
                </div>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {serieMode === "anual" ? (
                    <BarChart data={yearSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" fontSize={11} />
                      <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                      <ReTooltip formatter={(v: number) => formatBRL(v)} />
                      <Bar dataKey="value" name="Captação" fill="hsl(215, 65%, 30%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" fontSize={11} />
                      <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                      <ReTooltip formatter={(v: number) => formatBRL(v)} />
                      <Legend />
                      <Line type="monotone" dataKey={String((selectedYear ?? currentYear) - 1)} stroke="hsl(38, 80%, 52%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey={String(selectedYear ?? currentYear)} stroke="hsl(215, 65%, 30%)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {compare && selectedYear != null && (
              <Card className="shadow-sm border-2 border-primary/20">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Comparativo {previousYear} × {selectedYear}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead className="text-right">{previousYear}</TableHead>
                        <TableHead className="text-right">{selectedYear}</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { l: "Captação em projetos", a: captacaoProjetosPrev, b: captacaoProjetos, money: true },
                        { l: "Bolsas institucionais/diretas", a: bolsasDiretasPrev, b: bolsasDiretas, money: true },
                        { l: "Projetos ativos", a: ativosPrev, b: ativos },
                        { l: "Bolsas ativas", a: bolsistasAtivosPrev.length, b: bolsistasAtivos.length },
                        { l: "Pesquisadores", a: pesquisadoresPrev, b: pesquisadores },
                        { l: "PPGs com captação", a: ppgsComCaptacaoPrev, b: ppgsComCaptacao },
                      ].map((row) => {
                        const diff = row.b - row.a;
                        const variation = row.a > 0 ? (diff / row.a) * 100 : null;
                        return (
                          <TableRow key={row.l}>
                            <TableCell className="font-medium">{row.l}</TableCell>
                            <TableCell className="text-right">{row.money ? formatBRL(row.a) : row.a}</TableCell>
                            <TableCell className="text-right font-semibold">{row.money ? formatBRL(row.b) : row.b}</TableCell>
                            <TableCell className={`text-right ${diff > 0 ? "text-[hsl(var(--success))]" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {variation != null ? `${diff > 0 ? "+" : ""}${variation.toFixed(1)}%` : `${diff > 0 ? "+" : ""}${row.money ? formatBRL(diff) : diff}`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Captação por PPG</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {ppgTable.slice(0, 8).map((item, i) => (
                    <BarRow key={item.name} label={item.name} color={COLORS[i % COLORS.length]}
                      ratio={pct(item.value, Math.max(...ppgTable.map((d) => d.value), 1))}
                      valueLabel={`${formatBRL(item.value)} · ${item.share.toFixed(1)}%`} />
                  ))}
                  {ppgTable.length === 0 && <p className="text-xs text-muted-foreground">Sem dados no período.</p>}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Fontes de Recursos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {agencyData.map((item, i) => (
                    <BarRow key={item.name} label={item.name} color={COLORS[i % COLORS.length]}
                      ratio={pct(item.value, maxAgency)}
                      valueLabel={`${formatBRL(item.value)} · ${pct(item.value, totalAgency).toFixed(0)}%`} />
                  ))}
                  {agencyData.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Concentração de financiamento: </span>
                      {concentracaoFinanciador.toFixed(0)}% dos recursos vêm de {agencyData[0].name}
                      {concentracaoFinanciador >= 70 && " — risco de dependência de fonte única."}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">Composição dos recursos por rubrica</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant={rubricaMode === "valor" ? "default" : "outline"} onClick={() => setRubricaMode("valor")}>R$</Button>
                    <Button size="sm" variant={rubricaMode === "pct" ? "default" : "outline"} onClick={() => setRubricaMode("pct")}>%</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rubricaData.map((item, i) => (
                    <BarRow key={item.name} label={item.name} color={COLORS[i % COLORS.length]}
                      ratio={rubricaMode === "valor" ? pct(item.value, maxRubrica) : pct(item.value, totalRubrica)}
                      valueLabel={rubricaMode === "valor"
                        ? `${formatBRL(item.value)} · ${pct(item.value, totalRubrica).toFixed(1)}%`
                        : `${pct(item.value, totalRubrica).toFixed(1)}%`} />
                  ))}
                  {rubricaData.length === 0 && <p className="text-xs text-muted-foreground">Sem rubricas cadastradas no período.</p>}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" /> Atenção da Gestão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                      <span className={`w-2.5 h-2.5 mt-1.5 shrink-0 rounded-full ${toneDot[a.tone]}`} />
                      <span>{a.text}</span>
                    </div>
                  ))}
                  {alerts.length === 0 && <p className="text-xs text-muted-foreground">Nenhum ponto de atenção no período.</p>}
                </CardContent>
              </Card>
            </div>

            {/* Indicadores derivados */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Indicadores Derivados</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { l: "Captação média por projeto", v: formatBRL(captacaoMediaProjeto) },
                  { l: "Captação média por pesquisador", v: formatBRL(captacaoMediaPesquisador) },
                  { l: "Pesquisadores com projeto ativo", v: `${pesquisadoresAtivos} de ${pesquisadores}` },
                  { l: "PPGs com captação", v: `${ppgsComCaptacao} de ${ppgOptions.length || ppgsComCaptacao}` },
                  { l: "Concentração — Top 3 pesquisadores", v: `${top3Concentracao.toFixed(1)}%` },
                  { l: "Concentração — maior PPG", v: ppgTable.length ? `${ppgTable[0].share.toFixed(1)}% (${ppgTable[0].name})` : "—" },
                  { l: "Captação sem vínculo com PPG", v: semPpg ? `${formatBRL(semPpg.value)} · ${semPpg.share.toFixed(1)}%` : "R$ 0,00" },
                  { l: "Concentração — maior financiador", v: agencyData.length ? `${concentracaoFinanciador.toFixed(0)}% (${agencyData[0].name})` : "—" },
                ].map((k) => (
                  <div key={k.l} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{k.l}</p>
                    <p className="text-base font-bold text-foreground mt-0.5">{k.v}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ CAPTAÇÃO ═══ */}
          <TabsContent value="captacao" className="space-y-6 mt-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Definições dos indicadores financeiros</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { l: "Captação em projetos", v: captacaoProjetos, d: DEF_PROJETOS },
                  { l: "Bolsas institucionais/diretas", v: bolsasDiretas, d: DEF_DIRETAS },
                  { l: "Bolsas via parceria", v: bolsasViaParceria, d: DEF_PARCERIA },
                  { l: "Captação total", v: captacaoTotal, d: DEF_TOTAL },
                ].map((row) => (
                  <div key={row.l} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.l}</p>
                      <p className="text-xs text-muted-foreground">{row.d}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground whitespace-nowrap">{formatBRL(row.v)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução da Captação (anual)</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" fontSize={11} />
                    <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                    <ReTooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="value" name="Captação" fill="hsl(215, 65%, 30%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Fontes de Recursos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {agencyData.map((item, i) => (
                    <BarRow key={item.name} label={item.name} color={COLORS[i % COLORS.length]}
                      ratio={pct(item.value, maxAgency)}
                      valueLabel={`${formatBRL(item.value)} · ${pct(item.value, totalAgency).toFixed(0)}%`} />
                  ))}
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Composição por rubrica</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {rubricaData.map((item, i) => (
                    <BarRow key={item.name} label={item.name} color={COLORS[i % COLORS.length]}
                      ratio={pct(item.value, maxRubrica)}
                      valueLabel={`${formatBRL(item.value)} · ${pct(item.value, totalRubrica).toFixed(1)}%`} />
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ PROJETOS ═══ */}
          <TabsContent value="projetos" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {areaData.filter((a) => a.count > 0).map((a) => (
                <Card key={a.area} className="shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">{a.area}</p>
                    <p className="text-xl font-bold text-foreground">{a.count}</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(a.value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Vigências vencendo em 90 dias</CardTitle></CardHeader>
              <CardContent>
                {expiring.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">Nenhum projeto vencendo nos próximos 90 dias.</p>
                ) : (
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
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expiring.map((x) => {
                          const days = daysRemaining(x.vigencia_fim);
                          return (
                            <TableRow key={x.id}>
                              <TableCell className="font-medium max-w-[240px] truncate" title={x.titulo}>{x.titulo}</TableCell>
                              <TableCell>{x.pesquisador_principal}</TableCell>
                              <TableCell>{x.orgao_financiador || "—"}</TableCell>
                              <TableCell>{formatBRL(Number(x.valor_total))}</TableCell>
                              <TableCell>{formatDateBR(x.vigencia_fim)}</TableCell>
                              <TableCell><Badge variant={days != null && days <= 30 ? "destructive" : "secondary"}>{days}d</Badge></TableCell>
                              <TableCell>
                                {!isAuditor && (
                                  <Button variant="ghost" size="icon" onClick={() => onEditProject(x.id)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Projetos sem documentação anexada ({semDocumentos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {semDocumentos.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Todos os projetos do período possuem documentos.</p>
                ) : (
                  <div className="space-y-1.5">
                    {semDocumentos.slice(0, 15).map((x) => (
                      <div key={x.id} className="flex items-center justify-between gap-3 text-sm border-b border-border pb-1.5 last:border-0">
                        <span className="truncate" title={x.titulo}>{x.titulo}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{x.pesquisador_principal}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ BOLSAS ═══ */}
          <TabsContent value="bolsas" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { l: "Bolsas ativas", v: String(bolsistasAtivos.length), hint: DEF_DIRETAS },
                { l: "Custo mensal", v: formatBRL(totalMensalBolsas) },
                { l: "Custo anualizado", v: formatBRL(custoAnualizadoBolsas), hint: "Custo mensal × 12." },
                { l: "Comprometido (diretas)", v: formatBRL(bolsasDiretas), hint: DEF_DIRETAS },
                { l: "Bolsas via parceria", v: formatBRL(bolsasViaParceria), hint: DEF_PARCERIA },
                { l: "Meses médios remanescentes", v: mesesMediosRestantes.toFixed(1) },
                { l: "Encerrando em 90 dias", v: String(bolsasEncerrando90) },
                { l: "PPGs atendidos", v: `${new Set(bolsistasAtivos.filter((b) => b.ppg_nome).map((b) => b.ppg_nome.toUpperCase())).size} de ${ppgOptions.length || "—"}` },
              ].map((k) => (
                <Card key={k.l} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground truncate">{k.l}</p>
                      {k.hint && <InfoHint text={k.hint} />}
                    </div>
                    <p className="text-lg font-bold text-foreground">{k.v}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução das bolsas por ano de início</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bolsasYearSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" fontSize={11} />
                    <YAxis yAxisId="l" fontSize={10} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                    <ReTooltip formatter={(v: number, n: string) => (n === "Investimento" ? formatBRL(v) : v)} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="bolsas" name="Nº de bolsas" fill="hsl(215, 65%, 30%)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="r" dataKey="valor" name="Investimento" fill="hsl(270, 50%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {modalidadeStats.map((m) => (
                <Card key={m.key} className="shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{m.count}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.count > 0 ? `${formatBRL(m.mensalTotal)}/mês` : "Nenhum bolsista"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(["mestrado", "doutorado"] as const).map((mod, idx) => {
              const map = new Map<string, number>();
              bolsistasAtivos.filter((b) => b.modalidade === mod).forEach((b) => {
                const key = (b.ppg_nome || "SEM PPG").toUpperCase();
                map.set(key, (map.get(key) || 0) + 1);
              });
              const data = Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
              const max = Math.max(...data.map((d) => d.value), 1);
              return (
                <Card key={mod} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Bolsas {MODALIDADE_LABELS[mod]} por PPG
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.map((item) => (
                      <BarRow key={item.name} label={item.name} color={COLORS[idx === 0 ? 0 : 4]}
                        ratio={pct(item.value, max)} valueLabel={String(item.value)} />
                    ))}
                    {data.length === 0 && <p className="text-xs text-muted-foreground">Nenhum bolsista ativo no período.</p>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ═══ PPGs ═══ */}
          <TabsContent value="ppgs" className="space-y-6 mt-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Captação por Programa de Pós-Graduação</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PPG</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Participação</TableHead>
                        <TableHead className="text-right">Projetos</TableHead>
                        <TableHead className="text-right">Pesquisadores</TableHead>
                        <TableHead className="text-right">Bolsas</TableHead>
                        <TableHead className="text-right">R$/pesquisador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ppgTable.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{formatBRL(row.value)}</TableCell>
                          <TableCell className="text-right">{row.share.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{row.projetos}</TableCell>
                          <TableCell className="text-right">{row.pesquisadores}</TableCell>
                          <TableCell className="text-right">{row.bolsistas}</TableCell>
                          <TableCell className="text-right">{formatBRL(row.porPesquisador)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {ppgsSemCaptacao.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">PPGs sem nova captação em {selectedYear}</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {ppgsSemCaptacao.map((v) => <Badge key={v} variant="secondary">{v}</Badge>)}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ PESQUISADORES ═══ */}
          <TabsContent value="pesquisadores" className="space-y-6 mt-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Ranking de Pesquisadores</CardTitle>
                <div className="flex gap-1">
                  {([["captacao", "Captação"], ["projetos", "Nº projetos"], ["bolsistas", "Bolsistas"]] as const).map(([k, l]) => (
                    <Button key={k} size="sm" variant={researcherMetric === k ? "default" : "outline"} onClick={() => setResearcherMetric(k)}>{l}</Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Pesquisador</TableHead>
                        <TableHead className="text-right">Projetos</TableHead>
                        <TableHead className="text-right">Bolsistas</TableHead>
                        <TableHead className="text-right">Valor captado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {researcherTable.slice(0, 25).map((row, i) => (
                        <TableRow key={row.name}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{row.projetos}</TableCell>
                          <TableCell className="text-right">{row.bolsistas}</TableCell>
                          <TableCell className="text-right">{formatBRL(row.captacao)}</TableCell>
                        </TableRow>
                      ))}
                      {researcherTable.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados no período.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <FomentoMetasDialog
          open={metasOpen}
          onOpenChange={setMetasOpen}
          ano={selectedYear ?? currentYear}
          current={meta}
        />
      </div>
    </TooltipProvider>
  );
};

export default FomentoDashboardView;
