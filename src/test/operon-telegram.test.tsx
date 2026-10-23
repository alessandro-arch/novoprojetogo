import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { rpc, toast } = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from: () => ({ select: () => ({ eq: () => ({ not: () => ({ limit: () => Promise.resolve({ data: [{ telegram_canal: "https://evil.com/x" }], error: null }) }) }) }) }) } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { linkCanalValido, linkVinculo, mensagemErroTelegram, nomeBotTelegram, carregarStatusTelegram } from "@/lib/operon-telegram";
import TelegramAlertas from "@/components/operon/TelegramAlertas";

let root: Root | undefined; let el: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); el?.remove(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
const montar = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
  await act(async () => root?.render(<QueryClientProvider client={qc}><TelegramAlertas /></QueryClientProvider>));
  for (let i = 0; i < 30; i++) { await act(async () => { await new Promise(r => setTimeout(r, 10)); }); if (!el.querySelector(".animate-pulse")) break; }
};

describe("Telegram do Operon", () => {
  it("monta o link com o bot configurado", () => {
    expect(nomeBotTelegram("@ArethaFranklin_bot")).toBe("ArethaFranklin_bot");
    expect(linkVinculo("ArethaFranklin_bot", "abc123")).toBe("https://t.me/ArethaFranklin_bot?start=abc123");
  });
  it("sem bot configurado não há nome válido", () => {
    expect(nomeBotTelegram("")).toBeNull();
    expect(nomeBotTelegram(undefined)).toBeNull();
    expect(nomeBotTelegram("nao valido")).toBeNull();
  });
  it("canal só aceita link https do t.me", () => {
    expect(linkCanalValido("https://t.me/+convite")).toBe("https://t.me/+convite");
    expect(linkCanalValido("https://evil.com/x")).toBeNull();
    expect(linkCanalValido("http://t.me/x")).toBeNull();
    expect(linkCanalValido(null)).toBeNull();
  });
  it("traduz o limite de códigos e a falta de conexão", () => {
    expect(mensagemErroTelegram(new Error("limite_codigos"))).toMatch(/muitos códigos/);
    expect(mensagemErroTelegram(new Error("telegram_nao_conectado"))).toMatch(/Conecte seu Telegram/);
  });
  it("lê status pela RPC", async () => {
    rpc.mockResolvedValue({ data: { conectado: true, pendente_ate: null }, error: null });
    expect(await carregarStatusTelegram()).toEqual({ conectado: true, pendente_ate: null });
    expect(rpc).toHaveBeenCalledWith("oe_status_telegram");
  });
  it("mostra conectado com Desconectar", async () => {
    rpc.mockResolvedValue({ data: { conectado: true, pendente_ate: null }, error: null });
    await montar();
    expect(el.textContent).toContain("Telegram conectado");
    expect(el.textContent).toContain("Desconectar");
    expect(el.textContent).not.toContain("Entrar no canal");
  });
  it("mostra aguardando confirmação quando há código pendente", async () => {
    vi.stubEnv("VITE_OPERON_TELEGRAM_BOT", "Teste_bot");
    rpc.mockResolvedValue({ data: { conectado: false, pendente_ate: new Date(Date.now() + 600000).toISOString() }, error: null });
    await montar();
    expect(el.textContent).toContain("Aguardando confirmação no Telegram");
    expect(el.textContent).toContain("Gerar novo código");
  });
  it("desconectado mostra aviso LGPD e botão", async () => {
    vi.stubEnv("VITE_OPERON_TELEGRAM_BOT", "Teste_bot");
    rpc.mockResolvedValue({ data: { conectado: false, pendente_ate: null }, error: null });
    await montar();
    expect(el.textContent).toContain("apenas para enviar alertas");
    expect(el.textContent).toContain("Receber no Telegram");
  });
});
