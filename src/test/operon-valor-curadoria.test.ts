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
    await salvarValorEdital("ed1", { valor: "2.000,00", tipo: "total", observacao: "Chamada" }, true);
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
