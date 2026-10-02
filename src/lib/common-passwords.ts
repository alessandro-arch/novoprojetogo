/**
 * Lista de senhas muito comuns, recusadas por segurança.
 * Usada para avisar o usuário enquanto digita, antes do envio.
 */
const COMMON_PASSWORDS = new Set([
  "123456", "12345678", "123456789", "1234567890", "12345", "1234", "1234567",
  "password", "password1", "passw0rd", "qwerty", "qwerty123", "abc123",
  "111111", "000000", "iloveyou", "admin123", "letmein", "welcome",
  "monkey", "dragon", "master", "sunshine", "princess", "football",
  "senha123", "senha", "senha1234", "mudar123", "brasil123", "brasil",
  "futebol", "futebol123", "deusefiel", "jesus123", "amor123",
  "1q2w3e4r", "1qaz2wsx", "qazwsx", "zaq12wsx", "asdf1234",
  "987654321", "102030", "112233", "121212", "654321",
]);

/** Retorna true se a senha for comum demais (ignora maiúsculas/minúsculas e espaços). */
export function isCommonPassword(password: string): boolean {
  const normalized = password.trim().toLowerCase();
  if (!normalized) return false;
  if (COMMON_PASSWORDS.has(normalized)) return true;
  // Sequências numéricas simples com 8+ dígitos (ex.: 12345678, 87654321)
  if (/^\d{8,}$/.test(normalized)) {
    const asc = "0123456789";
    const desc = "9876543210";
    if (asc.includes(normalized) || desc.includes(normalized)) return true;
  }
  return false;
}

export const COMMON_PASSWORD_WARNING =
  "Esta senha é muito comum e será recusada por segurança. Misture letras maiúsculas, minúsculas, números e símbolos.";
