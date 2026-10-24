import { simulando } from "@/lib/view-as";

/**
 * Durante o "Ver como", nenhuma gravação chega ao banco.
 * Precisa ser importado antes do cliente Supabase (main.tsx), que captura o fetch ao ser criado.
 */
export const RPCS_LEITURA = new Set([
  "oe_is_curador", "oe_is_curador_org", "oe_membro_org", "oe_status_telegram", "sd_me", "sd_check_vpn_eligibility",
  "get_user_org_id", "get_user_org_role", "has_role", "is_org_member", "list_fomento_users",
  "find_profile_by_email", "sd_members_signup_status", "oe_indicadores_usuarios",
]);
export const MSG_MODO_VISUALIZACAO = "Modo visualização: nada é gravado enquanto você vê como outro papel.";
export const EVENTO_BLOQUEIO = "projetogo:gravacao-bloqueada";

export function gravacaoBloqueada(url: string, method: string, base: string): boolean {
  if (!base || !url.startsWith(base)) return false;
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  const path = url.slice(base.length).split("?")[0];
  if (path.startsWith("/auth/v1")) return false;
  const rpc = path.match(/^\/rest\/v1\/rpc\/([^/]+)/);
  if (rpc) return !RPCS_LEITURA.has(decodeURIComponent(rpc[1]));
  return path.startsWith("/rest/v1") || path.startsWith("/storage/v1") || path.startsWith("/functions/v1");
}

export function instalarGuardaGravacao(base: string = import.meta.env.VITE_SUPABASE_URL ?? "https://vxvnrocwixzwbjamfiqr.supabase.co") {
  const g = globalThis as typeof globalThis & { __viewAsGuard?: boolean };
  if (g.__viewAsGuard || typeof g.fetch !== "function") return;
  g.__viewAsGuard = true;
  const original = g.fetch.bind(g);
  g.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (simulando()) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (gravacaoBloqueada(url, method, base)) {
        try { window.dispatchEvent(new CustomEvent(EVENTO_BLOQUEIO)); } catch { /* sem janela */ }
        return Promise.resolve(new Response(JSON.stringify({ message: MSG_MODO_VISUALIZACAO, code: "modo_visualizacao" }), { status: 403, headers: { "Content-Type": "application/json" } }));
      }
    }
    return original(input, init);
  };
}

instalarGuardaGravacao();
