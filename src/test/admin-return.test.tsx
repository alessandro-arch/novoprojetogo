import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminReturnLink from "@/components/admin/AdminReturnLink";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "test" }, loading: false, globalRole: "icca_admin" }) }));

describe("retorno administrativo", () => {
  it.each(["/editais", "/editais/curadoria", "/fomento/master", "/servicedesk/admin"])("retorna de %s para /admin", async origem => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter initialEntries={[origem]}><Routes>
      <Route path={origem} element={<AdminReturnLink />} />
      <Route path="/admin" element={<p>Painel global</p>} />
    </Routes></MemoryRouter>));
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/admin");
    await act(async () => link?.click());
    expect(host.textContent).toBe("Painel global");
    await act(async () => root.unmount()); host.remove();
  });
  it("aguarda a confirmação de alterações antes de navegar", async () => {
    let pendente: (() => void) | undefined;
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter initialEntries={["/editais/curadoria"]}><Routes>
      <Route path="/editais/curadoria" element={<AdminReturnLink onNavigate={acao => { pendente = acao; }} />} />
      <Route path="/admin" element={<p>Painel global</p>} />
    </Routes></MemoryRouter>));
    await act(async () => host.querySelector("button")?.click());
    expect(host.textContent).toContain("Painel Superadmin");
    expect(pendente).toBeTypeOf("function");
    await act(async () => pendente?.());
    expect(host.textContent).toBe("Painel global");
    await act(async () => root.unmount()); host.remove();
  });
});