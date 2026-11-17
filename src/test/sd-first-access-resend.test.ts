import { describe, it, expect } from "vitest";
import { canResendUnconfirmedSignup } from "../../supabase/functions/_shared/firstAccessPolicy";

describe("primeiro acesso: reenvio para cadastro não confirmado", () => {
  const pending = { email: "aluno@uvv.test", email_confirmed_at: null, last_sign_in_at: null };
  it("reenvia quando a conta nunca foi confirmada nem usada e o e-mail é o mesmo", () => {
    expect(canResendUnconfirmedSignup(pending, " Aluno@UVV.test ")).toBe(true);
  });
  it("não reenvia para conta já confirmada", () => {
    expect(canResendUnconfirmedSignup({ ...pending, email_confirmed_at: "2026-10-02T00:00:00Z" }, "aluno@uvv.test")).toBe(false);
  });
  it("não reenvia para conta que já entrou alguma vez", () => {
    expect(canResendUnconfirmedSignup({ ...pending, last_sign_in_at: "2026-10-02T00:00:00Z" }, "aluno@uvv.test")).toBe(false);
  });
  it("não reenvia para outro e-mail nem sem conta", () => {
    expect(canResendUnconfirmedSignup(pending, "outro@uvv.test")).toBe(false);
    expect(canResendUnconfirmedSignup(null, "aluno@uvv.test")).toBe(false);
  });
});
