import { curadorSimulado } from "@/lib/view-as";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { BadgeProps } from "@/components/ui/badge";

export type FonteOperon = Pick<Tables<"oe_fonte">, "id" | "slug" | "nome" | "esfera" | "uf">;
export type IdentidadeFonte = Pick<FonteOperon, "slug" | "nome"> & Partial<Pick<FonteOperon, "esfera" | "uf">>;
export const VARIANTES_FONTE: Readonly<Record<string, NonNullable<BadgeProps["variant"]>>> = {
  cnpq: "fonteCnpq", fapes: "fonteFapes", capes: "fonteCapes",
};
export const varianteFonte = (slug?: string | null): NonNullable<BadgeProps["variant"]> => {
  const chave = slug?.toLowerCase() ?? "";
  return Object.prototype.hasOwnProperty.call(VARIANTES_FONTE, chave) ? VARIANTES_FONTE[chave] : "fonteNeutra";
};

export interface FiltrosFonte { fonte: string; esfera?: string }
export const correspondeFonte = (e: { fonte_id: string; oe_fonte?: IdentidadeFonte | null }, f: FiltrosFonte) =>
  (f.fonte === "__none__" || e.fonte_id === f.fonte)
  && (!f.esfera || f.esfera === "__none__" || e.oe_fonte?.esfera === f.esfera);

export const fontesLiberadas = (fontes: FonteOperon[], configs: { fontes: string[] }[]) => {
  const ids = new Set(configs.flatMap(c => c.fontes));
  return fontes.filter(f => ids.has(f.id));
};

/** Somente configurações institucionais ativas visíveis pela RLS da sessão atual. */
export async function carregarFontesOperon(): Promise<FonteOperon[]> {
  const { data: configs, error: configError } = await supabase.from("oe_org_config").select("fontes").eq("ativa", true);
  if (configError) throw configError;
  const ids = [...new Set((configs ?? []).flatMap(c => c.fontes))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from("oe_fonte").select("id,slug,nome,esfera,uf").in("id", ids).order("nome");
  if (error) throw error;
  return fontesLiberadas(data ?? [], configs ?? []);
}

/** Exclusivo da curadoria; a autorização vem da função do banco com a sessão atual. */
export async function carregarFontesCuradoria(): Promise<FonteOperon[]> {
  const sim = curadorSimulado();
  const { data: curador, error: acessoError } = sim !== null ? { data: sim, error: null } : await supabase.rpc("oe_is_curador");
  if (acessoError) throw acessoError;
  if (curador !== true) return carregarFontesOperon();
  const { data, error } = await supabase.from("oe_fonte").select("id,slug,nome,esfera,uf").eq("ativa", true).order("nome");
  if (error) throw error;
  return data ?? [];
}