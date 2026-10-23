import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { aplicarViewAs, definirContextoViewAs, escolhaAtiva, limparViewAs, lerViewAs, salvarViewAs, CHAVE_VIEW_AS } from "@/lib/view-as";
import { gravacaoBloqueada, instalarGuardaGravacao } from "@/lib/view-as-guard";

const auth = vi.hoisted(() => ({ value: { user: { id: "u1" }, realFomentoRole: "admin", membership: null } as any }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) } }));
import ViewAsBar from "@/components/ViewAsSwitcher";
import { TooltipProvider } from "@/components/ui/tooltip";

const real = { globalRole: "icca_admin" as const, membership: { organization_id: "org-real", role: "org_admin" as const }, fomentoRole: "superadmin", fomentoOrgId: "org-real" };
const BASE = "https://exemplo.supabase.co";

beforeEach(() => { sessionStorage.clear(); definirContextoViewAs(null, false); });
afterEach(() => { limparViewAs(); vi.restoreAllMocks(); });

describe("aplicarViewAs", () => {
  it("ignora o override para quem não é superadmin real", () => {
    const comum = { ...real, globalRole: null, fomentoRole: "admin" };
    const r = aplicarViewAs(comum, { userId: "u1", papel: "auditor", orgId: "x", grupoId: null });
    expect(r.simulando).toBe(false);
    expect(r.fomentoRole).toBe("admin");
  });
  it("Auditor muda o papel do Fomento e Superadmin restaura o real", () => {
    expect(aplicarViewAs(real, { userId: "u1", papel: "auditor", orgId: "org-b", grupoId: null })).toMatchObject({ fomentoRole: "auditor", globalRole: null, fomentoOrgId: "org-b", simulando: true });
    expect(aplicarViewAs(real, { userId: "u1", papel: "superadmin", orgId: null, grupoId: null })).toMatchObject({ fomentoRole: "superadmin", globalRole: "icca_admin", simulando: false });
    expect(aplicarViewAs(real, null).fomentoRole).toBe("superadmin");
  });
  it("Admin Org usa a organização escolhida", () => {
    expect(aplicarViewAs(real, { userId: "u1", papel: "org_admin", orgId: "org-b", grupoId: null }).membership).toEqual({ organization_id: "org-b", role: "org_admin" });
  });
  it("mapa dos papéis do Service Desk e Sem papel", () => {
    expect(aplicarViewAs(real, { userId: "u1", papel: "sd_atendente", orgId: "o", grupoId: "g" })).toMatchObject({ globalRole: null, sdAdmin: false, curador: false });
    expect(aplicarViewAs(real, { userId: "u1", papel: "sd_solicitante", orgId: "o", grupoId: null })).toMatchObject({ globalRole: null, fomentoRole: null });
    expect(aplicarViewAs(real, { userId: "u1", papel: "sem_papel", orgId: null, grupoId: null })).toMatchObject({ globalRole: null, membership: null, fomentoRole: null });
    expect(aplicarViewAs(real, { userId: "u1", papel: "icca_admin", orgId: null, grupoId: null })).toMatchObject({ globalRole: "icca_admin", curador: true, sdAdmin: true });
  });
});

describe("armazenamento", () => {
  it("escolha salva é descartada para não superadmin ou outro usuário", () => {
    salvarViewAs({ userId: "u1", papel: "auditor", orgId: null, grupoId: null });
    definirContextoViewAs("u1", true);
    expect(escolhaAtiva()?.papel).toBe("auditor");
    definirContextoViewAs("u2", true);
    expect(escolhaAtiva()).toBeNull();
    expect(sessionStorage.getItem(CHAVE_VIEW_AS)).toBeNull();
    salvarViewAs({ userId: "u1", papel: "auditor", orgId: null, grupoId: null });
    definirContextoViewAs("u1", false);
    expect(escolhaAtiva()).toBeNull();
  });
  it("limpar (signOut) apaga o sessionStorage", () => {
    definirContextoViewAs("u1", true);
    salvarViewAs({ userId: "u1", papel: "gestor", orgId: null, grupoId: null });
    expect(lerViewAs()?.papel).toBe("gestor");
    limparViewAs();
    expect(sessionStorage.getItem(CHAVE_VIEW_AS)).toBeNull();
    expect(escolhaAtiva()).toBeNull();
  });
  it("sessionStorage indisponível não quebra", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    definirContextoViewAs("u1", true);
    expect(() => salvarViewAs({ userId: "u1", papel: "gestor", orgId: null, grupoId: null })).not.toThrow();
    expect(lerViewAs()).toBeNull();
    expect(escolhaAtiva()?.papel).toBe("gestor");
  });
});

