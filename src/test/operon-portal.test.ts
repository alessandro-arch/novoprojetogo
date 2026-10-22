import { beforeEach, describe, expect, it, vi } from "vitest";
import { oe } from "@/pages/editais/CuradoriaPage";
import { alterarSeguimento, carregarEventosPublicados, carregarFicha, carregarSeguidor, carregarSeguidos, filtrarPainel, montarLinhaDoTempo, type EditalPublicado, type EventoPublicado, type DocumentoPublicado } from "@/lib/operon-portal";

const agora = new Date("2026-10-22T12:00:00Z").getTime();
const edital: EditalPublicado = {
  id: "edital", fonte_id: "fapes", numero: "01", ano: 2026, titulo: "Inovação em Saúde",
  categoria: "Pesquisa científica", situacao: "aberto", status_curadoria: "publicado", url_oficial: null,
  visto_ultima_vez_em: null, objetivo: null, recursos: null, quem_pode: null, requisitos_ies: null,
  restricao_ies: null, contrapartida: null, areas: ["Ciências Farmacêuticas"], oe_rodada: [],
  verificado_em: null, tipo: null, abrangencia: "nacional",
};
const filtros = { busca: "", fonte: "__none__", abrangencia: "__none__" };

describe("Linha do tempo derivada", () => {
  const evento: EventoPublicado = { id: "ev", edital_id: "edital", tipo: "errata", ocorrido_em: "2026-10-20T12:00:00Z", liberado: true, origem: "carga_inicial", valor_anterior: "Antes", valor_novo: "Depois" };
  const documento: DocumentoPublicado = { id: "doc", tipo: "retificacao", publicado_em: "2026-10-21T12:00:00Z", rotulo: null, url: "", versao: null, substituido: false };
  it("combina publicação, rodadas, documentos e eventos liberados em ordem de data", () => {
    const marcos = montarLinhaDoTempo({ ...edital, publicado_em: "2026-10-01T12:00:00Z", oe_rodada: [{ ordem: 1, abertura: "2026-10-02T12:00:00Z", prazo_fim: "2026-10-25T12:00:00Z", resultado_em: "2026-11-01T12:00:00Z" }] }, [evento, { ...evento, id: "privado", liberado: false, tipo: "segredo" }], [documento], agora);
    expect(marcos.map(m => m.rotulo)).toEqual(["Resultado", "Prazo de submissão", "Retificação", "Errata", "Abertura das propostas", "Publicação do edital"]);
    expect(marcos.map(m => m.proximo)).toEqual([true, true, false, false, false, false]);
    expect(marcos.find(m => m.rotulo === "Errata")).toMatchObject({ origem: "carga_inicial", valor_anterior: "Antes", valor_novo: "Depois" });
  });
  it("remove mesma data e mesmo rótulo, preservando detalhes do evento", () => {
    const marcos = montarLinhaDoTempo(edital, [evento], [{ ...documento, tipo: "ERRATA", publicado_em: "2026-10-20T09:00:00-03:00" }], agora);
    expect(marcos).toHaveLength(1);
    expect(marcos[0].valor_novo).toBe("Depois");
  });
  it("mantém rótulos diferentes na mesma data e a mesma ocorrência em datas distintas", () => {
    const marcos = montarLinhaDoTempo(edital, [evento, { ...evento, id: "ev2", ocorrido_em: "2026-10-21T12:00:00Z" }], [{ ...documento, publicado_em: evento.ocorrido_em }], agora);
    expect(marcos).toHaveLength(3);
  });
  it("não fica vazia sem oe_evento se há data de publicação ou rodada", () => {
    expect(montarLinhaDoTempo({ ...edital, publicado_em: "2026-10-01T12:00:00Z" })).toHaveLength(1);
    expect(montarLinhaDoTempo({ ...edital, oe_rodada: [{ ordem: 1, abertura: null, prazo_fim: null, resultado_em: "2026-11-01T12:00:00Z" }] })).toHaveLength(1);
  });
  it("fica vazia somente sem datas válidas e ignora eventos não liberados", () => {
    expect(montarLinhaDoTempo(edital, [{ ...evento, liberado: false }], [{ ...documento, publicado_em: "inválida" }], agora)).toEqual([]);
  });
});

