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
      const v = numeroValor(e.valor_total_reais);
      if (v === null) continue;
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

export interface EntradaValor { valor: string; tipo: TipoValor | "__none__"; observacao: string }
export const entradaDoEdital = (e: CamposValor): EntradaValor => {
  const n = numeroValor(e.valor_total_reais);
  return { valor: n === null ? "" : String(n).replace(".", ","), tipo: tipoValido(e.valor_tipo) ?? "__none__", observacao: e.valor_observacao ?? "" };
};
/** Aceita "1.234.567,89", "1234567.89" ou "1234567". */
export function lerReais(texto: string): number | null {
  const t = texto.replace(/[R$\s]/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return NaN;
  return Number(normal);
}
export function validarValor(v: EntradaValor): string | null {
  if (v.observacao.length > 2000) return "A observação pode ter até 2.000 caracteres.";
  const n = lerReais(v.valor);
  if (Number.isNaN(n)) return "Informe o valor em reais, por exemplo 1.500.000,00.";
  if (v.tipo === "total" || v.tipo === "estimado") return n === null || n <= 0 ? "Informe um valor maior que zero para Total ou Estimado." : null;
  if (v.tipo === "nao_informado" || v.tipo === "__none__") return n !== null ? "Para Sem valor, deixe o campo de valor vazio." : null;
  if (n !== null && n <= 0) return "O valor por agência deve ser maior que zero.";
  return null;
}
/** O portal exige justificativa individual; observações genéricas não são evidência. */
export function validarConfirmacaoValor(v: EntradaValor): string | null {
  const erro = validarValor(v);
  if (erro) return erro;
  if (v.tipo === "__none__" || v.tipo === "nao_informado") return "Valor não informado deve permanecer sem confirmação.";
  const obs = v.observacao.trim();
  const normal = obs.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.!]+$/g, "").trim();
  const genericas = ["valor localizado no texto oficial do edital", "edital nao informa valor em reais", "chamada sem aporte de recursos", "valor confirmado", "conferido no edital"];
  if (obs.length < 20 || genericas.includes(normal)) return "Informe uma observação específica deste edital, com item ou página do PDF e o trecho que sustenta o valor.";
  return null;
}
/** Somente os cinco campos de valor. Editar sem confirmar limpa a confirmação anterior. */
export function montarPayloadValor(v: EntradaValor, opcoes: { confirmar: boolean; userId: string; agora?: string }) {
  const erro = opcoes.confirmar ? validarConfirmacaoValor(v) : validarValor(v);
  if (erro) throw new Error(erro);
  const n = lerReais(v.valor);
  const confirma = opcoes.confirmar;
  return {
    valor_total_reais: n === null || Number.isNaN(n) ? null : n,
    valor_tipo: v.tipo === "__none__" ? null : v.tipo,
    valor_observacao: v.observacao.trim() || null,
    valor_confirmado_em: confirma ? opcoes.agora ?? new Date().toISOString() : null,
    valor_confirmado_por: confirma ? opcoes.userId : null,
  };
}

/** Publicação individual só confirma com justificativa específica; ausência nunca é confirmada. */
export function confirmacaoAoPublicar(v: EntradaValor | null, userId: string | undefined, agora: string) {
  if (!v || !userId || validarConfirmacaoValor(v)) return {};
  return montarPayloadValor(v, { confirmar: true, userId, agora });
}
