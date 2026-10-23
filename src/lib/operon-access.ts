import { supabase } from "@/integrations/supabase/client";
import { escolhaAtiva, limparViewAs } from "@/lib/view-as";

export const OPERON_LOGIN = "/editais/login";

export const checkOperonAccess = async (userId: string): Promise<boolean> => {
  const sim = escolhaAtiva();
  if (sim) {
    if (sim.papel === "icca_admin") return true;
    if (["sem_papel", "fomento_admin", "gestor", "auditor", "coordenador"].includes(sim.papel) || !sim.orgId) return false;
    const { data, error } = await (supabase as any).from("oe_org_config").select("organization_id").eq("ativa", true).eq("organization_id", sim.orgId).limit(1);
    if (error) throw new Error("Não foi possível verificar seu acesso ao Operon Fomento. Tente novamente.");
    return (data ?? []).length > 0;
  }
  const [roles, config] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    (supabase as any).from("oe_org_config").select("organization_id").eq("ativa", true).limit(1),
  ]);
  if (!roles.error && (roles.data ?? []).some((r) => r.role === "icca_admin")) return true;
  if (!config.error && (config.data ?? []).length > 0) return true;
  if (roles.error || config.error) throw new Error("Não foi possível verificar seu acesso ao Operon Fomento. Tente novamente.");
  return false;
};

export const logoutOperon = async (navigate: (path: string, options: { replace: boolean }) => void) => {
  // Leave the protected page before SIGNED_OUT can render a route guard.
  limparViewAs();
  navigate(OPERON_LOGIN, { replace: true });
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.replace(OPERON_LOGIN);
};