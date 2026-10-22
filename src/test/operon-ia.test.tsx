import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import EditalCuradoriaDetail from "@/components/operon/EditalCuradoriaDetail";
import OperonIARodadas from "@/components/operon/OperonIARodadas";

const mocks = vi.hoisted(() => ({ update: vi.fn(), invoke: vi.fn(), rpc: vi.fn(), roundsWrite: vi.fn(), toast: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "curador" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke }, from: () => ({
  select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }), upsert: mocks.roundsWrite,
}) } }));
vi.mock("@/pages/editais/CuradoriaPage", () => ({
  oe: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }), in: () => ({ order: async () => ({ data: [], error: null }) }) }) }), update: (v: unknown) => ({ eq: async () => { mocks.update(v); return { error: null }; } }) }) },
  fmtData: () => "", rodadaVigente: () => null, SITUACOES: {}, semNumero: () => false, exigeConfirmacaoSemRodadas: () => false,
}));
const edital = { id: "edital", fonte_id: "fonte", numero: "1", ano: 2026, titulo: "Edital", categoria: null, situacao: "aberto", status_curadoria: "rascunho", url_oficial: null, visto_ultima_vez_em: null, objetivo: "Original.", recursos: null, quem_pode: null, contrapartida: null, areas: [], requisitos_ies: null, restricao_ies: null };
let root: Root | undefined;
const wait = async (assertion: () => void) => { for (let i = 0; i < 50; i++) { try { assertion(); return; } catch { await act(async () => { await new Promise(r => setTimeout(r, 10)); }); } } assertion(); };
async function open(child: React.ReactNode) {
  const container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root?.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{child}</QueryClientProvider>));
}
async function click(label: string) { const button = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === label); if (!button) throw new Error(label); await act(async () => button.click()); }
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: true, error: null }); mocks.roundsWrite.mockResolvedValue({ error: null }); mocks.invoke.mockResolvedValue({ data: { propostas: { objetivo: { valor: "Proposta científica.", trecho_origem: "Texto literal", atual_vazio: false, atual_cortado: true } }, modelo: "modelo", free_model_daily_requests: { used: 1, limit: 50, remaining: 49 } }, error: null }); });
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; });

describe("IA de curadoria: confirmação", () => {
  it("gerar e aceitar não gravam; somente salvar grava valor revisado", async () => {
    await open(<EditalCuradoriaDetail edital={edital} />);
    await wait(() => expect(document.body.textContent).toContain("Gerar com IA"));
    await click("Gerar com IA");
    await wait(() => expect(document.querySelectorAll("textarea")[1].value).toBe("Proposta científica."));
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.roundsWrite).not.toHaveBeenCalled();
    await click("Salvar como em revisão"); expect(mocks.update).not.toHaveBeenCalled();
    await click("Aceitar"); expect(mocks.update).not.toHaveBeenCalled();
    await click("Salvar como em revisão");
    await wait(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ objetivo: "Proposta científica.", status_curadoria: "em_revisao" })));
  });
  it("descartar sugestão restaura o campo anterior sem gravar", async () => {
    await open(<EditalCuradoriaDetail edital={edital} />); await wait(() => expect(document.body.textContent).toContain("Gerar com IA"));
    await click("Gerar com IA"); await wait(() => expect(document.querySelectorAll("textarea")[1].value).toBe("Proposta científica."));
    await click("Descartar"); expect(document.querySelectorAll("textarea")[1].value).toBe("Original."); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("não curador não pode gerar", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null }); await open(<EditalCuradoriaDetail edital={edital} />);
    await wait(() => expect(mocks.rpc).toHaveBeenCalledWith("oe_is_curador"));
    expect([...document.querySelectorAll("button")].some(b => b.textContent?.includes("Gerar com IA"))).toBe(false); expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("datas só gravam depois da confirmação específica", async () => {
    const concluir = vi.fn();
    await open(<OperonIARodadas editalId="edital" sugestao={{ valor: [{ abertura: "2026-12-01T09:00:00-03:00", prazo_fim: "2026-12-31T18:00:00-03:00", resultado_em: null }], trecho_origem: "Datas do edital", atual_vazio: true, atual_cortado: false }} sobrescrever={false} concluir={concluir} onPending={() => {}} />);
    expect(mocks.roundsWrite).not.toHaveBeenCalled(); await click("Confirmar e salvar rodadas"); expect(mocks.roundsWrite).not.toHaveBeenCalled();
    await click("Continuar revisando"); expect(mocks.roundsWrite).not.toHaveBeenCalled();
    await click("Confirmar e salvar rodadas"); await click("Confirmar gravação das rodadas");
    await wait(() => expect(mocks.roundsWrite).toHaveBeenCalledWith([{ edital_id: "edital", ordem: 1, abertura: "2026-12-01T09:00:00-03:00", prazo_fim: "2026-12-31T18:00:00-03:00", resultado_em: null }]));
  });
});