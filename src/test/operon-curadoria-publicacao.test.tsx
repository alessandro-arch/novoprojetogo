import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CuradoriaPage from "@/pages/editais/CuradoriaPage";

const mocks = vi.hoisted(() => ({ rows: [] as any[], update: vi.fn(), toast: vi.fn(), pending: null as null | ((result: any) => void) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "curador", email: "curador@example.org", user_metadata: { full_name: "Curador" } } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => ({
    select: () => {
      const query: any = {
        eq: () => query, in: () => query,
        limit: async () => ({ data: mocks.rows.map((row) => ({ ...row })), error: null }),
        maybeSingle: async () => ({ data: { full_name: "Curador", email: "curador@example.org" }, error: null }),
        order: async () => ({ data: table === "oe_fonte" ? [{ id: "f1", slug: "fapes", nome: "FAPES" }] : table === "oe_rodada" ? [{ ordem: 1, abertura: null, prazo_fim: "2099-12-31T23:59:59Z" }] : [], error: null }),
      };
      return query;
    },
    update: (payload: any) => ({ eq: async (_field: string, id: string) => {
      mocks.update(payload, id);
      if (mocks.pending) return await new Promise((resolve) => { mocks.pending = resolve; });
      mocks.rows = mocks.rows.map((row) => row.id === id ? { ...row, ...payload } : row);
      return { error: null };
    } }),
  }),
} }));

let root: Root | undefined;
let qc: QueryClient;
const row = {
  id: "ed1", fonte_id: "f1", numero: "01", ano: 2026, titulo: "Edital de teste", categoria: null,
  situacao: "aberto", status_curadoria: "rascunho", url_oficial: null, visto_ultima_vez_em: null,
  objetivo: "Objetivo original", recursos: null, quem_pode: null, contrapartida: null, areas: [],
  requisitos_ies: null, restricao_ies: null, abrangencia: "nacional", verificado_em: null,
  oe_fonte: { slug: "fapes", nome: "FAPES" }, oe_rodada: [{ ordem: 1, abertura: null, prazo_fim: "2099-12-31T23:59:59Z" }],
};
const waitFor = async (assertion: () => void) => {
  for (let i = 0; i < 60; i++) {
    try { assertion(); return; } catch { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
  }
  assertion();
};
const button = (label: string) => [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === label);
const click = async (label: string) => {
  const element = button(label);
  if (!element) throw new Error(`Missing button: ${label}`);
  await act(async () => element.click());
};
const open = async () => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<MemoryRouter><QueryClientProvider client={qc}><CuradoriaPage /></QueryClientProvider></MemoryRouter>));
  await waitFor(() => expect(document.body.textContent).toContain("Edital de teste"));
  const edital = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes("Edital de teste"));
  if (!edital) throw new Error("Missing edital");
  await act(async () => edital.click());
  await waitFor(() => expect(button("Aprovar e publicar")?.disabled).toBe(false));
};
beforeEach(() => { vi.clearAllMocks(); mocks.rows = [{ ...row }]; mocks.pending = null; });
afterEach(async () => { await act(async () => root?.unmount()); qc?.clear(); document.body.innerHTML = ""; });

describe("Publicação visível na curadoria", () => {
  it("inicia em Todos e mantém o edital selecionado e visível após publicar", async () => {
    await open();
    expect(document.querySelector('[role="tab"][data-state="active"]')?.textContent).toContain("Todos");
    await click("Aprovar e publicar");
    await waitFor(() => expect(button("Publicado ✓")?.disabled).toBe(true));
    expect(mocks.rows[0].status_curadoria).toBe("publicado");
    expect([...document.querySelectorAll("button")].some((element) => element.textContent?.includes("Edital de teste") && element.textContent?.includes("Publicado em"))).toBe(true);
    expect(document.querySelector('a[href="/editais/ed1"]')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('[role="tab"][data-state="active"]')?.textContent).toBe("Todos 1"));
    expect([...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent?.startsWith("Publicados"))?.textContent).toBe("Publicados 1");
  });

  it("despublica somente após confirmar, preserva a verificação e mantém o edital na lista", async () => {
    await open();
    await click("Aprovar e publicar");
    await waitFor(() => expect(button("Despublicar")).toBeDefined());
    const verificado = mocks.rows[0].verificado_em;
    await click("Despublicar");
    await click("Cancelar");
    expect(mocks.rows[0].status_curadoria).toBe("publicado");
    await click("Despublicar");
    const dialog = document.querySelector('[role="alertdialog"]');
    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find((element) => element.textContent === "Despublicar");
    if (!confirm) throw new Error("Missing confirmation");
    await act(async () => confirm.click());
    await waitFor(() => expect(mocks.rows[0].status_curadoria).toBe("em_revisao"));
    expect(mocks.rows[0].verificado_em).toBe(verificado);
    expect(mocks.update).toHaveBeenLastCalledWith({ status_curadoria: "em_revisao" }, "ed1");
    expect(button("Aprovar e publicar")).toBeDefined();
    expect([...document.querySelectorAll("button")].some((element) => element.textContent?.includes("Edital de teste") && element.textContent?.includes("Em revisão"))).toBe(true);
  });

  it("atualiza o selo antes da resposta e restaura rascunho se a publicação falha", async () => {
    await open();
    mocks.pending = () => {};
    await click("Aprovar e publicar");
    await waitFor(() => expect(qc.getQueriesData<any[]>({ queryKey: ["oe-editais"] })[0][1]?.[0].status_curadoria).toBe("publicado"));
    const resolve = mocks.pending;
    if (!resolve) throw new Error("Missing pending request");
    await act(async () => resolve({ error: new Error("Falha simulada") }));
    await waitFor(() => expect(button("Aprovar e publicar")?.disabled).toBe(false));
    expect(qc.getQueriesData<any[]>({ queryKey: ["oe-editais"] })[0][1]?.[0].status_curadoria).toBe("rascunho");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Erro ao salvar" }));
  });

  it("avisa antes de trocar com alterações não salvas e salva campos sem despublicar", async () => {
    await open();
    await click("Aprovar e publicar");
    await waitFor(() => expect(button("Despublicar")).toBeDefined());
    const verificado = mocks.rows[0].verificado_em;
    const input = [...document.querySelectorAll("textarea")].find((element) => element.value === "Objetivo original");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!input || !setter) throw new Error("Missing field");
    await act(async () => { setter.call(input, "Novo objetivo"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    const tab = [...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent?.startsWith("Rascunhos"));
    if (!(tab instanceof HTMLElement)) throw new Error("Missing tab");
    await act(async () => { tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); });
    await waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
    await click("Continuar editando");
    expect(input.value).toBe("Novo objetivo");
    await click("Salvar alterações publicadas");
    await waitFor(() => expect(mocks.rows[0].objetivo).toBe("Novo objetivo"));
    expect(mocks.rows[0].status_curadoria).toBe("publicado");
    expect(mocks.rows[0].verificado_em).toBe(verificado);
    await waitFor(() => expect(button("Publicado ✓")?.disabled).toBe(true));
  });
});