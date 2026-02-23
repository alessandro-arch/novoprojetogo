/**
 * Translates Supabase auth error messages to user-friendly Portuguese messages.
 */
export function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.",
    "User already registered": "Este e-mail já está cadastrado. Tente fazer login.",
    "Signup requires a valid password": "A senha informada é inválida.",
    "Password should be at least 6 characters": "A senha deve ter no mínimo 6 caracteres.",
    "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "For security purposes, you can only request this once every 60 seconds": "Aguarde 60 segundos antes de tentar novamente.",
    "New password should be different from the old password.": "A nova senha deve ser diferente da senha atual.",
  };

  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }

  // Generic fallback
  if (message.toLowerCase().includes("rate limit")) {
    return "Muitas tentativas. Aguarde alguns minutos.";
  }

  return "Ocorreu um erro. Tente novamente.";
}
