// Regras puras do passo de verificação em duas etapas após o login.
export type MfaEstado = {
  fatoresVerificados: number;
  nivelAtual: string | null; // aal1 | aal2
  obrigatorio: boolean;
  dispensado: boolean; // usuário comum clicou "Agora não"
};
export type MfaPasso = "liberado" | "configurar" | "desafio";

const PUBLICAS = [
  /^\/$/, /^\/login/, /^\/register/, /^\/forgot-password/, /^\/reset-password/,
  /^\/editais\/login/, /^\/fomento\/login/, /^\/servicedesk\/login/, /^\/servicedesk\/primeiro-acesso/,
  /^\/vpn-uvv/, /^\/avaliador$/, /^\/invite\//, /^\/reviewer\/activate/,
];
export const rotaPublica = (path: string) => PUBLICAS.some((r) => r.test(path));

export const contaMfaObrigatoria = (
  userId: string,
  env: { VITE_MFA_REQUIRED_USERS?: string } = import.meta.env as { VITE_MFA_REQUIRED_USERS?: string },
) => (env.VITE_MFA_REQUIRED_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(userId);

export const passoMfa = (e: MfaEstado): MfaPasso => {
  if (e.fatoresVerificados > 0) return e.nivelAtual === "aal2" ? "liberado" : "desafio";
  if (e.obrigatorio) return "configurar";
  return e.dispensado ? "liberado" : "configurar";
};

export const codigoValido = (c: string) => /^\d{6}$/.test(c);
