/**
 * Organização principal do Service Desk.
 *
 * A escolha fica nos dados (`sd_settings`, chave `service_desk_principal`), nunca no código:
 * o módulo atende várias instituições e cada uma pode ser a principal em sua instalação.
 */
export const SD_ORG_PRINCIPAL_KEY = "service_desk_principal";

export const DESCRICAO_ORG_PRINCIPAL =
  "Instituição principal do Service Desk: abre por padrão no painel de administração e aparece primeiro na lista.";

export interface OrgBasica {
  id: string;
  name?: string | null;
  sigla?: string | null;
}

/** Coloca a instituição principal em primeiro lugar; as demais continuam em ordem de nome. */
export function ordenarOrganizacoes<T extends OrgBasica>(orgs: T[], principalId?: string | null): T[] {
  const porNome = [...orgs].sort((a, b) =>
    String(a.name || a.sigla || "").localeCompare(String(b.name || b.sigla || ""), "pt-BR"),
  );
  if (!principalId) return porNome;
  const i = porNome.findIndex((o) => o.id === principalId);
  if (i <= 0) return porNome;
  const [principal] = porNome.splice(i, 1);
  return [principal, ...porNome];
}

/** Lê as linhas de configuração e devolve o id da instituição marcada como principal. */
export function idOrganizacaoPrincipal(
  rows: { organization_id: string; value: unknown }[] | null | undefined,
): string | null {
  return rows?.find((r) => r.value === true)?.organization_id ?? null;
}

/** Busca a marca de principal e devolve a lista já ordenada. */
export async function organizacoesComPrincipal(db: any, orgs: OrgBasica[]) {
  if (orgs.length < 2) return { orgs: ordenarOrganizacoes(orgs, null), principalId: null as string | null };
  const { data } = await db
    .from("sd_settings")
    .select("organization_id, value")
    .in("organization_id", orgs.map((o) => o.id))
    .eq("key", SD_ORG_PRINCIPAL_KEY);
  const principalId = idOrganizacaoPrincipal(data);
  return { orgs: ordenarOrganizacoes(orgs, principalId), principalId };
}
