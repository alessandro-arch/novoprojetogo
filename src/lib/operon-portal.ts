import { oe, ehVigente, rodadaVigente, situacaoEdital, type EditalRow } from "@/pages/editais/CuradoriaPage";
import { correspondeAbrangencia } from "@/components/operon/AbrangenciaBadge";
import { correspondeFonte, type FiltrosFonte } from "@/lib/operon-fontes";

export interface EditalPublicado extends EditalRow { verificado_em: string | null; tipo: string | null; ultimo_evento?: EventoPublicado }
export interface EventoPublicado { id: string; edital_id: string; tipo: string; ocorrido_em: string; liberado: boolean; origem: string | null; valor_anterior: string | null; valor_novo: string | null }
export interface DocumentoPublicado { id: string; tipo: string | null; rotulo: string | null; url: string; versao: number | null; publicado_em: string | null; substituido: boolean }
export interface SeguidorEdital { user_id: string; edital_id: string; canal_email: boolean; canal_telegram: boolean }
export type AbaOperon = "abertos" | "em_julgamento" | "resultados";
export const ABAS_OPERON: [AbaOperon, string][] = [["abertos", "Abertos"], ["em_julgamento", "Em julgamento"], ["resultados", "Resultados"]];

// Mesmo vocabulário da curadoria, sem modificar sua tela nesta etapa.
export const EVENTOS_OPERON: Record<string, string> = {
  novo_edital: "Novo edital", prazo_alterado: "Prazo alterado", retificacao: "Retificação", errata: "Errata",
  adendo: "Adendo", anexo_novo: "Novo anexo", versao_atualizada: "Versão atualizada", rodada_aberta: "Rodada aberta",
  status_mudou: "Situação alterada", resultado_preliminar: "Resultado preliminar", resultado_final: "Resultado final",
  resultado_retificado: "Resultado retificado", resultado_sem_efeito: "Resultado sem efeito", edital_revogado: "Edital revogado",
  prazo_de_recurso: "Prazo de recurso",
};
export const rotuloEvento = (tipo: string) => EVENTOS_OPERON[tipo] ?? tipo.replace(/_/g, " ");
export const normalizarBusca = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export const numeroEdital = (e: EditalRow) => !e.numero || e.numero.trim().toLowerCase().replace(/\s/g, "") === "s/n" ? "Sem número" : `${e.numero}${e.ano ? `/${e.ano}` : ""}`;
export const temRestricaoIes = (e: EditalRow) => ["exclui_privadas_com_fins_lucrativos", "somente_publicas"].includes(e.restricao_ies ?? "");
export const prazoEdital = (e: EditalRow, agora = Date.now()) => {
  if (situacaoEdital(e, agora) !== "aberto") return null;
  const rodada = rodadaVigente(e.oe_rodada, agora);
  const prazo = rodada?.prazo_fim;
  return prazo && new Date(prazo).getTime() >= agora ? prazo : null;
};

export function filtrarPainel(rows: EditalPublicado[], filtros: FiltrosFonte & { busca: string; abrangencia: string }, agora = Date.now()) {
  const busca = normalizarBusca(filtros.busca);
  const base = rows.filter(e => e.status_curadoria === "publicado"
    && correspondeFonte(e, filtros)
    && correspondeAbrangencia(e.abrangencia, filtros.abrangencia)
    && (!busca || normalizarBusca([e.titulo, e.numero, e.categoria, ...(e.areas ?? [])].filter(Boolean).join(" ")).includes(busca)));
  const abas: Record<AbaOperon, EditalPublicado[]> = {
    abertos: base.filter(e => ehVigente(e, agora)).sort((a, b) => (prazoEdital(a, agora) ? new Date(prazoEdital(a, agora) ?? "").getTime() : Infinity) - (prazoEdital(b, agora) ? new Date(prazoEdital(b, agora) ?? "").getTime() : Infinity)),
    em_julgamento: base.filter(e => situacaoEdital(e, agora) === "em_julgamento"),
    resultados: base.filter(e => ["resultado", "encerrado"].includes(situacaoEdital(e, agora) ?? "")),
  };
  return abas;
}

const SELECT_EDITAL = "*, oe_fonte(slug,nome,esfera,uf), oe_rodada(ordem,abertura,prazo_fim,resultado_em,texto_original)";

export interface MarcoEdital {
  id: string; rotulo: string; data: string; proximo: boolean;
  origem?: string | null; valor_anterior?: string | null; valor_novo?: string | null;
}

