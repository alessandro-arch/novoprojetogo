import { describe, expect, it } from "vitest";
import { destinoPainelGlobal, portaisAdministrativos } from "@/lib/admin-portais";

describe("atalhos administrativos por papel efetivo", () => {
  it("retorna diretamente ao painel global sem landing ou login", () => {
    expect(destinoPainelGlobal(true, false, "icca_admin")).toBe("/admin");
  });
  it("não oferece retorno global sem sessão, durante carregamento ou com papel comum", () => {
    expect(destinoPainelGlobal(false, false, "icca_admin")).toBeNull();
    expect(destinoPainelGlobal(true, true, "icca_admin")).toBeNull();
    expect(destinoPainelGlobal(true, false, "org_admin")).toBeNull();
  });
  it("inclui os quatro portais para administrador global e superadmin Fomento", () => {
    expect(portaisAdministrativos("icca_admin", "superadmin").map(p => p.destino)).toEqual([
      "/admin", "/fomento/master", "/editais/curadoria", "/servicedesk/admin",
    ]);
  });
  it("não oferece Fomento global sem o papel superadmin", () => {
    expect(portaisAdministrativos("icca_admin", "admin").map(p => p.destino)).toEqual([
      "/admin", "/editais/curadoria", "/servicedesk/admin",
    ]);
  });
  it("não oferece portais globais a administrador institucional ou simulação comum", () => {
    expect(portaisAdministrativos("org_admin", "admin")).toEqual([]);
    expect(portaisAdministrativos(null, null)).toEqual([]);
  });
  it("superadmin apenas do Fomento recebe apenas o atalho do Fomento", () => {
    expect(portaisAdministrativos(null, "superadmin").map(p => p.destino)).toEqual(["/fomento/master"]);
  });
});