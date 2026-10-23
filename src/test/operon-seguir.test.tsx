import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SeguirEditalButton from "@/components/operon/SeguirEditalButton";
import { alterarSeguimento, carregarSeguidor } from "@/lib/operon-portal";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/operon-portal", () => ({ carregarSeguidor: vi.fn(), alterarSeguimento: vi.fn(), alterarCanalTelegram: vi.fn() }));
vi.mock("@/lib/operon-telegram", () => ({ carregarStatusTelegram: vi.fn().mockResolvedValue({ conectado: false, pendente_ate: null }), carregarCanalOrganizacao: vi.fn().mockResolvedValue(null), gerarCodigoTelegram: vi.fn(), desconectarTelegram: vi.fn(), linkVinculo: vi.fn(), mensagemErroTelegram: () => "erro", nomeBotTelegram: () => "Teste_bot" }));
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.clearAllMocks(); });
const esperar = async (check: () => boolean) => {
  for (let i = 0; i < 50; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    if (check()) return;
  }
  throw new Error("Estado esperado não confirmado");
};
const botao = () => {
  const el = container.querySelector("button[aria-pressed]");
  if (!(el instanceof HTMLButtonElement)) throw new Error("Botão não encontrado");
  return el;
};
const clicar = async () => { await act(async () => botao().click()); };
const montar = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(<QueryClientProvider client={qc}><SeguirEditalButton editalId="edital" /></QueryClientProvider>));
  await esperar(() => !!container.querySelector("button"));
  return qc;
};
const registro = { user_id: "usuario", edital_id: "edital", canal_email: true, canal_telegram: false };

describe("Estado confirmado do acompanhamento", () => {
  it("segue e deixa de seguir, atualizando a ficha e invalidando o painel", async () => {
    vi.mocked(carregarSeguidor).mockResolvedValue(null);
    vi.mocked(alterarSeguimento).mockResolvedValueOnce(registro).mockResolvedValueOnce(null);
    const qc = await montar();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await clicar();
    await esperar(() => botao().getAttribute("aria-pressed") === "true");
    expect(botao()).toHaveAttribute("aria-pressed", "true");
    expect(alterarSeguimento).toHaveBeenCalledWith("edital", "usuario", false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["oe-seguidos", "usuario"] });
    await esperar(() => !botao().disabled);
    await clicar();
    await esperar(() => botao().getAttribute("aria-pressed") === "false");
    expect(botao()).toHaveAttribute("aria-pressed", "false");
    expect(alterarSeguimento).toHaveBeenLastCalledWith("edital", "usuario", true);
  });
  it("mantém o estado anterior até a gravação ser confirmada", async () => {
    vi.mocked(carregarSeguidor).mockResolvedValue(null);
    let confirmar: (value: typeof registro) => void = () => {};
    vi.mocked(alterarSeguimento).mockImplementation(() => new Promise(resolve => { confirmar = resolve; }));
    await montar();
    await clicar();
    await esperar(() => botao().disabled);
    expect(botao()).toHaveAttribute("aria-pressed", "false");
    await act(async () => confirmar(registro));
    await esperar(() => botao().getAttribute("aria-pressed") === "true");
    expect(botao()).toHaveAttribute("aria-pressed", "true");
  });
  it("falha ao excluir mantém seguindo e mostra toast de erro", async () => {
    vi.mocked(carregarSeguidor).mockResolvedValue(registro);
    vi.mocked(alterarSeguimento).mockRejectedValue(new Error("Falha"));
    await montar();
    await clicar();
    await esperar(() => toast.mock.calls.length > 0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(botao()).toHaveAttribute("aria-pressed", "true");
  });
});