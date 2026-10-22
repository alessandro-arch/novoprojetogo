import type { EditalRow } from "@/pages/editais/CuradoriaPage";

export type AcaoCuradoria = "publicar" | "revisao" | "descartar" | "despublicar" | "salvar_publicado";

export function transicaoCuradoria(acao: AcaoCuradoria, agora: string, userId?: string): Partial<EditalRow> {
  if (acao === "despublicar" || acao === "revisao") return { status_curadoria: "em_revisao" };
  if (acao === "descartar") return { status_curadoria: "descartado" };
  if (acao === "salvar_publicado") return { status_curadoria: "publicado" };
  return { status_curadoria: "publicado", verificado_em: agora, verificado_por: userId };
}

export function atualizarEditalNaLista(lista: EditalRow[] | undefined, id: string, patch: Partial<EditalRow>) {
  return lista?.map((edital) => edital.id === id ? { ...edital, ...patch } : edital);
}