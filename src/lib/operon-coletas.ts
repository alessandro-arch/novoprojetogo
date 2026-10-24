import { supabase } from "@/integrations/supabase/client";

export interface FonteColeta { id: string; slug: string; nome: string }
export interface ColetaRow { id: string; fonte_id: string; iniciou_em: string; terminou_em: string | null; ok: boolean | null; erro: string | null }
export type SituacaoColeta = "ok" | "atencao" | "falha" | "sem_coleta";
export interface SaudeFonte {
  fonte: FonteColeta; situacao: SituacaoColeta;
  ultimaColeta: string | null; ultimoOk: string | null;
  falhasSeguidas: number; total: number; falhas: number; ultimoErro: string | null;
}

const HORAS_36 = 36 * 3_600_000;
export const ROTULO_SITUACAO_COLETA: Record<SituacaoColeta, string> = { ok: "Ok", atencao: "Atenção", falha: "Falha", sem_coleta: "Sem coleta registrada" };

/** Regras: Ok = última coleta bem-sucedida há menos de 36h e nenhuma falha seguida;
 *  Atenção = passou de 36h ou 1 a 2 falhas seguidas; Falha = 3 ou mais falhas seguidas;
 *  Sem coleta registrada = nenhuma coleta para a fonte. */
export function resumirColetas(fontes: FonteColeta[], coletas: ColetaRow[], agora = Date.now()): SaudeFonte[] {
  return fontes.map(fonte => {
    const daFonte = coletas.filter(c => c.fonte_id === fonte.id)
      .sort((a, b) => new Date(b.iniciou_em).getTime() - new Date(a.iniciou_em).getTime());
    const ultimaColeta = daFonte[0]?.iniciou_em ?? null;
    const ultimoOk = daFonte.find(c => c.ok === true)?.iniciou_em ?? null;
    let falhasSeguidas = 0;
    for (const c of daFonte) { if (c.ok === false) falhasSeguidas++; else break; }
    const falhas = daFonte.filter(c => c.ok === false).length;
    const ultimoErro = daFonte.find(c => c.ok === false && c.erro)?.erro ?? null;
    let situacao: SituacaoColeta;
    if (!ultimaColeta) situacao = "sem_coleta";
    else if (falhasSeguidas >= 3) situacao = "falha";
    else if (!ultimoOk || agora - new Date(ultimoOk).getTime() > HORAS_36 || falhasSeguidas >= 1) situacao = "atencao";
    else situacao = "ok";
    return { fonte, situacao, ultimaColeta, ultimoOk, falhasSeguidas, total: daFonte.length, falhas, ultimoErro };
  });
}

/** Exclusivo da curadoria: oe_coleta é legível pela policy do curador. */
export async function carregarSaudeColetas(): Promise<SaudeFonte[]> {
  const [fontesR, coletasR] = await Promise.all([
    supabase.from("oe_fonte").select("id,slug,nome").eq("ativa", true).order("nome"),
    supabase.from("oe_coleta").select("id,fonte_id,iniciou_em,terminou_em,ok,erro").order("iniciou_em", { ascending: false }).limit(1000),
  ]);
  if (fontesR.error) throw fontesR.error;
  if (coletasR.error) throw coletasR.error;
  return resumirColetas(fontesR.data ?? [], coletasR.data ?? []);
}
