import { describe, it, expect } from "vitest";
import { passoMfa, contaMfaObrigatoria, codigoValido, rotaPublica } from "@/lib/mfa-policy";
const base = { fatoresVerificados: 0, nivelAtual: "aal1", obrigatorio: false, dispensado: false };
describe("mfa-policy", () => {
  it("primeiro login sem autenticador mostra configuração", () => expect(passoMfa(base)).toBe("configurar"));
  it("usuário comum pode dispensar", () => expect(passoMfa({ ...base, dispensado: true })).toBe("liberado"));
  it("conta obrigatória não pode dispensar", () => expect(passoMfa({ ...base, obrigatorio: true, dispensado: true })).toBe("configurar"));
  it("com autenticador e sessão aal1 pede código", () => expect(passoMfa({ ...base, fatoresVerificados: 1 })).toBe("desafio"));
  it("após código correto (aal2) libera", () => expect(passoMfa({ ...base, fatoresVerificados: 1, nivelAtual: "aal2" })).toBe("liberado"));
  it("código precisa ter 6 dígitos", () => { expect(codigoValido("12345")).toBe(false); expect(codigoValido("12a456")).toBe(false); expect(codigoValido("123456")).toBe(true); });
  it("só a conta listada é obrigatória", () => { expect(contaMfaObrigatoria("a", { VITE_MFA_REQUIRED_USERS: "a,b" })).toBe(true); expect(contaMfaObrigatoria("c", { VITE_MFA_REQUIRED_USERS: "a" })).toBe(false); });
  it("logins são públicos e painéis não", () => { expect(rotaPublica("/editais/login")).toBe(true); expect(rotaPublica("/admin")).toBe(false); });
});
