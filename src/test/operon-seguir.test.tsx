import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SeguirEditalButton from "@/components/operon/SeguirEditalButton";
import { alterarSeguimento, carregarSeguidor } from "@/lib/operon-portal";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/operon-portal", () => ({ carregarSeguidor: vi.fn(), alterarSeguimento: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const montar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><SeguirEditalButton editalId="edital" /></QueryClientProvider>);
  return qc;
};
const registro = { user_id: "usuario", edital_id: "edital", canal_email: true, canal_telegram: false };

describe("Estado confirmado do acompanhamento", () => {
  it("segue e deixa de seguir, atualizando a ficha e invalidando o painel", async () => {
    vi.mocked(carregarSeguidor).mockResolvedValue(null);
    vi.mocked(alterarSeguimento).mockResolvedValueOnce(registro).mockResolvedValueOnce(null);
    const qc = montar();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    fireEvent.click(await screen.findByRole("button", { name: "Seguir este edital" }));
    expect(await screen.findByRole("button", { name: "Seguindo este edital" })).toHaveAttribute("aria-pressed", "true");
    expect(alterarSeguimento).toHaveBeenCalledWith("edital", "usuario", false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["oe-seguidos", "usuario"] });
    fireEvent.click(screen.getByRole("button", { name: "Seguindo este edital" }));
    expect(await screen.findByRole("button", { name: "Seguir este edital" })).toHaveAttribute("aria-pressed", "false");
    expect(alterarSeguimento).toHaveBeenLastCalledWith("edital", "usuario", true);
  });
  it("mantém o estado anterior até a gravação ser confirmada", async () => {
    vi.mocked(carregarSeguidor).mockResolvedValue(null);
    let confirmar: (value: typeof registro) => void = () => {};
    vi.mocked(alterarSeguimento).mockImplementation(() => new Promise(resolve => { confirmar = resolve; }));
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Seguir este edital" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Seguir este edital" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Seguir este edital" })).toHaveAttribute("aria-pressed", "false");
    confirmar(registro);
    expect(await screen.findByRole("button", { name: "Seguindo este edital" })).toHaveAttribute("aria-pressed", "true");
  });
  it("falha ao excluir mantém seguindo e mostra toast de erro", async () => {
    vi.mocked(carregarSeguidor).mockResolvedValue(registro);
    vi.mocked(alterarSeguimento).mockRejectedValue(new Error("Falha"));
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Seguindo este edital" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(screen.getByRole("button", { name: "Seguindo este edital" })).toHaveAttribute("aria-pressed", "true");
  });
});