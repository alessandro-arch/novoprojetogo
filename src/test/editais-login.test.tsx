import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditaisLogin from "@/pages/editais/EditaisLogin";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), toast: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
  roles: vi.fn(), config: vi.fn(), select: vi.fn(), active: vi.fn(), limit: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/Seo", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
    from: () => ({ select: () => ({ eq: mocks.roles }) }),
  },
}));
vi.mock("@/pages/editais/CuradoriaPage", () => ({ oe: { from: mocks.config } }));

let root: Root | undefined;
const waitFor = async (assertion: () => void) => { assertion(); };
const submit = async () => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<EditaisLogin />));
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setValue) throw new Error("Input setter unavailable");
  await act(async () => {
    for (const [id, value] of [["email", "teste@example.org"], ["password", "senha-de-teste"]]) {
      const input = container.querySelector(`#${id}`);
      if (!input) throw new Error(`Missing input ${id}`);
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await act(async () => {
    container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.roles.mockResolvedValue({ data: [], error: null });
  mocks.config.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.active });
  mocks.active.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue({ data: [], error: null });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = "";
});

describe("Acesso ao Operon Fomento", () => {
  it("permite icca_admin sem organização ativa", async () => {
    mocks.roles.mockResolvedValue({ data: [{ role: "icca_admin" }], error: null });
    await submit();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/editais", { replace: true }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("permite organização ativa visível pela RLS, consultando somente uma linha", async () => {
    mocks.limit.mockResolvedValue({ data: [{ organization_id: "org-test" }], error: null });
    await submit();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/editais", { replace: true }));
    expect(mocks.config).toHaveBeenCalledWith("oe_org_config");
    expect(mocks.select).toHaveBeenCalledWith("organization_id");
    expect(mocks.active).toHaveBeenCalledWith("ativa", true);
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("encerra a sessão sem icca_admin nem organização ativa", async () => {
    mocks.roles.mockResolvedValue({ data: [{ role: "org_admin" }], error: null });
    await submit();
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("não permite acesso quando ambas as verificações falham", async () => {
    mocks.roles.mockResolvedValue({ data: null, error: new Error("network") });
    mocks.limit.mockResolvedValue({ data: null, error: new Error("network") });
    await submit();
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});