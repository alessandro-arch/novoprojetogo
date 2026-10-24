import { describe, it, expect } from "vitest";
import { situacaoValor, resumoValores, valoresPorMes, valoresPorAgencia, textoValor, numeroValor } from "@/lib/operon-valores";
import { gerarCsv, ordenarChamadas } from "@/lib/operon-chamadas";
import type { EditalPublicado } from "@/lib/operon-portal";

const base = (id: string, extra: Partial<EditalPublicado> = {}): EditalPublicado => ({
  id, fonte_id: "f", numero: "1", ano: 2026, titulo: `Edital ${id}`, categoria: null, situacao: "aberto", status_curadoria: "publicado",
  url_oficial: null, visto_ultima_vez_em: null, objetivo: null, recursos: null, quem_pode: null, contrapartida: null, areas: null,
  requisitos_ies: null, restricao_ies: null, verificado_em: null, tipo: null, oe_fonte: { slug: "cnpq", nome: "CNPq" }, oe_rodada: [], ...extra,
} as EditalPublicado);

const conf = "2026-10-20T12:00:00Z";
const total = base("t", { valor_total_reais: "1000000", valor_tipo: "total", valor_confirmado_em: conf, publicado_em: "2026-09-10T12:00:00Z" });
const estimado = base("e", { valor_total_reais: 500000, valor_tipo: "estimado", valor_confirmado_em: conf, verificado_em: "2026-10-05T12:00:00Z", oe_fonte: { slug: "fapes", nome: "FAPES" } });
const pendente = base("p", { valor_total_reais: 900000, valor_tipo: "total" });
const agencia = base("a", { valor_total_reais: 50000, valor_tipo: "por_agencia", valor_confirmado_em: conf });
const vazio = base("v");
const naoInf = base("n", { valor_tipo: "nao_informado" });

describe("situação do valor", () => {
  it("classifica os quatro estados", () => {
    expect(situacaoValor(total)).toBe("confirmado");
    expect(situacaoValor(estimado)).toBe("confirmado");
    expect(situacaoValor(pendente)).toBe("nao_confirmado");
    expect(situacaoValor(agencia)).toBe("por_agencia");
    expect(situacaoValor(vazio)).toBe("sem_valor");
    expect(situacaoValor(naoInf)).toBe("sem_valor");
  });
  it("converte numeric em texto", () => { expect(numeroValor("1234.5")).toBe(1234.5); expect(numeroValor("x")).toBeNull(); });
  it("estado vazio mostra Valor não informado", () => expect(textoValor(vazio)).toBe("Valor não informado"));
});

describe("resumo de valores", () => {
  it("soma só confirmados e separa total de estimado", () => {
    const r = resumoValores([total, estimado, pendente, agencia, vazio, naoInf]);
    expect(r.total).toBe(1_500_000);
    expect(r.somaTotal).toBe(1_000_000);
    expect(r.somaEstimado).toBe(500_000);
    expect(r.naoConfirmados.map(e => e.id)).toEqual(["p"]);
    expect(r.porAgencia.map(e => e.id)).toEqual(["a"]);
    expect(r.semValor.map(e => e.id)).toEqual(["v", "n"]);
  });
  it("lista vazia devolve zero", () => {
    const r = resumoValores([]);
    expect(r.total).toBe(0); expect(r.semValor).toHaveLength(0);
  });
  it("agrupa por mês pela data da agência e marca aproximada", () => {
    expect(valoresPorMes([total, estimado, pendente])).toEqual([
      { mes: "2026-09", valor: 1_000_000, editais: 1, aproximados: 0 },
      { mes: "2026-10", valor: 500_000, editais: 1, aproximados: 1 },
    ]);
  });
  it("agrupa por agência sem pendentes", () => {
    expect(valoresPorAgencia([total, estimado, pendente, agencia]).map(a => [a.agencia, a.valor])).toEqual([["CNPq", 1_000_000], ["FAPES", 500_000]]);
  });
});

describe("CSV e ordenação com valor", () => {
  it("inclui colunas de valor", () => {
    const linhas = gerarCsv([total, vazio]).split("\r\n");
    expect(linhas[0]).toContain("Valor (R$);Tipo de valor;Situação do valor;Observação do valor");
    expect(linhas[1]).toContain("1000000,00;Total;Confirmado;");
    expect(linhas[2]).toContain(";Sem valor;Valor não informado;");
  });
  it("ordena por valor confirmado, pendentes por último", () => {
    expect(ordenarChamadas([pendente, estimado, total], { coluna: "valor", direcao: "desc" }).map(e => e.id)).toEqual(["t", "e", "p"]);
  });
});

import { aplicarFiltrosExtras, filtrosDaUrl, chipsAtivos, FILTROS_VAZIOS } from "@/lib/operon-chamadas";
describe("filtro de situação do valor", () => {
  it("filtra por situação", () => {
    expect(aplicarFiltrosExtras([total, pendente, vazio], { prazo: "", publicados: "", valor: "nao_confirmado" }).map(e => e.id)).toEqual(["p"]);
  });
  it("lê da URL e gera chip", () => {
    const f = filtrosDaUrl(new URLSearchParams("valor=sem_valor"))!.filtros;
    expect(f.valor).toBe("sem_valor");
    expect(chipsAtivos({ ...FILTROS_VAZIOS, ...f }, () => undefined).map(c => c.rotulo)).toEqual(["Valor: Valor não informado"]);
    expect(filtrosDaUrl(new URLSearchParams("valor=xyz"))).toBeNull();
  });
});
