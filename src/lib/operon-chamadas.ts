import { situacaoEdital } from "@/pages/editais/CuradoriaPage";
import { prazoEdital, numeroEdital, temRestricaoIes, type AbaOperon, type EditalPublicado } from "@/lib/operon-portal";
import { situacaoValor, textoValor, rotuloTipoValor, valorConfirmado, numeroValor, ROTULO_SITUACAO_VALOR } from "@/lib/operon-valores";
import { ABRANGENCIAS } from "@/components/operon/AbrangenciaBadge";

const NONE = "__none__";
const DIA = 86_400_000;

export interface FiltrosChamadas { busca: string; fonte: string; esfera: string; abrangencia: string; prazo: "" | "7d"; publicados: "" | "30d" }
export const FILTROS_VAZIOS: FiltrosChamadas = { busca: "", fonte: NONE, esfera: NONE, abrangencia: NONE, prazo: "", publicados: "" };
export type ColunaOrdem = "prazo" | "publicacao" | "fonte" | "valor";
export interface Ordem { coluna: ColunaOrdem; direcao: "asc" | "desc" }
export const ORDEM_PADRAO: Ordem = { coluna: "prazo", direcao: "asc" };

export interface DataPublicacao { data: string | null; aproximada: boolean }
export const DICA_DATA_APROXIMADA = "Data da conferência pela curadoria; a agência não informou a publicação";
/** Data de publicação usada no portal: data da agência; sem ela, a conferência da curadoria (aproximada). */
export const dataPublicacaoInfo = (e: EditalPublicado): DataPublicacao =>
  e.publicado_em ? { data: e.publicado_em, aproximada: false }
    : e.verificado_em ? { data: e.verificado_em, aproximada: true }
      : { data: null, aproximada: false };
export const dataPublicacao = (e: EditalPublicado): string | null => dataPublicacaoInfo(e).data;
const tempo = (v: string | null | undefined) => { const t = v ? new Date(v).getTime() : NaN; return Number.isFinite(t) ? t : null; };

/** Valor confirmado usado em ordenação; não confirmados ficam sem chave. */
export const valorEdital = (e: EditalPublicado): number | null => valorConfirmado(e);

export function aplicarFiltrosExtras(rows: EditalPublicado[], f: Pick<FiltrosChamadas, "prazo" | "publicados">, agora = Date.now()) {
  return rows.filter(e => {
    if (f.prazo === "7d") {
      const p = tempo(prazoEdital(e, agora));
      if (p === null || p < agora || p > agora + 7 * DIA) return false;
    }
    if (f.publicados === "30d") {
      const p = tempo(dataPublicacao(e));
      if (p === null || p < agora - 30 * DIA || p > agora) return false;
    }
    return true;
  });
}

export function ordenarChamadas(rows: EditalPublicado[], ordem: Ordem, agora = Date.now()) {
  const chave = (e: EditalPublicado): number | string | null =>
    ordem.coluna === "prazo" ? tempo(prazoEdital(e, agora))
      : ordem.coluna === "publicacao" ? tempo(dataPublicacao(e))
        : ordem.coluna === "valor" ? valorEdital(e)
        : (e.oe_fonte?.nome ?? e.oe_fonte?.slug ?? null)?.toLocaleLowerCase("pt-BR") ?? null;
  const sinal = ordem.direcao === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ka = chave(a), kb = chave(b);
    if (ka === null && kb === null) return a.titulo.localeCompare(b.titulo, "pt-BR");
    if (ka === null) return 1; // vazios sempre por último
    if (kb === null) return -1;
    const c = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb), "pt-BR");
    return c === 0 ? a.titulo.localeCompare(b.titulo, "pt-BR") : c * sinal;
  });
}

const ABAS: AbaOperon[] = ["abertos", "em_julgamento", "resultados"];
export function filtrosDaUrl(params: URLSearchParams): { filtros: Partial<FiltrosChamadas>; aba?: AbaOperon } | null {
  const out: Partial<FiltrosChamadas> = {};
  if (params.get("prazo") === "7d") out.prazo = "7d";
  if (params.get("publicados") === "30d") out.publicados = "30d";
  const fonte = params.get("fonte"); if (fonte) out.fonte = fonte;
  const esfera = params.get("esfera"); if (esfera === "nacional" || esfera === "estadual") out.esfera = esfera;
  const a = params.get("aba") as AbaOperon | null;
  const aba = a && ABAS.includes(a) ? a : undefined;
  return Object.keys(out).length || aba ? { filtros: out, aba } : null;
}

