import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { carregarFontesOperon, correspondeFonte, fontesLiberadas, mostrarFiltroUf, ufsDisponiveis, varianteFonte, type FonteOperon } from "@/lib/operon-fontes";
import { editaisOcultos, FILTROS_PADRAO, filtrarCuradoria, type EditalRow } from "@/pages/editais/CuradoriaPage";
import { filtrarPainel, type EditalPublicado } from "@/lib/operon-portal";

const fontes: FonteOperon[] = [
  { id: "es", slug: "fapes", nome: "FAPES", esfera: "estadual", uf: "ES" },
  { id: "cn", slug: "cnpq", nome: "CNPq", esfera: "nacional", uf: null },
  { id: "ca", slug: "capes", nome: "CAPES", esfera: "nacional", uf: null },
  { id: "rj", slug: "faperj", nome: "FAPERJ", esfera: "estadual", uf: "RJ" },
  { id: "se", slug: "serrapilheira", nome: "Instituto Serrapilheira", esfera: "nacional", uf: null },
];
const rows: EditalRow[] = fontes.map(f => ({
  id: f.id, fonte_id: f.id, oe_fonte: f, status_curadoria: "publicado", situacao: "aberto", oe_rodada: [], abrangencia: "internacional",
  numero: null, ano: null, titulo: f.nome, categoria: null, url_oficial: null, visto_ultima_vez_em: null,
  objetivo: null, recursos: null, quem_pode: null, contrapartida: null, areas: null, requisitos_ies: null, restricao_ies: null,
}));
beforeEach(() => vi.restoreAllMocks());
describe("Fontes institucionais dinâmicas", () => {
  it("fonte desconhecida ou ausente usa variante neutra", () => {
    expect(varianteFonte("faperj")).toBe("fonteNeutra");
    expect(varianteFonte("toString")).toBe("fonteNeutra");
    expect(varianteFonte(null)).toBe("fonteNeutra");
    expect(varianteFonte("CAPES")).toBe("fonteCapes");
  });
  it("novas fontes liberadas entram sem lista fixa", () => {
    expect(fontesLiberadas(fontes, [{ fontes: ["ca", "rj", "se"] }]).map(f => f.id)).toEqual(["ca", "rj", "se"]);
    expect(fontesLiberadas(fontes, [])).toEqual([]);
  });
  it("consulta apenas IDs liberados pelas configurações ativas visíveis", async () => {
    const inIds = vi.fn(() => ({ order: async () => ({ data: [fontes[2], fontes[3]], error: null }) }));
    const active = vi.fn(async () => ({ data: [{ fontes: ["ca", "rj"] }], error: null }));
    vi.spyOn(supabase, "from").mockImplementation(((table: string) => table === "oe_org_config"
      ? { select: () => ({ eq: active }) } : { select: () => ({ in: inIds }) }) as any);
    expect((await carregarFontesOperon()).map(f => f.slug)).toEqual(["capes", "faperj"]);
    expect(active).toHaveBeenCalledWith("ativa", true);
    expect(inIds).toHaveBeenCalledWith("id", ["ca", "rj"]);
  });
  it("uma só UF estadual oculta o filtro; duas tornam-no disponível", () => {
    expect(mostrarFiltroUf(fontes.slice(0, 3))).toBe(false);
    expect(ufsDisponiveis(fontes.slice(0, 3))).toEqual(["ES"]);
    expect(mostrarFiltroUf(fontes)).toBe(true);
    expect(ufsDisponiveis(fontes)).toEqual(["ES", "RJ"]);
  });
  it("esfera e UF são da fonte, independentemente da abrangência", () => {
    expect(correspondeFonte(rows[0], { fonte: "__none__", esfera: "estadual", uf: "ES" })).toBe(true);
    expect(correspondeFonte(rows[2], { fonte: "__none__", esfera: "estadual" })).toBe(false);
    expect(correspondeFonte(rows[3], { fonte: "__none__", uf: "ES" })).toBe(false);
  });
  it("painel e curadoria combinam filtros e contabilizam ocultos", () => {
    const filtros = { ...FILTROS_PADRAO, esfera: "nacional" };
    expect(filtrarCuradoria(rows, filtros).map(e => e.id)).toEqual(["cn", "ca", "se"]);
    expect(editaisOcultos(rows, filtros, "__none__")).toBe(2);
    const painel = filtrarPainel(rows as EditalPublicado[], { ...filtros, busca: "" });
    expect(painel.abertos.map(e => e.id)).toEqual(["cn", "ca", "se"]);
    expect(filtrarCuradoria(rows, { ...filtros, fonte: "se" }).map(e => e.id)).toEqual(["se"]);
    expect(filtrarCuradoria(rows, { ...FILTROS_PADRAO, uf: "RJ" }).map(e => e.id)).toEqual(["rj"]);
  });
});