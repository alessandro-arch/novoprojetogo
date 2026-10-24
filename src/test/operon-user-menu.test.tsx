import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import OperonUserMenu from "@/components/operon/OperonUserMenu";
import { carregarNomeOperon, salvarNomeOperon } from "@/lib/operon-profile";
import { aplicarViewAs, definirContextoViewAs, limparViewAs, salvarViewAs, type PapelSimulado } from "@/lib/view-as";

const { auth, toast } = vi.hoisted(() => ({
  auth: { user: { id: "usuario", email: "prppge@uvv.br" }, globalRole: null as string | null, fomentoRole: null as string | null, loading: false, simulando: false },
  toast: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/operon-profile", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/operon-profile")>(), carregarNomeOperon: vi.fn(), salvarNomeOperon: vi.fn() }));
vi.mock("@/lib/operon-access", () => ({ logoutOperon: vi.fn() }));

beforeEach(() => {
  auth.globalRole = null; auth.fomentoRole = null; auth.simulando = false;
  vi.mocked(carregarNomeOperon).mockResolvedValue("Nome Pesquisador");
  vi.mocked(salvarNomeOperon).mockResolvedValue("Nome Atualizado");
});
afterEach(() => { cleanup(); limparViewAs(); definirContextoViewAs(null, false); vi.clearAllMocks(); });
async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={qc}><OperonUserMenu /></QueryClientProvider></MemoryRouter>);
  await waitFor(() => expect(carregarNomeOperon).toHaveBeenCalledWith("usuario"));
  await waitFor(() => expect(qc.getQueryData(["oe-perfil-nome", "usuario"])).toBeDefined());
  // Abrir pelo teclado também verifica o acionamento acessível do Radix.
  fireEvent.keyDown(screen.getByRole("button", { name: /Menu do usuário/ }), { key: "Enter" });
  await screen.findByRole("menu");
  return qc;
}

describe("Menu de usuário do Operon", () => {
  it("permite Curadoria ao icca_admin efetivo", async () => {
    auth.globalRole = "icca_admin";
    await montar();
    expect(screen.getByRole("menuitem", { name: "Curadoria" })).toBeEnabled();
  });
  it.each(["superadmin", "admin", "gestor", "auditor", "coordenador", null])("não concede Curadoria pelo papel Fomento %s", async papel => {
    auth.fomentoRole = papel;
    await montar();
    expect(screen.queryByRole("menuitem", { name: "Curadoria" })).toBeNull();
  });
  it.each(["org_admin", "edital_manager", "reviewer", "proponente"])("não concede Curadoria ao papel global %s", async papel => {
    auth.globalRole = papel;
    await montar();
    expect(screen.queryByRole("menuitem", { name: "Curadoria" })).toBeNull();
  });
  it.each<PapelSimulado>(["fomento_admin", "gestor", "auditor", "coordenador", "org_admin", "edital_manager", "reviewer", "proponente", "sem_papel", "sd_solicitante", "sd_atendente"])("esconde Curadoria na simulação %s do superadmin", async papel => {
    const escolha = { userId: "usuario", papel, orgId: "org", grupoId: null };
    definirContextoViewAs("usuario", true); salvarViewAs(escolha);
    const efetivo = aplicarViewAs({ globalRole: "icca_admin", membership: null, fomentoRole: "superadmin" }, escolha);
    auth.globalRole = efetivo.globalRole; auth.fomentoRole = efetivo.fomentoRole; auth.simulando = efetivo.simulando;
    await montar();
    expect(screen.queryByRole("menuitem", { name: "Curadoria" })).toBeNull();
  });
  it("nome ausente usa o e-mail na identidade e oferece edição", async () => {
    vi.mocked(carregarNomeOperon).mockResolvedValue(null);
    await montar();
    expect(screen.getByRole("button", { name: "Menu do usuário: prppge@uvv.br" })).toBeInTheDocument();
    const perfil = screen.getByRole("menuitem", { name: /Meu perfil/ });
    fireEvent.click(perfil);
    expect(await screen.findByLabelText("Nome completo")).toHaveValue("");
  });
  it("salva o nome validado e atualiza a identidade após confirmação", async () => {
    await montar();
    fireEvent.click(screen.getByRole("menuitem", { name: /Meu perfil/ }));
    const input = await screen.findByLabelText("Nome completo");
    fireEvent.change(input, { target: { value: "  Nome Atualizado  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() => expect(salvarNomeOperon).toHaveBeenCalledWith("Nome Atualizado"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Menu do usuário: Nome Atualizado" })).toBeInTheDocument();
  });
  it("bloqueia editar e salvar em Ver como", async () => {
    definirContextoViewAs("usuario", true);
    salvarViewAs({ userId: "usuario", papel: "auditor", orgId: "org", grupoId: null });
    await montar();
    fireEvent.click(screen.getByRole("menuitem", { name: /Meu perfil/ }));
    expect(await screen.findByLabelText("Nome completo")).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(salvarNomeOperon).not.toHaveBeenCalled();
  });
  it("rola e transfere o foco ao cartão de alertas", async () => {
    const card = document.createElement("section"); card.id = "meus-alertas"; card.tabIndex = -1;
    card.scrollIntoView = vi.fn(); document.body.appendChild(card);
    try {
      await montar();
      fireEvent.click(screen.getByRole("menuitem", { name: "Meus alertas" }));
      expect(card.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(card);
    } finally { card.remove(); }
  });
});