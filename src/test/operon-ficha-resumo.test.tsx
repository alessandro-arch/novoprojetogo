import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditalFichaPage from "@/pages/editais/EditalFichaPage";

const mocks = vi.hoisted(() => ({ resumo: null as string | null, fonte: "fapes" }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("@/components/operon/SeguirEditalButton", () => ({ default: () => null }));
vi.mock("@/lib/operon-portal", async (original) => ({
  ...await original<typeof import("@/lib/operon-portal")>(),
  carregarFicha: async () => ({
    id: "ed1", titulo: "Chamada científica", fonte_id: "f1", numero: "01", ano: 2026,
    status_curadoria: "publicado", situacao: "aberto", oe_fonte: { slug: mocks.fonte, nome: mocks.fonte.toUpperCase() },
    resumo_tldr: mocks.resumo, objetivo: "Objetivo completo\nSegunda linha...", quem_pode: "Público completo", recursos: "Recursos completos", contrapartida: "Contrapartida completa...",
    publicado_em: "2026-10-01T12:00:00Z", oe_rodada: [],
  }),
  carregarDocumentos: async () => [], carregarEventosPublicados: async () => [],
}));
let root: Root | undefined;
let qc: QueryClient;
const open = async () => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root?.render(<MemoryRouter initialEntries={["/editais/ed1"]}><QueryClientProvider client={qc}><Routes><Route path="/editais/:id" element={<EditalFichaPage />} /></Routes></QueryClientProvider></MemoryRouter>));
  for (let i = 0; i < 40 && !document.querySelector("h1"); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
};
afterEach(async () => { await act(async () => root?.unmount()); qc?.clear(); document.body.innerHTML = ""; mocks.fonte = "fapes"; });
describe("Resumo na ficha pública", () => {
  it("CAPES sem rodadas mantém a publicação na linha do tempo e não inventa um prazo", async () => {
    mocks.fonte = "capes";
    await open();
    expect(document.body.textContent).toContain("Prazo ainda não divulgado");
    expect(document.body.textContent).toContain("Publicação do edital");
    expect(document.body.textContent).not.toContain("Nenhum evento registrado ainda");
  });
  it("mostra o resumo integral, sem alterar quebras ou reticências dos campos", async () => {
    mocks.resumo = "Objeto científico.\nPúblico elegível, aporte e prazo.";
    await open();
    expect(document.body.textContent).toContain(mocks.resumo);
    expect(document.body.textContent).toContain("Objetivo completo\nSegunda linha...");
    expect(document.body.textContent).toContain("Contrapartida completa...");
  });
  it.each([null, "", " \n "])("não mostra resumo vazio %s", async (resumo) => {
    mocks.resumo = resumo;
    await open();
    expect(document.body.textContent).not.toContain("Em resumo");
  });
});