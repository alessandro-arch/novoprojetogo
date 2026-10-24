import { situacaoEdital } from "@/pages/editais/CuradoriaPage";
import { prazoEdital, type EditalPublicado } from "@/lib/operon-portal";
import { aplicarFiltrosExtras, dataPublicacao } from "@/lib/operon-chamadas";

const DIA = 86_400_000;
const publicados = (rows: EditalPublicado[]) => rows.filter(e => e.status_curadoria === "publicado");

export interface Indicadores { abertos: number; encerram7: number; lancados30: number; emJulgamento: number }
export function calcularIndicadores(rows: EditalPublicado[], agora = Date.now()): Indicadores {
  const base = publicados(rows);
  return {
    abertos: base.filter(e => situacaoEdital(e, agora) === "aberto").length,
    encerram7: aplicarFiltrosExtras(base, { prazo: "7d", publicados: "" }, agora).length,
    lancados30: aplicarFiltrosExtras(base, { prazo: "", publicados: "30d" }, agora).length,
    emJulgamento: base.filter(e => situacaoEdital(e, agora) === "em_julgamento").length,
  };
}

const mesBrasilia = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }); // AAAA-MM
const rotuloMes = (chave: string) => { const [a, m] = chave.split("-").map(Number); return new Date(a, m - 1, 15).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""); };

export interface SerieFonte { slug: string; nome: string }
/** Lançamentos dos últimos N meses, uma chave por fonte (slug). */
export function lancamentosPorMes(rows: EditalPublicado[], agora = Date.now(), meses = 12) {
  const chaves: string[] = [];
  const ref = new Date(agora);
  for (let i = meses - 1; i >= 0; i--) chaves.push(mesBrasilia(new Date(ref.getFullYear(), ref.getMonth() - i, 15).getTime()));
  const fontes = new Map<string, SerieFonte>();
  const dados = chaves.map(mes => ({ mes, rotulo: rotuloMes(mes), total: 0 } as Record<string, string | number>));
  publicados(rows).forEach(e => {
    const d = dataPublicacao(e); const t = d ? new Date(d).getTime() : NaN;
    if (!Number.isFinite(t)) return;
    const linha = dados.find(x => x.mes === mesBrasilia(t));
    if (!linha) return;
    const slug = (e.oe_fonte?.slug ?? "outra").toLowerCase();
    fontes.set(slug, { slug, nome: e.oe_fonte?.nome ?? "Outra fonte" });
    linha[slug] = Number(linha[slug] ?? 0) + 1;
    linha.total = Number(linha.total) + 1;
  });
  return { dados, fontes: [...fontes.values()] };
}

export function abertosPorFonte(rows: EditalPublicado[], agora = Date.now()) {
  const m = new Map<string, { slug: string; nome: string; total: number }>();
  publicados(rows).filter(e => situacaoEdital(e, agora) === "aberto").forEach(e => {
    const slug = (e.oe_fonte?.slug ?? "outra").toLowerCase();
    const atual = m.get(slug) ?? { slug, nome: e.oe_fonte?.nome ?? "Outra fonte", total: 0 };
    atual.total++; m.set(slug, atual);
  });
  return [...m.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}
export function abertosPorEsfera(rows: EditalPublicado[], agora = Date.now()) {
  const conta = { nacional: 0, estadual: 0, outra: 0 };
  publicados(rows).filter(e => situacaoEdital(e, agora) === "aberto").forEach(e => {
    const s = e.oe_fonte?.esfera; conta[s === "nacional" || s === "estadual" ? s : "outra"]++;
  });
  return [
    { esfera: "nacional", nome: "Nacional", total: conta.nacional },
    { esfera: "estadual", nome: "Estadual", total: conta.estadual },
    ...(conta.outra ? [{ esfera: "outra", nome: "Não informada", total: conta.outra }] : []),
  ];
}

export interface PrazoProximo { edital: EditalPublicado; prazo: string }
export function prazosProximos(rows: EditalPublicado[], agora = Date.now(), dias = 60): PrazoProximo[] {
  return publicados(rows)
    .map(e => ({ edital: e, prazo: prazoEdital(e, agora) }))
    .filter((x): x is PrazoProximo => !!x.prazo && new Date(x.prazo).getTime() >= agora && new Date(x.prazo).getTime() <= agora + dias * DIA)
    .sort((a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime());
}
/** Prazos dos próximos 60 dias agrupados por semana (semana 1 = próximos 7 dias). */
export function prazosPorSemana(rows: EditalPublicado[], agora = Date.now(), dias = 60) {
  const semanas = Math.ceil(dias / 7);
  const dados = Array.from({ length: semanas }, (_, i) => ({
    semana: i + 1,
    rotulo: new Date(agora + i * 7 * DIA).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }),
    total: 0,
  }));
  prazosProximos(rows, agora, dias).forEach(({ prazo }) => {
    const i = Math.min(semanas - 1, Math.floor((new Date(prazo).getTime() - agora) / (7 * DIA)));
    dados[i].total++;
  });
  return dados;
}