describe("bloqueio de gravação", () => {
  it("classifica gravações e leituras", () => {
    expect(gravacaoBloqueada(`${BASE}/rest/v1/oe_edital?id=eq.1`, "PATCH", BASE)).toBe(true);
    expect(gravacaoBloqueada(`${BASE}/rest/v1/oe_edital`, "POST", BASE)).toBe(true);
    expect(gravacaoBloqueada(`${BASE}/rest/v1/x`, "DELETE", BASE)).toBe(true);
    expect(gravacaoBloqueada(`${BASE}/functions/v1/operon-ia-extrair`, "POST", BASE)).toBe(true);
    expect(gravacaoBloqueada(`${BASE}/rest/v1/rpc/oe_gerar_vinculo_telegram`, "POST", BASE)).toBe(true);
    expect(gravacaoBloqueada(`${BASE}/rest/v1/rpc/oe_is_curador`, "POST", BASE)).toBe(false);
    expect(gravacaoBloqueada(`${BASE}/rest/v1/oe_edital?select=*`, "GET", BASE)).toBe(false);
    expect(gravacaoBloqueada(`${BASE}/auth/v1/logout`, "POST", BASE)).toBe(false);
  });
  it("durante a simulação não envia gravação; ao voltar, envia", async () => {
    const original = vi.fn().mockResolvedValue(new Response("ok"));
    (globalThis as any).__viewAsGuard = false;
    globalThis.fetch = original as any;
    instalarGuardaGravacao(BASE);
    definirContextoViewAs("u1", true);
    salvarViewAs({ userId: "u1", papel: "auditor", orgId: null, grupoId: null });
    const r = await fetch(`${BASE}/rest/v1/oe_edital`, { method: "POST" });
    expect(r.status).toBe(403);
    expect(original).not.toHaveBeenCalled();
    limparViewAs();
    await fetch(`${BASE}/rest/v1/oe_edital`, { method: "POST" });
    expect(original).toHaveBeenCalledTimes(1);
  });
});

describe("botão Ver como", () => {
  let root: Root | undefined; let el: HTMLDivElement;
  afterEach(async () => { await act(async () => root?.unmount()); el?.remove(); });
  const montar = async () => {
    el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
    await act(async () => root?.render(<QueryClientProvider client={new QueryClient()}><TooltipProvider><ViewAsBar /></TooltipProvider></QueryClientProvider>));
  };
  it("oculto para admin comum e gestor", async () => {
    for (const papel of ["admin", "gestor", null]) {
      auth.value = { user: { id: "u1" }, realFomentoRole: papel, membership: null };
      await montar();
      expect(el.textContent).not.toContain("Ver como");
      await act(async () => root?.unmount()); el.remove();
    }
    root = undefined;
  });
  it("visível para o superadmin real e mostra a faixa quando ativo", async () => {
    auth.value = { user: { id: "u1" }, realFomentoRole: "superadmin", membership: null };
    definirContextoViewAs("u1", true);
    await montar();
    expect(el.textContent).toContain("Ver como");
    await act(async () => salvarViewAs({ userId: "u1", papel: "auditor", orgId: null, grupoId: null }));
    expect(el.textContent).toContain("Visualizando como Auditor");
    expect(el.textContent).toContain("Voltar ao Superadmin");
  });
});
