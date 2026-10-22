import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkOperonAccess, logoutOperon } from "@/lib/operon-access";
import { passwordReturnPath } from "@/lib/password-return";

const mocks = vi.hoisted(() => ({ roles: vi.fn(), config: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => ({ select: () => ({ eq: table === "user_roles" ? mocks.roles : () => ({ limit: mocks.config }) }) }),
  auth: { signOut: mocks.signOut },
} }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.roles.mockResolvedValue({ data: [], error: null });
  mocks.config.mockResolvedValue({ data: [], error: null });
});

describe("Admissão e saída do Operon", () => {
  it("nega acesso direto sem admin nem configuração ativa visível", async () => {
    expect(await checkOperonAccess("u1")).toBe(false);
  });
  it("permite icca_admin", async () => {
    mocks.roles.mockResolvedValue({ data: [{ role: "icca_admin" }], error: null });
    expect(await checkOperonAccess("u1")).toBe(true);
  });
  it("permite configuração institucional ativa visível", async () => {
    mocks.config.mockResolvedValue({ data: [{ organization_id: "org1" }], error: null });
    expect(await checkOperonAccess("u1")).toBe(true);
  });
  it("não interpreta falha de leitura como acesso permitido", async () => {
    mocks.config.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(checkOperonAccess("u1")).rejects.toThrow();
  });
  it("navega antes de encerrar a sessão e substitui o histórico no login exclusivo", async () => {
    const events: string[] = [];
    const navigate = vi.fn(() => events.push("navigate"));
    const replace = vi.fn(() => events.push("replace"));
    vi.stubGlobal("window", { location: { replace } });
    mocks.signOut.mockImplementation(async () => { events.push("signOut"); return { error: null }; });
    try {
      await logoutOperon(navigate);
      expect(events).toEqual(["navigate", "signOut", "replace"]);
      expect(navigate).toHaveBeenCalledWith("/editais/login", { replace: true });
      expect(replace).toHaveBeenCalledWith("/editais/login");
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("Retorno da recuperação", () => {
  it("mantém retorno exclusivo do Operon", () => expect(passwordReturnPath("/editais/login")).toBe("/editais/login"));
  it("preserva o padrão sem back", () => expect(passwordReturnPath(null)).toBe("/login"));
  it("preserva o Service Desk", () => expect(passwordReturnPath("sd")).toBe("/servicedesk/login"));
  it("rejeita destino externo", () => expect(passwordReturnPath("https://example.org")).toBe("/login"));
});