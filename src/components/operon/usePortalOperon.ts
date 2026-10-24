import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { carregarPainel, carregarSeguidos } from "@/lib/operon-portal";
import { carregarFontesOperon } from "@/lib/operon-fontes";

/** Um único cache por usuário, compartilhado por todas as páginas do portal. */
export function usePortalOperon() {
  const { user } = useAuth();
  const lista = useQuery({ queryKey: ["oe-portal-painel", user?.id], queryFn: carregarPainel, enabled: !!user });
  const fontes = useQuery({ queryKey: ["oe-fontes", user?.id], queryFn: carregarFontesOperon, enabled: !!user });
  const seguidos = useQuery({ queryKey: ["oe-seguidos", user?.id], enabled: !!user, queryFn: () => carregarSeguidos(user?.id ?? "") });
  const seguidosIds = new Set((seguidos.data ?? []).map(s => s.edital_id));
  return { user, lista, fontes, seguidos, seguidosIds };
}
