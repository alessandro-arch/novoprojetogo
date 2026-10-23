import { supabase } from "@/integrations/supabase/client";

// RPCs fora dos tipos gerados: cast local, como o restante do Operon.
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};

export interface StatusTelegram { conectado: boolean; pendente_ate: string | null }

const BOT_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}bot$/i;

/** Nome de usuário do bot vem da configuração, nunca fixo no código. */
export function nomeBotTelegram(valor: unknown = import.meta.env.VITE_OPERON_TELEGRAM_BOT): string | null {
  const v = typeof valor === "string" ? valor.trim().replace(/^@/, "") : "";
  return BOT_RE.test(v) ? v : null;
}

export function linkVinculo(bot: string, codigo: string) {
  return `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(codigo)}`;
}

export function linkCanalValido(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const u = new URL(valor.trim());
    return u.protocol === "https:" && u.hostname === "t.me" && u.pathname.length > 1 ? u.toString() : null;
  } catch { return null; }
}

export function mensagemErroTelegram(err: unknown): string {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err ?? "");
  if (msg.includes("limite_codigos")) return "Você gerou muitos códigos na última hora. Aguarde um pouco e tente novamente.";
  if (msg.includes("telegram_nao_conectado")) return "Conecte seu Telegram antes de receber avisos por lá.";
  return "Não foi possível concluir. Tente novamente.";
}

export async function carregarStatusTelegram(): Promise<StatusTelegram> {
  const { data, error } = await db.rpc("oe_status_telegram");
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<StatusTelegram>;
  return { conectado: !!d.conectado, pendente_ate: d.pendente_ate ?? null };
}

export async function gerarCodigoTelegram(): Promise<string> {
  const { data, error } = await db.rpc("oe_gerar_vinculo_telegram");
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) throw new Error("codigo_invalido");
  return data;
}

export async function desconectarTelegram(): Promise<void> {
  const { error } = await db.rpc("oe_desconectar_telegram");
  if (error) throw new Error(error.message);
}

export async function carregarCanalOrganizacao(): Promise<string | null> {
  const { data, error } = await db.from("oe_org_config").select("telegram_canal").eq("ativa", true).not("telegram_canal", "is", null).limit(1);
  if (error) throw new Error(error.message);
  return linkCanalValido((data as { telegram_canal: string | null }[] | null)?.[0]?.telegram_canal);
}
