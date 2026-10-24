import { supabase } from "@/integrations/supabase/client";

export interface EditalMaisSeguido { id: string; numero: string | null; ano: number | null; titulo: string; seguidores: number }
export interface IndicadoresUsuarios {
  usuarios_com_acesso: number; com_telegram: number; com_email_ativo: number; seguindo_algum: number;
  mais_seguidos: EditalMaisSeguido[];
}

interface ErroPostgrest { code?: string; message?: string }
/** A consulta agregada ainda pode não existir no banco (função pendente de revisão). */
export const ehFuncaoAusente = (error: unknown): boolean => {
  const e = error as ErroPostgrest | null;
  return e?.code === "PGRST202" || /could not find the function/i.test(e?.message ?? "");
};

const oe = supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: ErroPostgrest | null }> };
export async function carregarIndicadoresUsuarios(): Promise<IndicadoresUsuarios> {
  const { data, error } = await oe.rpc("oe_indicadores_usuarios");
  if (error) throw error;
  const bruto = (data ?? {}) as Partial<IndicadoresUsuarios>;
  return {
    usuarios_com_acesso: Number(bruto.usuarios_com_acesso ?? 0),
    com_telegram: Number(bruto.com_telegram ?? 0),
    com_email_ativo: Number(bruto.com_email_ativo ?? 0),
    seguindo_algum: Number(bruto.seguindo_algum ?? 0),
    mais_seguidos: Array.isArray(bruto.mais_seguidos) ? bruto.mais_seguidos : [],
  };
}