/** Datas válidas, eventos liberados e deduplicação por instante e rótulo. */
export function montarLinhaDoTempo(edital: EditalRow, eventos: EventoPublicado[] = [], documentos: DocumentoPublicado[] = [], agora = Date.now()): MarcoEdital[] {
  const marcos: MarcoEdital[] = [];
  const adicionar = (id: string, rotulo: string, data?: string | null, evento?: EventoPublicado) => {
    if (!data || !Number.isFinite(new Date(data).getTime())) return;
    marcos.push({ id, rotulo, data, proximo: new Date(data).getTime() > agora,
      origem: evento?.origem, valor_anterior: evento?.valor_anterior, valor_novo: evento?.valor_novo });
  };
  eventos.filter(evento => evento.liberado === true).forEach(evento => adicionar(`evento-${evento.id}`, rotuloEvento(evento.tipo), evento.ocorrido_em, evento));
  (edital.oe_rodada ?? []).forEach((rodada, index) => {
    adicionar(`rodada-${index}-abertura`, "Abertura das propostas", rodada.abertura);
    adicionar(`rodada-${index}-prazo`, "Prazo de submissão", rodada.prazo_fim);
    adicionar(`rodada-${index}-resultado`, "Resultado", rodada.resultado_em);
  });
  const tipos: Record<string, string> = { errata: "Errata", retificacao: "Retificação", resultado: "Resultado", edital: "Edital" };
  documentos.forEach(documento => {
    const tipo = normalizarBusca(documento.tipo ?? "");
    adicionar(`documento-${documento.id}`, tipos[tipo] ?? rotuloEvento(tipo || "Documento"), documento.publicado_em);
  });
  adicionar(`edital-${edital.id}`, "Publicação do edital", edital.publicado_em);
  const unicos = new Map<string, MarcoEdital>();
  marcos.forEach(marco => {
    const chave = `${new Date(marco.data).getTime()}|${normalizarBusca(marco.rotulo)}`;
    if (!unicos.has(chave)) unicos.set(chave, marco);
  });
  return [...unicos.values()].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}
export async function carregarEventosPublicados(id?: string, ids?: string[]): Promise<EventoPublicado[]> {
  if (ids?.length === 0) return [];
  let q = oe.from("oe_evento").select("id,edital_id,tipo,ocorrido_em,liberado,origem,valor_anterior,valor_novo").eq("liberado", true);
  if (id) q = q.eq("edital_id", id);
  if (ids) q = q.in("edital_id", ids);
  const { data, error } = await q.order("ocorrido_em", { ascending: false });
  if (error) throw error;
  // Defesa adicional: nunca renderizar eventos não liberados.
  return ((data ?? []) as EventoPublicado[]).filter(e => e.liberado === true);
}
export async function carregarPainel(): Promise<EditalPublicado[]> {
  const { data, error } = await oe.from("oe_edital").select(SELECT_EDITAL).eq("status_curadoria", "publicado");
  if (error) throw error;
  const rows = (data ?? []) as EditalPublicado[];
  const eventos = await carregarEventosPublicados(undefined, rows.map(e => e.id));
  const ultimos = new Map<string, EventoPublicado>();
  eventos.forEach(e => { if (!ultimos.has(e.edital_id)) ultimos.set(e.edital_id, e); });
  return rows.map(e => ({ ...e, ultimo_evento: ultimos.get(e.id) }));
}
export async function carregarFicha(id: string): Promise<EditalPublicado | null> {
  const { data, error } = await oe.from("oe_edital").select(SELECT_EDITAL).eq("id", id).eq("status_curadoria", "publicado").maybeSingle();
  if (error) throw error;
  return data as EditalPublicado | null;
}
export async function carregarDocumentos(id: string): Promise<DocumentoPublicado[]> {
  const { data, error } = await oe.from("oe_documento").select("id,tipo,rotulo,url,versao,publicado_em,substituido").eq("edital_id", id).order("publicado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function carregarSeguidos(userId: string): Promise<SeguidorEdital[]> {
  const { data, error } = await oe.from("oe_seguidor_edital").select("edital_id,user_id,canal_email,canal_telegram").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}
export async function carregarSeguidor(id: string, userId: string): Promise<SeguidorEdital | null> {
  const { data, error } = await oe.from("oe_seguidor_edital").select("edital_id,user_id,canal_email,canal_telegram").eq("edital_id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function alterarSeguimento(id: string, userId: string, seguindo: boolean): Promise<SeguidorEdital | null> {
  if (!userId || !id) throw new Error("Entre no Operon para seguir este edital.");
  const registro = { user_id: userId, edital_id: id, canal_email: true, canal_telegram: false };
  const q = oe.from("oe_seguidor_edital");
  const { error } = seguindo ? await q.delete().eq("edital_id", id).eq("user_id", userId) : await q.insert(registro);
  if (error) throw error;
  return seguindo ? null : registro;
}
export async function alterarCanalTelegram(id: string, userId: string, ativo: boolean): Promise<void> {
  if (!userId || !id) throw new Error("Entre no Operon para alterar seus avisos.");
  const { error } = await oe.from("oe_seguidor_edital").update({ canal_telegram: ativo }).eq("edital_id", id).eq("user_id", userId);
  if (error) throw error;
}