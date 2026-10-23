import { curadorSimulado } from "@/lib/view-as";
import { z } from "zod";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const CAMPOS_IA = ["resumo_tldr", "objetivo", "quem_pode", "recursos", "contrapartida", "restricao_ies", "requisitos_ies", "abrangencia", "rodadas"] as const;
export type CampoIA = typeof CAMPOS_IA[number];
const date = z.string().datetime({ offset: true }).nullable();
export const RodadaIASchema = z.object({ abertura: date, prazo_fim: date, resultado_em: date }).refine(r =>
  Boolean(r.abertura || r.prazo_fim || r.resultado_em) && (!r.abertura || !r.prazo_fim || Date.parse(r.abertura) <= Date.parse(r.prazo_fim)));
export type RodadaIA = z.infer<typeof RodadaIASchema>;
const suggestion = z.object({ valor: z.union([z.string(), z.array(RodadaIASchema)]), trecho_origem: z.string().max(300), atual_vazio: z.boolean(), atual_cortado: z.boolean() });
export type SugestaoIA = z.infer<typeof suggestion>;
export type SugestoesIA = Partial<Record<CampoIA, SugestaoIA>>;
const responseSchema = z.object({ propostas: z.record(z.enum(CAMPOS_IA), suggestion), modelo: z.string(), free_model_daily_requests: z.object({ used: z.number(), limit: z.number(), remaining: z.number() }).nullable() });

export async function gerarSugestoes(editalId: string, sobrescrever: boolean) {
  const { data, error } = await supabase.functions.invoke("operon-ia-extrair", { body: { edital_id: editalId, sobrescrever } });
  if (error) {
    let message = "Não foi possível gerar sugestões com IA.";
    if (error instanceof FunctionsHttpError) {
      try { const detail = await error.context.json(); if (typeof detail.error === "string") message = detail.error; } catch { /* Safe default. */ }
    }
    throw new Error(message);
  }
  return responseSchema.parse(data);
}

export async function confirmarRodadasIA(editalId: string, proposed: RodadaIA[], overwrite: boolean) {
  const dates = z.array(RodadaIASchema).min(1).max(30).parse(proposed);
  const sim = curadorSimulado();
  const { data: allowed, error: authError } = sim !== null ? { data: sim, error: null } : await supabase.rpc("oe_is_curador");
  if (authError || allowed !== true) throw new Error("Somente curadores podem confirmar rodadas.");
  const { data, error } = await supabase.from("oe_rodada").select("id,ordem,abertura,prazo_fim,resultado_em").eq("edital_id", editalId).order("ordem");
  if (error) throw error;
  const existing = data ?? [];
  let order = Math.max(0, ...existing.map(r => r.ordem));
  const sameInstant = (a: string | null, b: string | null) => a === b || (a != null && b != null && Date.parse(a) === Date.parse(b));
  const payload = dates.flatMap((r, i) => {
    if (existing.some(e => sameInstant(e.abertura, r.abertura) && sameInstant(e.prazo_fim, r.prazo_fim) && sameInstant(e.resultado_em, r.resultado_em))) return [];
    const match = overwrite ? existing[i] : undefined;
    return [{ ...r, edital_id: editalId, ordem: match?.ordem ?? ++order, ...(match ? { id: match.id } : {}) }];
  });
  if (!payload.length) return;
  const { error: writeError } = await supabase.from("oe_rodada").upsert(payload);
  if (writeError) throw writeError;
}