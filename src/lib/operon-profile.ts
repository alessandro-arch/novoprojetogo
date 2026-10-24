import { supabase } from "@/integrations/supabase/client";
import { simulando } from "@/lib/view-as";
import { z } from "zod";

export const nomeOperonSchema = z.string().trim().min(2, "Informe de 2 a 120 caracteres.").max(120, "Informe de 2 a 120 caracteres.");

export async function carregarNomeOperon(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("full_name").eq("user_id", userId).single();
  if (error) throw error;
  return data.full_name;
}

export async function salvarNomeOperon(nome: string): Promise<string> {
  if (simulando()) throw new Error("Modo visualização");
  const full_name = nomeOperonSchema.parse(nome);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Entre novamente para atualizar seu nome.");
  // A simulação pode ter sido ativada enquanto a sessão era consultada.
  if (simulando()) throw new Error("Modo visualização");
  const { data, error } = await supabase.from("profiles").update({ full_name }).eq("user_id", user.id).select("full_name").single();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível atualizar seu nome.");
  return data.full_name ?? full_name;
}

export function papelUsuarioOperon(globalRole: string | null, fomentoRole: string | null): string {
  if (fomentoRole === "superadmin") return "Superadmin";
  if (globalRole === "icca_admin") return "Admin ICCA";
  return ({ admin: "Admin Fomento", gestor: "Gestor", auditor: "Auditor", coordenador: "Coordenador" } as Record<string, string>)[fomentoRole ?? ""] ?? "Usuário";
}

export function identidadeUsuarioOperon(nome: string | null | undefined, email: string | undefined) {
  const nomeCompleto = nome?.trim() ?? "";
  const identidade = nomeCompleto || email || "Usuário";
  const partes = (nomeCompleto || email?.split("@")[0] || "U").split(/\s+/);
  const iniciais = partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}` : partes[0].slice(0, 2);
  return { identidade, iniciais: iniciais.toLocaleUpperCase("pt-BR"), semNome: !nomeCompleto };
}