export interface Chip { chave: keyof FiltrosChamadas; rotulo: string }
export function chipsAtivos(f: FiltrosChamadas, nomeFonte: (id: string) => string | undefined): Chip[] {
  const chips: Chip[] = [];
  if (f.busca.trim()) chips.push({ chave: "busca", rotulo: `Busca: ${f.busca.trim()}` });
  if (f.fonte !== NONE) chips.push({ chave: "fonte", rotulo: `Fonte: ${nomeFonte(f.fonte) ?? "selecionada"}` });
  if (f.esfera !== NONE) chips.push({ chave: "esfera", rotulo: `Esfera: ${f.esfera === "nacional" ? "Nacional" : "Estadual"}` });
  if (f.abrangencia !== NONE) chips.push({ chave: "abrangencia", rotulo: `Abrangência: ${ABRANGENCIAS.find(([v]) => v === f.abrangencia)?.[1] ?? f.abrangencia}` });
  if (f.prazo === "7d") chips.push({ chave: "prazo", rotulo: "Encerram em 7 dias" });
  if (f.publicados === "30d") chips.push({ chave: "publicados", rotulo: "Lançados nos últimos 30 dias" });
  return chips;
}
export const removerChip = (f: FiltrosChamadas, chave: keyof FiltrosChamadas): FiltrosChamadas => ({ ...f, [chave]: FILTROS_VAZIOS[chave] });

export const chaveFiltros = (userId: string) => `operon:chamadas:${userId}`;
export function lerFiltrosSalvos(userId: string | undefined): { filtros: FiltrosChamadas; ordem: Ordem } | null {
  if (!userId) return null;
  try {
    const bruto = window.localStorage.getItem(chaveFiltros(userId));
    if (!bruto) return null;
    const v = JSON.parse(bruto);
    const filtros = { ...FILTROS_VAZIOS };
    (Object.keys(FILTROS_VAZIOS) as (keyof FiltrosChamadas)[]).forEach(k => { if (typeof v?.filtros?.[k] === "string") (filtros as Record<string, string>)[k] = v.filtros[k]; });
    const ordem: Ordem = ["prazo", "publicacao", "fonte", "valor"].includes(v?.ordem?.coluna) && ["asc", "desc"].includes(v?.ordem?.direcao) ? v.ordem : ORDEM_PADRAO;
    return { filtros, ordem };
  } catch { return null; }
}
export function salvarFiltros(userId: string | undefined, filtros: FiltrosChamadas, ordem: Ordem) {
  if (!userId) return;
  try { window.localStorage.setItem(chaveFiltros(userId), JSON.stringify({ filtros, ordem })); } catch { /* armazenamento indisponível */ }
}

const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
const celula = (v: string) => /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
export const ROTULO_SITUACAO: Record<string, string> = { aberto: "Aberto", em_julgamento: "Em julgamento", encerrado: "Encerrado", resultado: "Resultado", revogado: "Revogado" };
export function gerarCsv(rows: EditalPublicado[], agora = Date.now()): string {
  const cab = ["Título", "Número", "Fonte", "Situação", "Prazo", "Publicação", "Restrição para IES", "Valor (R$)", "Tipo de valor", "Situação do valor", "Observação do valor", "Link oficial"];
  const linhas = rows.map(e => [
    e.titulo, numeroEdital(e), e.oe_fonte?.nome ?? "", ROTULO_SITUACAO[situacaoEdital(e, agora) ?? ""] ?? "",
    fmt(prazoEdital(e, agora)), fmt(dataPublicacao(e)) + (dataPublicacaoInfo(e).aproximada ? " (data aproximada)" : ""), temRestricaoIes(e) ? "Sim" : "Não",
    numeroValor(e.valor_total_reais)?.toFixed(2).replace(".", ",") ?? "", situacaoValor(e) === "sem_valor" ? "Sem valor" : rotuloTipoValor(e),
    ROTULO_SITUACAO_VALOR[situacaoValor(e)], e.valor_observacao ?? "", e.url_oficial ?? "",
  ].map(v => celula(String(v))).join(";"));
  return "\uFEFF" + [cab.join(";"), ...linhas].join("\r\n");
}
export function baixarCsv(rows: EditalPublicado[]) {
  const blob = new Blob([gerarCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `chamadas-operon-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
