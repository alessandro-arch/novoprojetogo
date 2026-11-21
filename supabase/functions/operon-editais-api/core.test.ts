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
Deno.test("lista só publicados e nunca expõe embedding nem quem confirmou", () => {
  const r = filtrarLista([base(), base({ id: "2", status_curadoria: "pendente" })], lerConsulta(new URLSearchParams()));
  assert(r.total === 1 && r.itens[0].id === "1");
  const json = JSON.stringify(r);
  assert(!json.includes("embedding") && !json.includes("user-1") && !json.includes("status_curadoria"));
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
Deno.test("detalhe nunca inclui evento não liberado", () => {
  const d = formatarDetalhe(base(), [], [{ tipo: "errata", ocorrido_em: "2026-11-01", liberado: true }, { tipo: "prazo_alterado", ocorrido_em: "2026-11-02", liberado: false }]);
  assert(d.eventos.length === 1 && d.eventos[0].tipo === "errata");
});
