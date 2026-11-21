// Regras puras da API somente leitura de editais do Operon (sem acesso a rede ou banco).

export const MAX_LIMITE = 200;
export const LIMITE_PADRAO = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PENDENTES = ["rascunho", "em_revisao"] as const;
export const ESCOPOS: Record<string, readonly string[]> = { todos: ["publicado", ...PENDENTES], publicado: ["publicado"], pendentes: PENDENTES };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function digest(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/** Compara a chave recebida com a configurada em tempo constante. */
export async function chaveValida(recebida: string | null | undefined, configurada: string | null | undefined): Promise<boolean> {
  if (!configurada || configurada.length < 16 || !recebida) return false;
  const [a, b] = await Promise.all([digest(recebida), digest(configurada)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Aceita "x-api-key: <chave>" ou "Authorization: Bearer <chave>". */
export function chaveDoPedido(headers: Headers): string | null {
  const direta = headers.get("x-api-key")?.trim();
  if (direta) return direta;
  const auth = headers.get("authorization")?.trim() ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : null;
}

export interface Consulta { status: readonly string[]; id: string | null; fonte: string | null; busca: string | null; atualizadoDesde: string | null; limite: number; offset: number }

export function lerConsulta(params: URLSearchParams): Consulta {
  const escopo = params.get("status")?.trim().toLowerCase() || "todos";
  const status = ESCOPOS[escopo];
  if (!status) throw new ApiError(400, "Parâmetro status deve ser todos, publicado ou pendentes.");
  const id = params.get("id")?.trim() || null;
  if (id && !UUID.test(id)) throw new ApiError(400, "Parâmetro id inválido.");
  const fonte = params.get("fonte")?.trim().toLowerCase() || null;
  if (fonte && !/^[a-z0-9_-]{1,40}$/.test(fonte)) throw new ApiError(400, "Parâmetro fonte inválido.");
  const busca = params.get("busca")?.trim().slice(0, 120) || null;
  const desde = params.get("atualizado_desde")?.trim() || null;
  if (desde && !Number.isFinite(new Date(desde).getTime())) throw new ApiError(400, "Parâmetro atualizado_desde deve ser uma data ISO.");
  const limiteBruto = params.get("limite");
  const limite = limiteBruto === null ? LIMITE_PADRAO : Number(limiteBruto);
  if (!Number.isInteger(limite) || limite < 1 || limite > MAX_LIMITE) throw new ApiError(400, `Parâmetro limite deve ser inteiro entre 1 e ${MAX_LIMITE}.`);
  const offsetBruto = params.get("offset");
  const offset = offsetBruto === null ? 0 : Number(offsetBruto);
  if (!Number.isInteger(offset) || offset < 0) throw new ApiError(400, "Parâmetro offset deve ser inteiro maior ou igual a 0.");
  return { status, id, fonte, busca, atualizadoDesde: desde ? new Date(desde).toISOString() : null, limite, offset };
}

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

// deno-lint-ignore no-explicit-any
type Linha = Record<string, any>;

/** Valor só aparece como número quando confirmado e do tipo total/estimado; o resto fica descrito, nunca estimado. */
export function formatarValor(e: Linha) {
  const confirmado = Boolean(e.valor_confirmado_em);
  const somavel = confirmado && ["total", "estimado"].includes(e.valor_tipo ?? "") && typeof e.valor_total_reais === "number";
  return {
    tipo: e.valor_tipo ?? null,
    confirmado,
    total_reais: somavel ? e.valor_total_reais : null,
    confirmado_em: e.valor_confirmado_em ?? null,
    observacao: e.valor_observacao ?? null,
  };
}

/** Campos do edital (publicado ou pendente, indicado em status_curadoria); nunca expõe ids de usuários nem embedding. */
export function formatarEdital(e: Linha) {
  const fonte = e.oe_fonte ?? null;
  return {
    id: e.id,
    status_curadoria: e.status_curadoria,
    titulo: e.titulo,
    numero: e.numero,
    ano: e.ano,
    orgao: e.orgao,
    fonte: fonte ? { slug: fonte.slug, nome: fonte.nome, esfera: fonte.esfera ?? null, uf: fonte.uf ?? null } : null,
    situacao: e.situacao,
    abrangencia: e.abrangencia ?? null,
    categoria: e.categoria ?? null,
    tipo: e.tipo ?? null,
    areas: e.areas ?? [],
    resumo_tldr: e.resumo_tldr ?? null,
    objetivo: e.objetivo ?? null,
    quem_pode: e.quem_pode ?? null,
    recursos: e.recursos ?? null,
    contrapartida: e.contrapartida ?? null,
    requisitos_ies: e.requisitos_ies ?? null,
    restricao_ies: e.restricao_ies ?? null,
    valor: formatarValor(e),
    url_oficial: e.url_oficial,
    publicado_em: e.publicado_em ?? null,
    data_aproximada: !e.publicado_em && Boolean(e.verificado_em),
    verificado_em: e.verificado_em ?? null,
    atualizado_em: e.updated_at,
    rodadas: [...(e.oe_rodada ?? [])].sort((a: Linha, b: Linha) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((r: Linha) => ({
      ordem: r.ordem, abertura: r.abertura ?? null, prazo_fim: r.prazo_fim ?? null, resultado_em: r.resultado_em ?? null, observacao: r.observacao ?? null,
    })),
  };
}

/** Somente os status do escopo (descartados nunca), filtros combinados, ordem por atualização mais recente e paginação. */
export function filtrarLista(rows: Linha[], c: Consulta) {
  const busca = c.busca ? normalizar(c.busca) : null;
  const filtrados = rows
    .filter(e => c.status.includes(e.status_curadoria))
    .filter(e => !c.fonte || e.oe_fonte?.slug === c.fonte)
    .filter(e => !c.atualizadoDesde || new Date(e.updated_at).getTime() >= new Date(c.atualizadoDesde).getTime())
    .filter(e => !busca || normalizar([e.titulo, e.numero, e.orgao, e.categoria, ...(e.areas ?? [])].filter(Boolean).join(" ")).includes(busca))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return { total: filtrados.length, itens: filtrados.slice(c.offset, c.offset + c.limite).map(formatarEdital) };
}

export function formatarDetalhe(e: Linha, documentos: Linha[], eventos: Linha[]) {
  return {
    ...formatarEdital(e),
    documentos: documentos.map(d => ({ tipo: d.tipo, rotulo: d.rotulo, url: d.url, versao: d.versao, publicado_em: d.publicado_em ?? null, substituido: d.substituido === true })),
    // Eventos ainda não liberados aparecem marcados com liberado: false.
    eventos: eventos.map(ev => ({ tipo: ev.tipo, liberado: ev.liberado === true, ocorrido_em: ev.ocorrido_em, valor_anterior: ev.valor_anterior ?? null, valor_novo: ev.valor_novo ?? null })),
  };
}
