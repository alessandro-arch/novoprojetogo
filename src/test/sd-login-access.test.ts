import { describe, it, expect } from "vitest";
import { canEnterServiceDesk } from "@/lib/sd-login-access";

const none = { isSuperadmin: false, memberships: 0, groups: 0, students: 0, faculty: 0, staff: 0 };

describe("acesso ao login do Service Desk", () => {
  it("técnico-administrativo com acesso ativo entra", () => {
    expect(canEnterServiceDesk({ ...none, staff: 1 })).toBe(true);
  });
  it("conta sem nenhum vínculo é recusada", () => {
    expect(canEnterServiceDesk(none)).toBe(false);
  });
});
