import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EditalCuradoriaDetail from "@/components/operon/EditalCuradoriaDetail";

const mocks = vi.hoisted(() => ({ update: vi.fn(), extractUpdate: vi.fn(), extractFilter: vi.fn(), toast: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "curador1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/pages/editais/CuradoriaPage", () => ({
  oe: { from: (table: string) => ({
    select: () => ({ eq: () => ({
      in: (campo: string, fields: string[]) => { mocks.extractFilter(campo, fields); return { order: async () => ({ data: [{ id: "ext1", campo: "requisitos_ies", valor: "Valor extraído", status: "pendente" }], error: null }) }; },
      order: async () => ({ data: [], error: null }),
    }) }),
    update: (payload: unknown) => ({ eq: async () => { (table === "oe_edital" ? mocks.update : mocks.extractUpdate)(payload); return { error: null }; } }),
  }) },
  fmtData: () => "", rodadaVigente: () => null, SITUACOES: {}, semNumero: () => false,
}));

const edital = {
  id: "ed1", fonte_id: "f1", numero: "01", ano: 2026, titulo: "Edital", categoria: null,
  situacao: "aberto", status_curadoria: "rascunho", url_oficial: null, visto_ultima_vez_em: null,
  objetivo: "Finalidade original", recursos: null, quem_pode: null, contrapartida: null, areas: [],
  requisitos_ies: "Requisito original", restricao_ies: "somente_publicas", oe_fonte: { slug: "fapes", nome: "FAPES" },
};
const open = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(<QueryClientProvider client={qc}><EditalCuradoriaDetail edital={edital} /></QueryClientProvider>);
  await waitFor(() => expect(mocks.extractFilter).toHaveBeenCalled());
  return ui;
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Persistência dos requisitos de IES", () => {
  it("inclui requisitos_ies na leitura das extrações", async () => {
    await open();
    expect(mocks.extractFilter).toHaveBeenCalledWith("campo", expect.arrayContaining(["requisitos_ies"]));
  });
  it("salva requisitos e restrição em revisão", async () => {
    const ui = await open();
    fireEvent.change(ui.getByDisplayValue("Requisito original"), { target: { value: "Novo requisito\nSegunda linha" } });
    fireEvent.click(ui.getByRole("button", { name: "Salvar como em revisão" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status_curadoria: "em_revisao", requisitos_ies: "Novo requisito\nSegunda linha", restricao_ies: "somente_publicas" })));
  });
  it("publica requisitos e marca a extração alterada", async () => {
    const ui = await open();
    fireEvent.click(ui.getByRole("button", { name: "Aprovar e publicar" }));
    await waitFor(() => expect(mocks.extractUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "editado", revisado_por: "curador1" })));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ requisitos_ies: "Requisito original", restricao_ies: "somente_publicas", status_curadoria: "publicado" }));
  });
  it("marca a extração aprovada após usar o valor extraído", async () => {
    const ui = await open();
    await waitFor(() => expect(ui.getByRole("button", { name: "Usar valor extraído" })).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Usar valor extraído" }));
    fireEvent.click(ui.getByRole("button", { name: "Aprovar e publicar" }));
    await waitFor(() => expect(mocks.extractUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "aprovado" })));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ requisitos_ies: "Valor extraído" }));
  });
});