import { useSyncExternalStore } from "react";

/**
 * "Ver como": simulação de papel apenas na interface, exclusiva do superadmin real.
 * Nada é gravado no banco; a escolha vive só no sessionStorage.
 */
export type PapelSimulado =
  | "superadmin" | "fomento_admin" | "gestor" | "auditor" | "coordenador"
  | "icca_admin" | "org_admin" | "edital_manager" | "reviewer" | "proponente"
  | "sd_solicitante" | "sd_atendente" | "sem_papel";

export const PAPEIS_SIMULADOS: [PapelSimulado, string][] = [
  ["superadmin", "Superadmin (real)"], ["fomento_admin", "Admin Fomento"], ["gestor", "Gestor"],
  ["auditor", "Auditor"], ["coordenador", "Coordenador"], ["icca_admin", "Admin ICCA"],
  ["org_admin", "Admin Org"], ["edital_manager", "Gestor de Edital"], ["reviewer", "Avaliador"],
  ["proponente", "Proponente"], ["sd_solicitante", "Solicitante Service Desk"],
  ["sd_atendente", "Atendente de grupo"], ["sem_papel", "Sem papel"],
];
export const rotuloPapel = (p: PapelSimulado) => PAPEIS_SIMULADOS.find(([k]) => k === p)?.[1] ?? p;
export const PAPEIS_SEM_ORG: PapelSimulado[] = ["superadmin", "icca_admin", "sem_papel"];
export const precisaOrg = (p: PapelSimulado) => !PAPEIS_SEM_ORG.includes(p);

export interface EscolhaViewAs { userId: string; papel: PapelSimulado; orgId: string | null; orgNome?: string | null; grupoId: string | null }

type AppRole = "icca_admin" | "org_admin" | "edital_manager" | "proponente" | "reviewer";
export interface PapeisReais {
  globalRole: AppRole | null;
  membership: { organization_id: string; role: AppRole } | null;
  fomentoRole: string | null;
  fomentoOrgId?: string | null;
}
export interface PapeisEfetivos extends PapeisReais {
  simulando: boolean;
  /** null = sem simulação, consultar o banco normalmente. */
  curador: boolean | null;
  sdAdmin: boolean | null;
}

const MAPA: Record<Exclude<PapelSimulado, "superadmin">, { g: AppRole | null; m: AppRole | null | "real"; f: string | null; cur: boolean; sd: boolean }> = {
  fomento_admin: { g: null, m: "proponente", f: "admin", cur: false, sd: false },
  gestor: { g: null, m: "proponente", f: "gestor", cur: false, sd: false },
  auditor: { g: null, m: "proponente", f: "auditor", cur: false, sd: false },
  coordenador: { g: null, m: "proponente", f: "coordenador", cur: false, sd: false },
  icca_admin: { g: "icca_admin", m: "real", f: null, cur: true, sd: true },
  org_admin: { g: null, m: "org_admin", f: null, cur: false, sd: false },
  edital_manager: { g: null, m: "edital_manager", f: null, cur: false, sd: false },
  reviewer: { g: "reviewer", m: "reviewer", f: null, cur: false, sd: false },
  proponente: { g: null, m: "proponente", f: null, cur: false, sd: false },
  sd_solicitante: { g: null, m: "proponente", f: null, cur: false, sd: false },
  sd_atendente: { g: null, m: "proponente", f: null, cur: false, sd: false },
  sem_papel: { g: null, m: null, f: null, cur: false, sd: false },
};

/** O override só vale quando o papel real (lido do banco) é superadmin. */
export function aplicarViewAs(real: PapeisReais, escolha: EscolhaViewAs | null): PapeisEfetivos {
  const base = { ...real, simulando: false, curador: null, sdAdmin: null };
  if (real.fomentoRole !== "superadmin" || !escolha || escolha.papel === "superadmin") return base;
  const cfg = MAPA[escolha.papel];
  if (!cfg) return base;
  const orgId = escolha.orgId ?? real.membership?.organization_id ?? null;
  const membership = cfg.m === null ? null : cfg.m === "real" ? real.membership
    : orgId ? { organization_id: orgId, role: cfg.m } : null;
  return {
    globalRole: cfg.g, membership, fomentoRole: cfg.f,
    fomentoOrgId: cfg.f ? (escolha.orgId ?? real.fomentoOrgId ?? null) : null,
    simulando: true, curador: cfg.cur, sdAdmin: cfg.sd,
  };
}

// ---------- armazenamento ----------
export const CHAVE_VIEW_AS = "projetogo:ver-como";
const PAPEIS = new Set(PAPEIS_SIMULADOS.map(([k]) => k));

export function lerViewAs(): EscolhaViewAs | null {
  try {
    const raw = window.sessionStorage.getItem(CHAVE_VIEW_AS);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.userId !== "string" || !PAPEIS.has(v.papel)) return null;
    return { userId: v.userId, papel: v.papel, orgId: v.orgId ?? null, orgNome: v.orgNome ?? null, grupoId: v.grupoId ?? null };
  } catch { return null; }
}
function gravar(v: EscolhaViewAs | null) {
  try {
    if (v) window.sessionStorage.setItem(CHAVE_VIEW_AS, JSON.stringify(v));
    else window.sessionStorage.removeItem(CHAVE_VIEW_AS);
  } catch { /* sessionStorage indisponível: segue só em memória */ }
}

// ---------- estado global (lido também fora do React) ----------
let escolhaAtual: EscolhaViewAs | null = typeof window !== "undefined" ? lerViewAs() : null;
let contexto: { userId: string | null; realSuper: boolean } = { userId: null, realSuper: false };
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(fn => fn());

/** Escolha válida para a sessão atual; null para qualquer não superadmin. */
export function escolhaAtiva(): EscolhaViewAs | null {
  if (!escolhaAtual || !contexto.realSuper || escolhaAtual.userId !== contexto.userId || escolhaAtual.papel === "superadmin") return null;
  return escolhaAtual;
}
export const simulando = () => escolhaAtiva() !== null;

export function salvarViewAs(v: EscolhaViewAs | null) {
  escolhaAtual = v && v.papel !== "superadmin" ? v : null;
  gravar(escolhaAtual);
  avisar();
}
export function limparViewAs() { salvarViewAs(null); }

/** Chamado pelo AuthContext depois de ler os papéis reais do banco. */
export function definirContextoViewAs(userId: string | null, realSuper: boolean) {
  contexto = { userId, realSuper };
  if (escolhaAtual && (!realSuper || escolhaAtual.userId !== userId)) { escolhaAtual = null; gravar(null); }
  avisar();
}
export const contextoViewAs = () => contexto;

const assinar = (fn: () => void) => { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; };
let instantaneo: { escolha: EscolhaViewAs | null; realSuper: boolean; userId: string | null } = { escolha: null, realSuper: false, userId: null };
const obter = () => {
  const e = escolhaAtiva();
  if (e !== instantaneo.escolha || contexto.realSuper !== instantaneo.realSuper || contexto.userId !== instantaneo.userId) {
    instantaneo = { escolha: e, realSuper: contexto.realSuper, userId: contexto.userId };
  }
  return instantaneo;
};
export function useViewAs() { return useSyncExternalStore(assinar, obter, obter); }
export function useModoVisualizacao() { return useViewAs().escolha !== null; }

/** Resultado de oe_is_curador respeitando a simulação; null = consultar o banco. */
export function curadorSimulado(): boolean | null {
  const e = escolhaAtiva();
  return e ? e.papel === "icca_admin" : null;
}
