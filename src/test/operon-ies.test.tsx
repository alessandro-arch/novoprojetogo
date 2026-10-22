import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EditalCuradoriaDetail from "@/components/operon/EditalCuradoriaDetail";

const mocks = vi.hoisted(() => ({ update: vi.fn(), extractUpdate: vi.fn(), extractFilter: vi.fn(), toast: vi.fn(), semRodadas: false }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "curador1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/pages/editais/CuradoriaPage", () => ({
  oe: { from: (table: string) => ({
    select: () => ({ eq: () => ({
      in: (campo: string, fields: string[]) => { mocks.extractFilter(campo, fields); return { order: async () => ({ data: [{ id: "ext1", campo: "requisitos_ies", valor: "Valor extraído", status: "pendente" }], error: null }) }; },
      order: async () => ({ data: table === "oe_rodada" && !mocks.semRodadas ? [{ ordem: 1, abertura: null, prazo_fim: "2026-12-31T23:59:59Z" }] : [], error: null }),
    }) }),
    update: (payload: unknown) => ({ eq: async () => { (table === "oe_edital" ? mocks.update : mocks.extractUpdate)(payload); return { error: null }; } }),
  }) },
  fmtData: () => "", rodadaVigente: () => null, situacaoEdital: (e: { situacao: string | null }) => e.situacao, SITUACOES: {}, semNumero: () => false,
  exigeConfirmacaoSemRodadas: (situacao: string, rodadas: unknown[]) => situacao === "aberto" && rodadas.length === 0,
}));

const edital = {
  id: "ed1", fonte_id: "f1", numero: "01", ano: 2026, titulo: "Edital", categoria: null,
  situacao: "aberto", status_curadoria: "rascunho", url_oficial: null, visto_ultima_vez_em: null,
  objetivo: "Finalidade original", recursos: null, quem_pode: null, contrapartida: null, areas: [],
  requisitos_ies: "Requisito original", restricao_ies: "somente_publicas", oe_fonte: { slug: "fapes", nome: "FAPES" },
};
let root: Root | undefined;
const waitFor = async (assertion: () => void) => {
  for (let i = 0; i < 40; i++) {
    try { assertion(); return; } catch { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
  }
  assertion();
};
const click = async (label: string) => {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  await act(async () => button.click());
};
const open = async (abrangencia: string | null = null) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<QueryClientProvider client={qc}><EditalCuradoriaDetail edital={{ ...edital, abrangencia }} /></QueryClientProvider>));
  await waitFor(() => expect(mocks.extractFilter).toHaveBeenCalled());
  // Wait for query data to render, not only for the request to start.
  await waitFor(() => expect([...container.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Usar valor extraído")).toBe(true));
};
beforeEach(() => { vi.clearAllMocks(); mocks.semRodadas = false; });
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; });

describe("Persistência dos requisitos de IES", () => {
  it("salva o TL;DR em revisão, publica e atualiza o resumo publicado sem despublicar", async () => {
    await open();
    const textarea = document.getElementById("resumo-tldr");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!(textarea instanceof HTMLTextAreaElement) || !setter) throw new Error("Missing TL;DR");
    const editar = async (valor: string) => act(async () => { setter.call(textarea, valor); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
    const resumo = "Pesquisa científica.\nPúblico elegível e aporte.";
    await editar(resumo);
    await click("Salvar como em revisão");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ resumo_tldr: resumo, resumo_tldr_atualizado_em: expect.any(String), status_curadoria: "em_revisao" })));
    await click("Aprovar e publicar");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ resumo_tldr: resumo, status_curadoria: "publicado" })));
    await waitFor(() => expect([...document.querySelectorAll("button")].some(b => b.textContent?.trim() === "Publicado ✓")).toBe(true));
    await editar("Novo resumo científico.");
    await click("Salvar alterações publicadas");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ resumo_tldr: "Novo resumo científico.", resumo_tldr_atualizado_em: expect.any(String), status_curadoria: "publicado" })));
    await waitFor(() => expect([...document.querySelectorAll("button")].some(b => b.textContent?.trim() === "Publicado ✓")).toBe(true));
    await editar("");
    await click("Salvar alterações publicadas");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ resumo_tldr: null, status_curadoria: "publicado" })));
  });
  it.each(["estadual", "nacional", "internacional", null])("grava abrangência %s em revisão e publicação", async (abrangencia) => {
    await open(abrangencia);
    await click("Salvar como em revisão");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ abrangencia, status_curadoria: "em_revisao" })));
    await click("Aprovar e publicar");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ abrangencia, status_curadoria: "publicado" })));
  });
  it("não publica aberto sem rodadas até confirmação explícita", async () => {
    mocks.semRodadas = true;
    await open();
    await click("Aprovar e publicar");
    expect(mocks.update).not.toHaveBeenCalled();
    await click("Cancelar");
    expect(mocks.update).not.toHaveBeenCalled();
    await click("Aprovar e publicar");
    await click("Publicar mesmo assim");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status_curadoria: "publicado" })));
  });
  it("inclui requisitos_ies na leitura das extrações", async () => {
    await open();
    expect(mocks.extractFilter).toHaveBeenCalledWith("campo", expect.arrayContaining(["requisitos_ies"]));
  });
  it("salva requisitos e restrição em revisão", async () => {
    await open();
    const input = [...document.querySelectorAll("textarea")].find((e) => e.value === "Requisito original");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!input || !setter) throw new Error("Missing requirements field");
    await act(async () => { setter.call(input, "Novo requisito\nSegunda linha"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await click("Salvar como em revisão");
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status_curadoria: "em_revisao", requisitos_ies: "Novo requisito\nSegunda linha", restricao_ies: "somente_publicas" })));
  });
  it("publica requisitos e marca a extração alterada", async () => {
    await open();
    await click("Aprovar e publicar");
    await waitFor(() => expect(mocks.extractUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "editado", revisado_por: "curador1" })));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ requisitos_ies: "Requisito original", restricao_ies: "somente_publicas", status_curadoria: "publicado" }));
  });
  it("marca a extração aprovada após usar o valor extraído", async () => {
    await open();
    await waitFor(() => expect([...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Usar valor extraído")).toBe(true));
    await click("Usar valor extraído");
    await click("Aprovar e publicar");
    await waitFor(() => expect(mocks.extractUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "aprovado" })));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ requisitos_ies: "Valor extraído" }));
  });
});