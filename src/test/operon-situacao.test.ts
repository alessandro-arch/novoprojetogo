import { describe, expect, it } from "vitest";
import { situacaoEdital, editaisOcultos, FILTROS_PADRAO, type EditalRow } from "@/pages/editais/CuradoriaPage";

const agora = new Date("2026-10-22T12:00:00Z").getTime();
const r = (abertura: string | null, prazo_fim: string | null, resultado_em: string | null = null) =>
  ({ id: String(Math.random()), ordem: 1, abertura, prazo_fim, resultado_em }) as any;
const ed = (situacao: string | null, rodadas: any[], extra: Partial<EditalRow> = {}) =>
  ({ id: String(Math.random()), situacao, status_curadoria: "rascunho", oe_rodada: rodadas, abrangencia: null, fonte_id: "f", ano: 2026, ...extra }) as EditalRow;

describe("situação derivada das rodadas", () => {
  it("aberto com prazo futuro mesmo gravado em_julgamento", () => {
    expect(situacaoEdital(ed("em_julgamento", [r("2026-09-01T00:00:00Z", "2027-02-15T00:00:00Z")]), agora)).toBe("aberto");
  });
  it("aberto com abertura futura", () => {
    expect(situacaoEdital(ed("encerrado", [r("2026-12-01T00:00:00Z", null)]), agora)).toBe("aberto");
  });
  it("em julgamento com prazo passado sem resultado", () => {
    expect(situacaoEdital(ed("aberto", [r(null, "2026-09-01T00:00:00Z")]), agora)).toBe("em_julgamento");
  });
  it("em julgamento com resultado futuro", () => {
    expect(situacaoEdital(ed("aberto", [r(null, "2026-09-01T00:00:00Z", "2026-12-01T00:00:00Z")]), agora)).toBe("em_julgamento");
  });
  it("encerrado quando todos os resultados passaram", () => {
    expect(situacaoEdital(ed("aberto", [r(null, "2026-05-01T00:00:00Z", "2026-08-01T00:00:00Z")]), agora)).toBe("encerrado");
  });
  it("sem datas usa a situação gravada", () => {
    expect(situacaoEdital(ed("em_julgamento", []), agora)).toBe("em_julgamento");
    expect(situacaoEdital(ed("aberto", [r(null, null)]), agora)).toBe("aberto");
  });
});

describe("aviso de ocultos pelos filtros", () => {
  const rows = [
    ed("aberto", [r(null, "2027-01-01T00:00:00Z")]),
    ed("em_julgamento", [], { status_curadoria: "descartado" }),
    ed("aberto", [r(null, "2026-01-01T00:00:00Z")], { fonte_id: "g" }),
  ];
  it("padrão Todos não oculta nada", () => {
    expect(editaisOcultos(rows, FILTROS_PADRAO, "__none__", agora)).toBe(0);
  });
  it("conta itens escondidos por vigência e fonte", () => {
    expect(editaisOcultos(rows, { ...FILTROS_PADRAO, vigencia: "vigentes" }, "__none__", agora)).toBe(2);
    expect(editaisOcultos(rows, { ...FILTROS_PADRAO, fonte: "f" }, "__none__", agora)).toBe(1);
    expect(editaisOcultos(rows, { ...FILTROS_PADRAO, fonte: "f" }, "descartado", agora)).toBe(0);
  });
});
