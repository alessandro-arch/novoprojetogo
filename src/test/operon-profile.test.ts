import { afterEach, describe, expect, it, vi } from "vitest";
import { nomeOperonSchema, salvarNomeOperon } from "@/lib/operon-profile";
import { definirContextoViewAs, limparViewAs, salvarViewAs } from "@/lib/view-as";

const { from, update, eq, select, single, getUser } = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), getUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, auth: { getUser } } }));
afterEach(() => { limparViewAs(); definirContextoViewAs(null, false); vi.clearAllMocks(); });
const preparar = () => {
  getUser.mockResolvedValue({ data: { user: { id: "auth-uid" } }, error: null });
  from.mockReturnValue({ update }); update.mockReturnValue({ eq }); eq.mockReturnValue({ select }); select.mockReturnValue({ single }); single.mockResolvedValue({ data: { full_name: "Nome Completo" }, error: null });
};
describe("Gravação restrita do perfil Operon", () => {
  it("envia somente full_name com trim para o próprio auth.uid", async () => {
    preparar();
    expect(await salvarNomeOperon("  Nome Completo  ")).toBe("Nome Completo");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledExactlyOnceWith({ full_name: "Nome Completo" });
    expect(eq).toHaveBeenCalledWith("user_id", "auth-uid");
  });
  it.each(["", " ", "A", "x".repeat(121)])("rejeita nome fora de 2 a 120 caracteres", async nome => {
    preparar();
    await expect(salvarNomeOperon(nome)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it.each(["AB", "x".repeat(120)])("aceita o limite válido de caracteres", nome => {
    expect(nomeOperonSchema.parse(` ${nome} `)).toBe(nome);
  });
  it("bloqueia a gravação antes de consultar a sessão em Ver como", async () => {
    preparar(); definirContextoViewAs("auth-uid", true); salvarViewAs({ userId: "auth-uid", papel: "auditor", orgId: "org", grupoId: null });
    await expect(salvarNomeOperon("Nome Completo")).rejects.toThrow("Modo visualização");
    expect(getUser).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it("bloqueia se a simulação começar durante a consulta de sessão", async () => {
    preparar(); definirContextoViewAs("auth-uid", true);
    getUser.mockImplementation(async () => {
      salvarViewAs({ userId: "auth-uid", papel: "auditor", orgId: "org", grupoId: null });
      return { data: { user: { id: "auth-uid" } }, error: null };
    });
    await expect(salvarNomeOperon("Nome Completo")).rejects.toThrow("Modo visualização");
    expect(update).not.toHaveBeenCalled();
  });
  it("não grava sem usuário autenticado", async () => {
    preparar(); getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(salvarNomeOperon("Nome Completo")).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});