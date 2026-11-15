import { describe, it, expect, vi } from "vitest";
import { matchesInstitutionalContact, canManageFomentoOrganization, findAuthUserByEmail } from "../../supabase/functions/_shared/firstAccessPolicy";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
describe("institutional identity and invitation boundaries", () => {
  it("requires an existing institutional contact and normalizes case and whitespace", () => {
    expect(matchesInstitutionalContact(null, "new@example.test")).toBe(false);
    expect(matchesInstitutionalContact("", "new@example.test")).toBe(false);
    expect(matchesInstitutionalContact("owner@example.test", "attacker@example.test")).toBe(false);
    expect(matchesInstitutionalContact(" Owner@Example.test ", "owner@example.test")).toBe(true);
  });
  it("limits ordinary admins to their organization and allows explicit superadmin", () => {
    expect(canManageFomentoOrganization("admin", a, b)).toBe(false);
    expect(canManageFomentoOrganization("admin", null, a)).toBe(false);
    expect(canManageFomentoOrganization("admin", a, a)).toBe(true);
    expect(canManageFomentoOrganization("gestor", a, a)).toBe(false);
    expect(canManageFomentoOrganization("superadmin", null, b)).toBe(true);
    expect(canManageFomentoOrganization("superadmin", null, "invalid")).toBe(false);
  });
  it("finds an existing account beyond the first auth page", async () => {
    const api = { listUsers: vi.fn().mockResolvedValueOnce({ data: { users: Array.from({ length: 200 }, (_, i) => ({ email: `other${i}@example.test` })) }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: "existing", email: "owner@example.test" }] }, error: null }) };
    expect((await findAuthUserByEmail(api, "Owner@Example.test")).id).toBe("existing");
    expect(api.listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 200 });
  });
  it("never treats a lookup error as absence of an existing account", async () => {
    await expect(findAuthUserByEmail({ listUsers: async () => ({ data: null, error: new Error("offline") }) }, "owner@example.test")).rejects.toThrow("offline");
  });
});
