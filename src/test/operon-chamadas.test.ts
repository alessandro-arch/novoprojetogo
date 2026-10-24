import { describe, it, expect, beforeEach } from "vitest";
import type { EditalPublicado } from "@/lib/operon-portal";
import { FILTROS_VAZIOS, aplicarFiltrosExtras, chipsAtivos, filtrosDaUrl, gerarCsv, lerFiltrosSalvos, ordenarChamadas, removerChip, salvarFiltros, chaveFiltros } from "@/lib/operon-chamadas";
import { calcularIndicadores, abertosPorFonte, abertosPorEsfera, lancamentosPorMes, prazosProximos } from "@/lib/operon-indicadores";
import { itensCuradoria } from "@/components/operon/OperonSidebar";

const AGORA = new Date("2026-06-15T12:00:00Z").getTime();
const DIA = 86_400_000;
const iso = (dias: number) => new Date(AGORA + dias * DIA).toISOString();
const ed = (id: string, o: Partial<EditalPublicado> & { prazo?: number | null; resultado?: number | null; fonte?: "cnpq" | "fapes" } = {}): EditalPublicado => ({
  id, fonte_id: o.fonte ?? "cnpq", numero: "1", ano: 2026, titulo: o.titulo ?? `Edital ${id}`, categoria: null, situacao: o.situacao ?? "aberto",
  status_curadoria: o.status_curadoria ?? "publicado", url_oficial: "https://gov.br/x", visto_ultima_vez_em: null, objetivo: null, recursos: null,
  quem_pode: null, contrapartida: null, areas: null, requisitos_ies: null, restricao_ies: o.restricao_ies ?? null, abrangencia: null, tipo: null,
  verificado_em: o.verificado_em ?? null, publicado_em: o.publicado_em ?? null,
  oe_fonte: { slug: o.fonte ?? "cnpq", nome: o.fonte === "fapes" ? "FAPES" : "CNPq", esfera: o.fonte === "fapes" ? "estadual" : "nacional", uf: null },
  oe_rodada: o.prazo === undefined || o.prazo === null ? [] : [{ ordem: 1, abertura: iso(-20), prazo_fim: iso(o.prazo), resultado_em: o.resultado == null ? null : iso(o.resultado) }],
} as EditalPublicado);

const rows = [
  ed("a", { prazo: 3, verificado_em: iso(-5), fonte: "fapes" }),
  ed("b", { prazo: 20, verificado_em: iso(-40) }),
  ed("c", { prazo: -10, resultado: 10, verificado_em: iso(-60) }),            // em julgamento
  ed("d", { prazo: -40, resultado: -5, situacao: "encerrado" }),               // encerrado
  ed("e", { prazo: 6, status_curadoria: "rascunho", verificado_em: iso(-1) }), // não publicado
  ed("f", { prazo: 50, publicado_em: iso(-2) }),
];

describe("filtros das chamadas", () => {
  it("encerram em 7 dias inclui só prazos entre hoje e 7 dias", () => {
    expect(aplicarFiltrosExtras(rows, { prazo: "7d", publicados: "" }, AGORA).map(e => e.id)).toEqual(["a", "e"]);
  });
  it("lançados em 30 dias usa a conferência e, sem ela, a data da agência", () => {
    expect(aplicarFiltrosExtras(rows, { prazo: "", publicados: "30d" }, AGORA).map(e => e.id)).toEqual(["a", "e", "f"]);
  });
  it("lê o aprofundamento pela URL", () => {
    expect(filtrosDaUrl(new URLSearchParams("aba=em_julgamento&prazo=7d"))).toEqual({ filtros: { prazo: "7d" }, aba: "em_julgamento" });
    expect(filtrosDaUrl(new URLSearchParams("aba=invalida"))).toBeNull();
  });
  it("gera chips e remove um por vez", () => {
    const f = { ...FILTROS_VAZIOS, busca: "bolsa", esfera: "nacional", prazo: "7d" as const };
    expect(chipsAtivos(f, () => undefined).map(c => c.chave)).toEqual(["busca", "esfera", "prazo"]);
    expect(removerChip(f, "esfera").esfera).toBe("__none__");
  });
});

