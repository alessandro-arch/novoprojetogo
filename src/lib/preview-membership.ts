// TEMPORÁRIO (preview): IDs listados em VITE_PREVIEW_SKIP_DEFAULT_MEMBERSHIP não recebem
// o vínculo automático de proponente. Só vale no servidor de desenvolvimento (preview);
// builds de produção ignoram a flag. Remover este arquivo e .env.development após o teste.
export const pularVinculoPadrao = (
  userId: string,
  env: { DEV?: boolean; VITE_PREVIEW_SKIP_DEFAULT_MEMBERSHIP?: string } = import.meta.env,
): boolean => {
  if (!env.DEV) return false;
  return (env.VITE_PREVIEW_SKIP_DEFAULT_MEMBERSHIP ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean).includes(userId);
};
