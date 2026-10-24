const ROTULO_GLOBAL: Record<string, string> = {
  icca_admin: "Administrador da plataforma",
  org_admin: "Administrador da organização",
  edital_manager: "Gestor de editais",
  proponente: "Proponente",
  reviewer: "Avaliador",
};
const ROTULO_FOMENTO: Record<string, string> = {
  superadmin: "Superadmin", admin: "Administrador", gestor: "Gestor", auditor: "Auditor", coordenador: "Coordenador",
};

export type ItemAcesso = { portal: string; perfil: string };

export const acessosDoUsuario = (p: { globalRole: string | null; membershipRole: string | null; fomentoRole: string | null }): ItemAcesso[] => {
  const out: ItemAcesso[] = [];
  const add = (portal: string, perfil?: string) => {
    if (perfil && !out.some((o) => o.portal === portal && o.perfil === perfil)) out.push({ portal, perfil });
  };
  if (p.globalRole) add("ProjetoGO", ROTULO_GLOBAL[p.globalRole] ?? p.globalRole);
  if (p.membershipRole) add("ProjetoGO", ROTULO_GLOBAL[p.membershipRole] ?? p.membershipRole);
  if (p.fomentoRole) add("ProjetoGO Fomento", ROTULO_FOMENTO[p.fomentoRole] ?? p.fomentoRole);
  if (p.globalRole === "icca_admin") add("Operon Fomento", "Curador");
  return out;
};

export const subtituloPerfil = (p: { globalRole: string | null; membershipRole: string | null; fomentoRole: string | null }) => {
  const r = p.membershipRole ?? p.globalRole;
  if (r === "reviewer") return "Perfil do avaliador";
  if (r === "proponente") return "Perfil do proponente";
  if (p.fomentoRole) return "Perfil de Fomento";
  return "Perfil do usuário";
};
