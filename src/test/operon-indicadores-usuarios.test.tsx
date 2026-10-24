import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import IndicadoresUsuarios from "@/components/operon/IndicadoresUsuarios";
import { ehFuncaoAusente } from "@/lib/operon-indicadores-usuarios";

const { auth, rpc } = vi.hoisted(() => ({
  auth: { user: { id: "u1", email: "admin@icca.org.br" }, globalRole: "icca_admin" as string | null, fomentoRole: null as string | null, loading: false, simulando: false },
  rpc: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const RESPOSTA = {
  usuarios_com_acesso: 12, com_telegram: 3, com_email_ativo: 10, seguindo_algum: 5,
  mais_seguidos: [
    { id: "e1", numero: "10", ano: 2026, titulo: "Chamada Conjunta CAPES/AMSUD", seguidores: 4 },
    { id: "e2", numero: null, ano: 2026, titulo: "Universal CNPq", seguidores: 1 },
  ],
};

let root: Root | undefined;
let container: HTMLDivElement;
async function waitFor(check: () => void) {
  for (let i = 0; i < 50; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    try { check(); return; } catch { /* aguardar o estado confirmado */ }
  }
  check();
}
async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root?.render(<MemoryRouter><QueryClientProvider client={qc}><IndicadoresUsuarios /></QueryClientProvider></MemoryRouter>));
}

beforeEach(() => { auth.globalRole = "icca_admin"; rpc.mockResolvedValue({ data: RESPOSTA, error: null }); });
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.clearAllMocks(); });

describe("classificação do erro da consulta agregada", () => {
  it("reconhece função inexistente pelo código e pela mensagem", () => {
    expect(ehFuncaoAusente({ code: "PGRST202", message: "Could not find the function public.oe_indicadores_usuarios" })).toBe(true);
    expect(ehFuncaoAusente({ message: "could not find the function" })).toBe(true);
    expect(ehFuncaoAusente({ code: "42501", message: "permission denied" })).toBe(false);
  });
});

describe("Indicadores de usuários na Curadoria", () => {
  it("mostra os totais agregados e os editais mais seguidos", async () => {
    await montar();
    await waitFor(() => expect(container.textContent).toContain("Seguindo ao menos um edital"));
    expect(rpc).toHaveBeenCalledWith("oe_indicadores_usuarios");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Chamada Conjunta CAPES/AMSUD");
    expect(container.textContent).toContain("1 seguidor");
    const link = container.querySelector<HTMLAnchorElement>('a[href="/editais/e1"]');
    expect(link).not.toBeNull();
  });
  it("função inexistente mostra aviso de ativação pendente, sem erro", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function public.oe_indicadores_usuarios" } });
    await montar();
    await waitFor(() => expect(container.textContent).toContain("Disponível após a ativação da consulta agregada"));
    expect(container.textContent).not.toContain("Não foi possível carregar");
  });
  it("acesso negado mostra estado de erro com nova tentativa", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied for function" } });
    await montar();
    await waitFor(() => expect(container.textContent).toContain("Não foi possível carregar os indicadores de usuários"));
  });
  it("não aparece para quem não é icca_admin e nem chama a consulta", async () => {
    auth.globalRole = "org_admin";
    await montar();
    expect(container.textContent).toBe("");
    expect(rpc).not.toHaveBeenCalled();
  });
});
