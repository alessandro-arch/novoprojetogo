import { describe, it, expect } from "vitest";
import { acessosDoUsuario, subtituloPerfil } from "@/lib/meu-acesso";
describe("meu-acesso", () => {
  it("lista só os papéis do próprio usuário", () => {
    expect(acessosDoUsuario({ globalRole: "icca_admin", membershipRole: null, fomentoRole: "superadmin" })).toEqual([
      { portal: "ProjetoGO", perfil: "Administrador da plataforma" },
      { portal: "ProjetoGO Fomento", perfil: "Superadmin" },
      { portal: "Operon Fomento", perfil: "Curador" },
    ]);
  });
  it("conta sem papel mostra lista vazia", () => expect(acessosDoUsuario({ globalRole: null, membershipRole: null, fomentoRole: null })).toEqual([]));
  it("subtítulo contextual", () => {
    expect(subtituloPerfil({ globalRole: null, membershipRole: "reviewer", fomentoRole: null })).toBe("Perfil do avaliador");
    expect(subtituloPerfil({ globalRole: null, membershipRole: "proponente", fomentoRole: null })).toBe("Perfil do proponente");
    expect(subtituloPerfil({ globalRole: null, membershipRole: null, fomentoRole: "gestor" })).toBe("Perfil de Fomento");
  });
});