describe("Busca e abas do portal", () => {
  it.each(["INOVACAO", "saude", "01", "CIENTIFICA", "farmaceuticas"])("busca título, número, categoria e áreas sem acento ou caixa: %s", busca => {
    expect(filtrarPainel([edital], { ...filtros, busca }, agora).abertos.map(e => e.id)).toEqual(["edital"]);
  });
  it("busca sem correspondência não retorna editais", () => {
    expect(filtrarPainel([edital], { ...filtros, busca: "arquitetura" }, agora).abertos).toEqual([]);
  });
  it("conta abertos vigentes, julgamento e resultados, sempre publicados", () => {
    const abas = filtrarPainel([
      edital, { ...edital, id: "julgamento", situacao: "em_julgamento" },
      { ...edital, id: "resultado", situacao: "resultado" },
      { ...edital, id: "privado", status_curadoria: "em_revisao" },
      { ...edital, id: "futuro", situacao: "encerrado", oe_rodada: [{ ordem: 1, abertura: "2026-11-01T12:00:00Z", prazo_fim: "2026-11-30T12:00:00Z" }] },
    ], filtros, agora);
    expect(abas.abertos.map(e => e.id)).toEqual(["futuro", "edital"]);
    expect(abas.em_julgamento.map(e => e.id)).toEqual(["julgamento"]);
    expect(abas.resultados.map(e => e.id)).toEqual(["resultado"]);
  });
  it("combina busca, fonte e abrangência nas contagens", () => {
    const rows = [edital, { ...edital, id: "outra", fonte_id: "cnpq" }, { ...edital, id: "estado", abrangencia: "estadual" }];
    expect(filtrarPainel(rows, { busca: "saude", fonte: "fapes", abrangencia: "nacional" }, agora).abertos.map(e => e.id)).toEqual(["edital"]);
  });
  it("ordena abertos por prazo mais próximo e mantém sem prazo ao final", () => {
    const comPrazo = (id: string, prazo: string) => ({ ...edital, id, oe_rodada: [{ ordem: 1, abertura: null, prazo_fim: prazo }] });
    expect(filtrarPainel([edital, comPrazo("depois", "2026-11-15T12:00:00Z"), comPrazo("antes", "2026-10-23T12:00:00Z")], filtros, agora).abertos.map(e => e.id)).toEqual(["antes", "depois", "edital"]);
  });
});

describe("Consultas públicas e acompanhamento", () => {
  let q: Record<string, ReturnType<typeof vi.fn>>;
  let response: { data: unknown; error: unknown };
  beforeEach(() => {
    response = { data: [], error: null };
    q = Object.fromEntries(["select", "eq", "in", "order", "maybeSingle", "delete", "insert"].map(k => [k, vi.fn()]));
    Object.values(q).forEach(fn => fn.mockImplementation(() => q));
    Object.assign(q, { then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve) });
    vi.spyOn(oe, "from").mockReturnValue(q);
  });
  it("consulta eventos exclusivamente com liberado true e em ordem decrescente", async () => {
    response.data = [{ id: "publico", liberado: true }, { id: "pendente", liberado: false }];
    expect(await carregarEventosPublicados("edital")).toEqual([{ id: "publico", liberado: true }]);
    expect(q.eq).toHaveBeenCalledWith("liberado", true);
    expect(q.eq).toHaveBeenCalledWith("edital_id", "edital");
    expect(q.order).toHaveBeenCalledWith("ocorrido_em", { ascending: false });
  });
  it("ficha consulta apenas publicado pelo id", async () => {
    response.data = null;
    expect(await carregarFicha("edital")).toBeNull();
    expect(q.eq).toHaveBeenCalledWith("id", "edital");
    expect(q.eq).toHaveBeenCalledWith("status_curadoria", "publicado");
  });
  it("consulta seguimento da ficha pelo edital e pelo próprio usuário", async () => {
    await carregarSeguidor("edital", "usuario");
    expect(q.eq).toHaveBeenCalledWith("edital_id", "edital");
    expect(q.eq).toHaveBeenCalledWith("user_id", "usuario");
    expect(q.maybeSingle).toHaveBeenCalledOnce();
  });
  it("carrega os seguidos do painel numa consulta do próprio usuário", async () => {
    await carregarSeguidos("usuario");
    expect(oe.from).toHaveBeenCalledWith("oe_seguidor_edital");
    expect(q.eq).toHaveBeenCalledWith("user_id", "usuario");
  });
  it("seguir grava email true e telegram false somente para o usuário atual", async () => {
    expect(await alterarSeguimento("edital", "usuario", false)).toEqual({ user_id: "usuario", edital_id: "edital", canal_email: true, canal_telegram: false });
    expect(q.insert).toHaveBeenCalledWith({ user_id: "usuario", edital_id: "edital", canal_email: true, canal_telegram: false });
    expect(q.delete).not.toHaveBeenCalled();
  });
  it("deixar de seguir exclui apenas a combinação edital e próprio usuário", async () => {
    expect(await alterarSeguimento("edital", "usuario", true)).toBeNull();
    expect(q.delete).toHaveBeenCalledOnce();
    expect(q.eq).toHaveBeenCalledWith("edital_id", "edital");
    expect(q.eq).toHaveBeenCalledWith("user_id", "usuario");
  });
  it("erro ao seguir não confirma novo estado", async () => {
    response.error = new Error("Falha");
    await expect(alterarSeguimento("edital", "usuario", false)).rejects.toThrow("Falha");
  });
  it("erro ao deixar de seguir não confirma remoção", async () => {
    response.error = new Error("Falha");
    await expect(alterarSeguimento("edital", "usuario", true)).rejects.toThrow("Falha");
  });
});