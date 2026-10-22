import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { carregarFontesCuradoria, carregarFontesOperon, correspondeFonte, fontesLiberadas, varianteFonte, type FonteOperon } from "@/lib/operon-fontes";
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
  it("curador sem organização consulta todas as fontes ativas na curadoria", async () => {
    const rpc = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: true, error: null } as any);
    const ativas = vi.fn(() => ({ order: async () => ({ data: fontes, error: null }) }));
    const from = vi.spyOn(supabase, "from").mockImplementation((() => ({ select: () => ({ eq: ativas }) })) as any);
    expect(await carregarFontesCuradoria()).toEqual(fontes);
    expect(rpc).toHaveBeenCalledWith("oe_is_curador");
    expect(ativas).toHaveBeenCalledWith("ativa", true);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("oe_fonte");
  });
  it("usuário comum na curadoria continua limitado às fontes da organização", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: false, error: null } as any);
    const inIds = vi.fn(() => ({ order: async () => ({ data: [fontes[0], fontes[2]], error: null }) }));
    vi.spyOn(supabase, "from").mockImplementation(((table: string) => table === "oe_org_config"
      ? { select: () => ({ eq: async () => ({ data: [{ fontes: ["es", "ca"] }], error: null }) }) }
      : { select: () => ({ in: inIds }) }) as any);
    expect((await carregarFontesCuradoria()).map(f => f.id)).toEqual(["es", "ca"]);
    expect(inIds).toHaveBeenCalledWith("id", ["es", "ca"]);
  });
  it("painel continua institucional mesmo para um curador", async () => {
    const rpc = vi.spyOn(supabase, "rpc");
    vi.spyOn(supabase, "from").mockImplementation((() => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) })) as any);
    expect(await carregarFontesOperon()).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("falha ao verificar curador não amplia acesso às fontes", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: { message: "Sem permissão" } } as any);
    const from = vi.spyOn(supabase, "from");
    await expect(carregarFontesCuradoria()).rejects.toMatchObject({ message: "Sem permissão" });
    expect(from).not.toHaveBeenCalled();
  });
  it("esfera é da fonte, independentemente da abrangência", () => {
    expect(correspondeFonte(rows[0], { fonte: "__none__", esfera: "estadual" })).toBe(true);
    expect(correspondeFonte(rows[2], { fonte: "__none__", esfera: "estadual" })).toBe(false);
  });
  it("painel e curadoria combinam filtros e contabilizam ocultos", () => {
    const filtros = { ...FILTROS_PADRAO, esfera: "nacional" };
    expect(filtrarCuradoria(rows, filtros).map(e => e.id)).toEqual(["cn", "ca", "se"]);
    expect(editaisOcultos(rows, filtros, "__none__")).toBe(2);
    const painel = filtrarPainel(rows as EditalPublicado[], { ...filtros, busca: "" });
    expect(painel.abertos.map(e => e.id)).toEqual(["cn", "ca", "se"]);
    expect(filtrarCuradoria(rows, { ...filtros, fonte: "se" }).map(e => e.id)).toEqual(["se"]);
  });
});