describe("filtros salvos", () => {
  beforeEach(() => localStorage.clear());
  it("salva por usuário e restaura", () => {
    salvarFiltros("u1", { ...FILTROS_VAZIOS, busca: "x" }, { coluna: "fonte", direcao: "desc" });
    expect(lerFiltrosSalvos("u1")?.filtros.busca).toBe("x");
    expect(lerFiltrosSalvos("u1")?.ordem).toEqual({ coluna: "fonte", direcao: "desc" });
    expect(lerFiltrosSalvos("u2")).toBeNull();
  });
  it("ignora conteúdo corrompido sem falhar", () => {
    localStorage.setItem(chaveFiltros("u1"), "{quebrado");
    expect(lerFiltrosSalvos("u1")).toBeNull();
  });
});

describe("ordenação", () => {
  const abertos = rows.filter(e => ["a", "b", "f", "c"].includes(e.id));
  it("prazo crescente com vazios por último", () => {
    expect(ordenarChamadas(abertos, { coluna: "prazo", direcao: "asc" }, AGORA).map(e => e.id)).toEqual(["a", "b", "f", "c"]);
  });
  it("prazo decrescente mantém vazios por último", () => {
    expect(ordenarChamadas(abertos, { coluna: "prazo", direcao: "desc" }, AGORA).map(e => e.id)).toEqual(["f", "b", "a", "c"]);
  });
  it("publicação mais recente primeiro", () => {
    expect(ordenarChamadas(abertos, { coluna: "publicacao", direcao: "desc" }, AGORA).map(e => e.id)).toEqual(["f", "a", "b", "c"]);
  });
  it("fonte em ordem alfabética", () => {
    expect(ordenarChamadas(abertos, { coluna: "fonte", direcao: "asc" }, AGORA)[0].oe_fonte?.nome).toBe("CNPq");
    expect(ordenarChamadas(abertos, { coluna: "fonte", direcao: "desc" }, AGORA)[0].oe_fonte?.nome).toBe("FAPES");
  });
});

describe("indicadores da visão geral", () => {
  it("conta somente editais publicados", () => {
    expect(calcularIndicadores(rows, AGORA)).toEqual({ abertos: 3, encerram7: 1, lancados30: 2, emJulgamento: 1 });
  });
  it("abertos por fonte e por esfera", () => {
    expect(abertosPorFonte(rows, AGORA).map(f => [f.slug, f.total])).toEqual([["cnpq", 2], ["fapes", 1]]);
    expect(abertosPorEsfera(rows, AGORA).map(e => [e.esfera, e.total])).toEqual([["nacional", 2], ["estadual", 1]]);
  });
  it("lançamentos por mês somam por fonte", () => {
    const { dados } = lancamentosPorMes(rows, AGORA);
    const total = dados.reduce((s, d) => s + Number(d.total), 0);
    expect(total).toBe(5); // a, b, c e f publicados com data; e é rascunho, d sem data
    expect(dados).toHaveLength(12);
  });
  it("próximos prazos em 60 dias, do mais próximo", () => {
    expect(prazosProximos(rows, AGORA).map(p => p.edital.id)).toEqual(["a", "b", "f"]);
  });
});

describe("CSV", () => {
  it("usa ponto e vírgula, BOM e escapa aspas", () => {
    const csv = gerarCsv([ed("x", { titulo: 'Chamada "A"; fase 1', prazo: 3, restricao_ies: "somente_publicas" })], AGORA);
    expect(csv.startsWith("\uFEFFTítulo;")).toBe(true);
    expect(csv).toContain('"Chamada ""A""; fase 1"');
    expect(csv).toContain(";Sim;");
  });
});

describe("menu administrativo", () => {
  it("Curadoria e Saúde das coletas só para icca_admin efetivo", () => {
    expect(itensCuradoria("icca_admin").map(i => i.titulo)).toEqual(["Curadoria", "Saúde das coletas"]);
    expect(itensCuradoria("org_admin")).toEqual([]);
    expect(itensCuradoria(null)).toEqual([]);
  });
});
