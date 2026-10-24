import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn(); const eq = vi.fn(); const getUser = vi.fn(); let sim = false;
vi.mock("@/lib/view-as", async (orig) => ({ ...(await orig<object>()), simulando: () => sim }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: () => getUser() }, from: () => ({ update: (p: unknown) => { update(p); return { eq: (...a: unknown[]) => { eq(...a); return Promise.resolve({ error: null }); } }; } }) } }));

import { salvarValorEdital } from "@/components/operon/ValorCuradoria";
import { lerReais, validarValor, montarPayloadValor } from "@/lib/operon-valores";

beforeEach(() => { sim = false; update.mockReset(); eq.mockReset(); getUser.mockReset(); getUser.mockResolvedValue({ data: { user: { id: "u-sessao" } }, error: null }); });

describe("valor na curadoria", () => {
  it("lê reais em formato brasileiro", () => { expect(lerReais("1.500.000,50")).toBe(1500000.5); expect(lerReais("abc")).toBeNaN(); expect(lerReais("")).toBeNull(); });
  it("valida por tipo", () => {
    expect(validarValor({ valor: "", tipo: "total", observacao: "" })).toMatch(/maior que zero/);
    expect(validarValor({ valor: "10", tipo: "nao_informado", observacao: "" })).toMatch(/vazio/);
    expect(validarValor({ valor: "", tipo: "por_agencia", observacao: "" })).toBeNull();
    expect(validarValor({ valor: "100,00", tipo: "estimado", observacao: "" })).toBeNull();
  });
  it("salvar sem confirmar limpa a confirmação", () => {
    expect(montarPayloadValor({ valor: "10", tipo: "total", observacao: " " }, { confirmar: false, userId: "u" }))
      .toEqual({ valor_total_reais: 10, valor_tipo: "total", valor_observacao: null, valor_confirmado_em: null, valor_confirmado_por: null });
  });
  it("confirmar envia só os cinco campos com o id da sessão", async () => {
    await salvarValorEdital("ed1", { valor: "2.000,00", tipo: "total", observacao: "Item 5.2, página 4: orçamento total de R$ 2.000,00." }, true);
    const p = update.mock.calls[0][0];
    expect(Object.keys(p).sort()).toEqual(["valor_confirmado_em", "valor_confirmado_por", "valor_observacao", "valor_tipo", "valor_total_reais"]);
    expect(p.valor_confirmado_por).toBe("u-sessao");
    expect(p.valor_total_reais).toBe(2000);
    expect(eq).toHaveBeenCalledWith("id", "ed1");
  });
  it("bloqueia no Ver como", async () => {
    sim = true;
    await expect(salvarValorEdital("ed1", { valor: "1", tipo: "total", observacao: "" }, true)).rejects.toThrow(/Modo visualização/);
    expect(update).not.toHaveBeenCalled();
  });
  it("não grava valor inválido", async () => {
    await expect(salvarValorEdital("ed1", { valor: "", tipo: "total", observacao: "" }, true)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});

import { confirmacaoAoPublicar } from "@/lib/operon-valores";
describe("confirmação ao publicar", () => {
  it("confirma valor válido com tipo", () => {
    expect(confirmacaoAoPublicar({ valor: "100", tipo: "total", observacao: "Item 5, página 2: orçamento de R$ 100,00." }, "u", "T")).toMatchObject({ valor_total_reais: 100, valor_confirmado_em: "T", valor_confirmado_por: "u" });
  });
  it("não mexe quando não há tipo ou valor é inválido", () => {
    expect(confirmacaoAoPublicar({ valor: "", tipo: "__none__", observacao: "" }, "u", "T")).toEqual({});
    expect(confirmacaoAoPublicar({ valor: "", tipo: "total", observacao: "" }, "u", "T")).toEqual({});
  });
  it("publicar não confirma sem justificativa individual", () => {
    expect(confirmacaoAoPublicar({ valor: "100", tipo: "total", observacao: "Valor localizado no texto oficial do edital." }, "u", "T")).toEqual({});
  });
  it("publicar não confirma valor não informado", () => {
    expect(confirmacaoAoPublicar({ valor: "", tipo: "nao_informado", observacao: "Item 5: não informa orçamento em reais." }, "u", "T")).toEqual({});
  });
});

describe("proteção dos valores oficiais", () => {
  it("rejeita zero sem enviar atualização", async () => {
    await expect(salvarValorEdital("ed1", { valor: "0", tipo: "total", observacao: "Item 5: não informa valor em reais." }, false)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it("ausência é null, nao_informado e sem confirmação", () => {
    expect(montarPayloadValor({ valor: "", tipo: "nao_informado", observacao: "Não informa valor em reais." }, { confirmar: false, userId: "u" })).toMatchObject({ valor_total_reais: null, valor_tipo: "nao_informado", valor_confirmado_em: null, valor_confirmado_por: null });
  });
  it("não confirma ausência por chamada direta", async () => {
    await expect(salvarValorEdital("ed1", { valor: "", tipo: "nao_informado", observacao: "Item 5: não informa orçamento em reais." }, true)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it("rejeita observação genérica antes de acessar sessão", async () => {
    await expect(salvarValorEdital("ed1", { valor: "100", tipo: "total", observacao: "Valor localizado no texto oficial do edital." }, true)).rejects.toThrow(/específica/);
    expect(getUser).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it("mantém dólar só na observação sem conversão ou confirmação", () => {
    expect(montarPayloadValor({ valor: "", tipo: "por_agencia", observacao: "FAPES/SEGER 14/2026: US$ 5.000, conforme item 5." }, { confirmar: false, userId: "u" })).toMatchObject({ valor_total_reais: null, valor_tipo: "por_agencia", valor_observacao: "FAPES/SEGER 14/2026: US$ 5.000, conforme item 5.", valor_confirmado_em: null, valor_confirmado_por: null });
  });
});

import { aplicarSugestaoValor } from "@/components/operon/ValorCuradoria";
describe("sugestão de valor da IA", () => {
  const s = (valor: string) => ({ valor, trecho_origem: "x", atual_vazio: true, atual_cortado: false });
  it("preenche valor em reais e tipo, sem confirmar", () => {
    expect(aplicarSugestaoValor({ valor: "", tipo: "__none__", observacao: "" }, s("1500000.00"), s("total"))).toEqual({ valor: "1.500.000,00", tipo: "total", observacao: "" });
  });
  it("nao_informado limpa o valor", () => {
    expect(aplicarSugestaoValor({ valor: "10", tipo: "total", observacao: "" }, undefined, s("nao_informado")).valor).toBe("");
  });
  it("não aceita sugestão de zero", () => {
    expect(aplicarSugestaoValor({ valor: "", tipo: "__none__", observacao: "" }, s("0"), s("total")).valor).toBe("");
  });
});
