import { chaveDoPedido, chaveValida, filtrarLista, formatarDetalhe, formatarValor, lerConsulta, ApiError } from "./core.ts";
const assert = (v: unknown, m = "Assertion failed") => { if (!v) throw new Error(m); };
const CHAVE = "chave-de-teste-com-32-caracteres!";
const base = (over: Record<string, unknown> = {}) => ({ id: "1", titulo: "Edital Pesquisa", numero: "10", ano: 2026, orgao: "FAPES", situacao: "aberto", status_curadoria: "publicado",
  updated_at: "2026-11-01T00:00:00Z", url_oficial: "https://fapes.es.gov.br", oe_fonte: { slug: "fapes", nome: "FAPES" }, oe_rodada: [], embedding: "x", valor_confirmado_por: "user-1", ...over });

Deno.test("recusa chave errada, ausente ou chave configurada curta", async () => {
  assert(await chaveValida(CHAVE, CHAVE));
  assert(!(await chaveValida("errada", CHAVE)));
  assert(!(await chaveValida(null, CHAVE)));
  assert(!(await chaveValida("curta", "curta")));
  assert(!(await chaveValida(CHAVE, undefined)));
});
Deno.test("lê chave por x-api-key ou Bearer", () => {
  assert(chaveDoPedido(new Headers({ "x-api-key": "abc" })) === "abc");
  assert(chaveDoPedido(new Headers({ Authorization: "Bearer xyz" })) === "xyz");
  assert(chaveDoPedido(new Headers()) === null);
});
Deno.test("valida parâmetros e limita a 200 por página", () => {
  assert(lerConsulta(new URLSearchParams()).limite === 50);
  for (const q of ["limite=201", "limite=0", "id=abc", "offset=-1", "atualizado_desde=ontem", "fonte=a;b"]) {
    let erro = false; try { lerConsulta(new URLSearchParams(q)); } catch (e) { erro = e instanceof ApiError && e.status === 400; }
    assert(erro, q);
  }
});
const comStatus = () => [base(), base({ id: "2", status_curadoria: "rascunho" }), base({ id: "3", status_curadoria: "em_revisao" }), base({ id: "4", status_curadoria: "descartado" })];
Deno.test("por padrão traz publicados e pendentes, nunca descartados", () => {
  const r = filtrarLista(comStatus(), lerConsulta(new URLSearchParams()));
  assert(r.total === 3 && !r.itens.some(e => e.id === "4"));
  assert(r.itens.find(e => e.id === "2")?.status_curadoria === "rascunho");
});
Deno.test("status=publicado e status=pendentes separam os escopos", () => {
  assert(filtrarLista(comStatus(), lerConsulta(new URLSearchParams("status=publicado"))).itens.map(e => e.id).join() === "1");
  assert(filtrarLista(comStatus(), lerConsulta(new URLSearchParams("status=pendentes"))).total === 2);
  let erro = false; try { lerConsulta(new URLSearchParams("status=descartado")); } catch (e) { erro = e instanceof ApiError && e.status === 400; }
  assert(erro);
});
Deno.test("nunca expõe embedding nem quem confirmou o valor", () => {
  const json = JSON.stringify(filtrarLista(comStatus(), lerConsulta(new URLSearchParams())));
  assert(!json.includes("embedding") && !json.includes("user-1"));
});
Deno.test("filtra por fonte, busca sem acento e data de atualização", () => {
  const rows = [base(), base({ id: "2", titulo: "Inovação", oe_fonte: { slug: "cnpq", nome: "CNPq" }, updated_at: "2026-11-10T00:00:00Z" })];
  assert(filtrarLista(rows, lerConsulta(new URLSearchParams("fonte=cnpq"))).itens[0].id === "2");
  assert(filtrarLista(rows, lerConsulta(new URLSearchParams("busca=inovacao"))).total === 1);
  assert(filtrarLista(rows, lerConsulta(new URLSearchParams("atualizado_desde=2026-11-05"))).total === 1);
});
Deno.test("valor numérico só quando confirmado e total ou estimado", () => {
  assert(formatarValor({ valor_tipo: "total", valor_total_reais: 1000, valor_confirmado_em: "2026-11-01" }).total_reais === 1000);
  assert(formatarValor({ valor_tipo: "total", valor_total_reais: 1000, valor_confirmado_em: null }).total_reais === null);
  assert(formatarValor({ valor_tipo: "por_agencia", valor_total_reais: 1000, valor_confirmado_em: "2026-11-01" }).total_reais === null);
  assert(formatarValor({ valor_tipo: "nao_informado", valor_total_reais: null, valor_confirmado_em: null }).total_reais === null);
});
Deno.test("detalhe marca eventos ainda não liberados", () => {
  const d = formatarDetalhe(base(), [], [{ tipo: "errata", ocorrido_em: "2026-11-01", liberado: true }, { tipo: "prazo_alterado", ocorrido_em: "2026-11-02", liberado: false }]);
  assert(d.eventos.length === 2 && d.eventos[0].liberado === true && d.eventos[1].liberado === false);
});
