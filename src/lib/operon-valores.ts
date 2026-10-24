import { dataPublicacaoInfo } from "@/lib/operon-chamadas";
import type { EditalPublicado } from "@/lib/operon-portal";

export type TipoValor = "total" | "estimado" | "por_agencia" | "nao_informado";
export type SituacaoValor = "confirmado" | "por_agencia" | "nao_confirmado" | "sem_valor";
export interface CamposValor {
  valor_total_reais?: number | string | null; valor_tipo?: string | null; valor_observacao?: string | null;
  valor_confirmado_em?: string | null; valor_confirmado_por?: string | null;
}

export const ROTULO_TIPO_VALOR: Record<TipoValor, string> = { total: "Total", estimado: "Estimado", por_agencia: "Por agência", nao_informado: "Sem valor" };
export const ROTULO_SITUACAO_VALOR: Record<SituacaoValor, string> = { confirmado: "Confirmado", por_agencia: "Por agência", nao_confirmado: "Aguardando confirmação", sem_valor: "Valor não informado" };

/** Converte numeric (texto ou número) em número finito, ou null. */
export function numeroValor(v: CamposValor["valor_total_reais"]): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
const tipoValido = (t: string | null | undefined): TipoValor | null => t && t in ROTULO_TIPO_VALOR ? t as TipoValor : null;

export function situacaoValor(e: CamposValor): SituacaoValor {
  const tipo = tipoValido(e.valor_tipo);
  const valor = numeroValor(e.valor_total_reais);
  if (tipo === "por_agencia") return "por_agencia";
  if (tipo === "nao_informado" || (!tipo && valor === null)) return "sem_valor";
  if ((tipo === "total" || tipo === "estimado") && valor !== null && e.valor_confirmado_em) return "confirmado";
  return "nao_confirmado";
}

/** Valor que pode entrar em somas: apenas total ou estimado confirmados. */
export const valorConfirmado = (e: CamposValor): number | null => situacaoValor(e) === "confirmado" ? numeroValor(e.valor_total_reais) : null;
export const rotuloTipoValor = (e: CamposValor): string => ROTULO_TIPO_VALOR[tipoValido(e.valor_tipo) ?? "nao_informado"];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const fmtReais = (v: number) => BRL.format(v);

/** Texto curto para tabela e CSV. Nunca apresenta valor não confirmado como definitivo. */
export function textoValor(e: CamposValor): string {
  const s = situacaoValor(e);
  const v = numeroValor(e.valor_total_reais);
  if (s === "sem_valor") return "Valor não informado";
  if (s === "por_agencia") return v !== null ? `${fmtReais(v)} por agência` : "Por agência";
  return v !== null ? fmtReais(v) : "Valor não informado";
}

export interface ResumoValores {
  total: number; somaTotal: number; somaEstimado: number; confirmados: EditalPublicado[];
  semValor: EditalPublicado[]; naoConfirmados: EditalPublicado[]; porAgencia: EditalPublicado[];
}
export function resumoValores(lista: EditalPublicado[]): ResumoValores {
  const r: ResumoValores = { total: 0, somaTotal: 0, somaEstimado: 0, confirmados: [], semValor: [], naoConfirmados: [], porAgencia: [] };
  for (const e of lista) {
    const s = situacaoValor(e);
    if (s === "confirmado") {
      const v = numeroValor(e.valor_total_reais)!;
      r.confirmados.push(e); r.total += v;
      if (e.valor_tipo === "estimado") r.somaEstimado += v; else r.somaTotal += v;
    } else if (s === "por_agencia") r.porAgencia.push(e);
    else if (s === "nao_confirmado") r.naoConfirmados.push(e);
    else r.semValor.push(e);
  }
  return r;
}

export function valoresPorAgencia(lista: EditalPublicado[]) {
  const m = new Map<string, { agencia: string; valor: number; editais: number }>();
  for (const e of lista) {
    const v = valorConfirmado(e); if (v === null) continue;
    const ag = e.oe_fonte?.nome ?? e.oe_fonte?.slug ?? "Sem fonte";
    const atual = m.get(ag) ?? { agencia: ag, valor: 0, editais: 0 };
    atual.valor += v; atual.editais += 1; m.set(ag, atual);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor);
}

export function valoresPorMes(lista: EditalPublicado[]) {
  const m = new Map<string, { mes: string; valor: number; editais: number; aproximados: number }>();
  for (const e of lista) {
    const v = valorConfirmado(e); if (v === null) continue;
    const pub = dataPublicacaoInfo(e); if (!pub.data) continue;
    const mes = new Date(pub.data).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
    const atual = m.get(mes) ?? { mes, valor: 0, editais: 0, aproximados: 0 };
    atual.valor += v; atual.editais += 1; if (pub.aproximada) atual.aproximados += 1; m.set(mes, atual);
  }
  return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function valoresPorTipo(lista: EditalPublicado[]) {
  const r = resumoValores(lista);
  return [{ tipo: "Total", valor: r.somaTotal }, { tipo: "Estimado", valor: r.somaEstimado }];
}
