import { describe, expect, it } from "vitest";
import { ehVigente, exigeConfirmacaoSemRodadas, type EditalRow } from "@/pages/editais/CuradoriaPage";

const agora = new Date("2026-10-22T12:00:00Z").getTime();
const edital: EditalRow = {
  id: "edital", fonte_id: "fapes", numero: "01", ano: 2026, titulo: "Chamada",
  categoria: null, situacao: "em_julgamento", status_curadoria: "publicado", url_oficial: null,
  visto_ultima_vez_em: null, objetivo: null, recursos: null, quem_pode: null,
  requisitos_ies: null, restricao_ies: null, contrapartida: null, areas: [], oe_rodada: [],
};

describe("Vigência do Operon", () => {
  it("exclui em julgamento sem rodadas dos vigentes", () => {
    expect(ehVigente(edital, agora)).toBe(false);
  });
  it("inclui aberto sem rodadas", () => {
    expect(ehVigente({ ...edital, situacao: "aberto" }, agora)).toBe(true);
  });
  it("inclui rodada em andamento com abertura nula", () => {
    expect(ehVigente({ ...edital, oe_rodada: [{ ordem: 1, abertura: null, prazo_fim: "2026-10-27T23:59:59Z" }] }, agora)).toBe(true);
  });
  it("inclui rodada futura", () => {
    expect(ehVigente({ ...edital, oe_rodada: [{ ordem: 1, abertura: "2026-11-01T12:00:00Z", prazo_fim: "2026-11-30T12:00:00Z" }] }, agora)).toBe(true);
  });
  it("exclui em julgamento com rodadas vencidas", () => {
    expect(ehVigente({ ...edital, oe_rodada: [{ ordem: 1, abertura: null, prazo_fim: "2026-10-21T12:00:00Z" }] }, agora)).toBe(false);
  });
  it("rodada sem datas não comprova vigência", () => {
    expect(ehVigente({ ...edital, oe_rodada: [{ ordem: 1, abertura: null, prazo_fim: null }] }, agora)).toBe(false);
  });
  it("descartado nunca é vigente", () => {
    expect(ehVigente({ ...edital, situacao: "aberto", status_curadoria: "descartado" }, agora)).toBe(false);
  });
  it("exige confirmação somente para aberto sem nenhuma rodada", () => {
    expect(exigeConfirmacaoSemRodadas("aberto", [])).toBe(true);
    expect(exigeConfirmacaoSemRodadas("em_julgamento", [])).toBe(false);
    expect(exigeConfirmacaoSemRodadas("aberto", [{ ordem: 1, abertura: null, prazo_fim: null }])).toBe(false);
  });
});