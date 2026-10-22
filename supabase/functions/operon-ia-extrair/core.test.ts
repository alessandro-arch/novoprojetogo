import { requireCurator, ExtractionError, extractAndGenerate, generateWithFallback, callOpenRouter, DEFAULT_MODEL, FALLBACK_MODEL, RATE_MESSAGE, validateAI, fieldState, eligibleProposals, trustedPDFUrl, publicIP, collectPDFText, MAX_TEXT_CHARS, BodySchema } from "./core.ts";
const assert = (v: unknown, message = "Assertion failed") => { if (!v) throw new Error(message); };
const source = "Pesquisa em instituições públicas. Submissões no edital.";
const valid = JSON.stringify({ objetivo: { valor: "Pesquisa em instituições públicas.", trecho_origem: "Pesquisa em instituições públicas." } });
Deno.test("coleta todos os lotes em ordem antes de chamar IA, sem truncar", async () => {
  const pages: number[] = [];
  const source = await collectPDFText(async start => { pages.push(start); return { text: `lote ${start}`, next: start === 1 ? 5 : null, totalPages: 8 }; });
  assert(pages.join(",") === "1,5" && source === "lote 1\nlote 5");
});
Deno.test("lote vazio não chama IA e erro de limite não vira erro genérico", async () => {
  let called = false;
  for (const read of [async () => ({ text: " ", next: null, totalPages: 1 }), async () => ({ text: "x".repeat(MAX_TEXT_CHARS + 1), next: null, totalPages: 1 })]) {
    let denied = false;
    try { await extractAndGenerate(new Uint8Array(1), () => collectPDFText(read), async () => { called = true; return {}; }); }
    catch (e) { denied = e instanceof ExtractionError && (e.status === 413 || e.message === "PDF sem texto extraível"); }
    assert(denied && !called);
  }
});
Deno.test("rejeita lotes repetidos, documento alterado e páginas acima do limite", async () => {
  for (const read of [async () => ({ text: "a", next: 1, totalPages: 8 }), async () => ({ text: "a", next: null, totalPages: 201 }), async (start: number) => ({ text: "a", next: start === 1 ? 5 : null, totalPages: start === 1 ? 8 : 9 })]) {
    let denied = false;
    try { await collectPDFText(read); } catch (e) { denied = e instanceof ExtractionError && e.status === 422; }
    assert(denied);
  }
});
Deno.test("entrada de extração aceita só id e pagina, nunca texto ou URL arbitrários", () => {
  const input = { edital_id: "138515d7-5e56-4932-93f8-bfde58e54462", etapa: "extrair_pdf", pagina: 1 };
  assert(BodySchema.safeParse(input).success);
  assert(!BodySchema.safeParse({ ...input, texto: "fonte inventada" }).success);
  assert(!BodySchema.safeParse({ ...input, pagina: 0 }).success);
});
Deno.test("usa DeepSeek v4.1 Flash na primeira chamada e na nova tentativa", async () => {
  assert(DEFAULT_MODEL === "deepseek/deepseek-v4.1-flash");
  assert(FALLBACK_MODEL === "deepseek/deepseek-v4.1-flash");
  const calls: string[] = [];
  const result = await generateWithFallback(source, [DEFAULT_MODEL, FALLBACK_MODEL], async model => {
    calls.push(model);
    return calls.length === 1 ? "invalid" : valid;
  });
  assert(calls.length === 2 && calls.every(model => model === "deepseek/deepseek-v4.1-flash"));
  assert(result.modelo === "deepseek/deepseek-v4.1-flash" && Boolean(result.propostas.objetivo));
});
Deno.test("não curador recebe 403 antes de qualquer extração", async () => {
  let denied = false;
  try { await requireCurator("Bearer user-token", async () => true, async () => false); }
  catch (e) { denied = e instanceof ExtractionError && e.status === 403; }
  assert(denied);
});
Deno.test("TLDR sintetizado aceita evidência literal separada até 300 caracteres", () => {
  const summary = "A chamada apoia pesquisa. Instituições públicas podem participar. As submissões seguem o edital.";
  const result = validateAI(JSON.stringify({ resumo_tldr: { valor: summary, trecho_origem: "Pesquisa em instituições públicas." } }), source);
  assert(result.resumo_tldr?.valor === summary && result.resumo_tldr.trecho_origem === "Pesquisa em instituições públicas.");
  assert(eligibleProposals(result, { resumo_tldr: null }, false).resumo_tldr?.valor === summary);
  assert(!eligibleProposals(result, { resumo_tldr: "Resumo curado completo." }, false).resumo_tldr);
  assert(eligibleProposals(result, { resumo_tldr: "Resumo curado completo." }, true).resumo_tldr?.valor === summary);
});
Deno.test("TLDR sem evidência literal ou com evidência longa continua rejeitado", () => {
  for (const excerpt of ["Síntese inventada.", "x".repeat(301)]) {
    let failed = false;
    try { validateAI(JSON.stringify({ resumo_tldr: { valor: "Resumo científico.", trecho_origem: excerpt } }), source); }
    catch (e) { failed = e instanceof ExtractionError && e.status === 422; }
    assert(failed);
  }
});
Deno.test("JWT inválido recebe 401 sem consultar permissão", async () => {
  let queried = false, denied = false;
  try { await requireCurator("Bearer invalid", async () => false, async () => { queried = true; return true; }); }
  catch (e) { denied = e instanceof ExtractionError && e.status === 401; }
  assert(denied && !queried);
});
Deno.test("PDF sem texto não chama IA", async () => {
  let called = false, denied = false;
  try { await extractAndGenerate(new Uint8Array([1]), async () => " \n", async () => { called = true; return {}; }); }
  catch (e) { denied = e instanceof ExtractionError && e.message === "PDF sem texto extraível"; }
  assert(denied && !called);
});
Deno.test("JSON inválido usa reserva exatamente uma vez", async () => {
  const calls: string[] = [];
  const result = await generateWithFallback(source, ["primary", "fallback"], async m => { calls.push(m); return m === "primary" ? "invalid" : valid; });
  assert(calls.join(",") === "primary,fallback" && result.modelo === "fallback" && result.propostas.objetivo?.valor === "Pesquisa em instituições públicas.");
});
Deno.test("duas respostas inválidas não fazem terceira tentativa", async () => {
  let count = 0, failed = false;
  try { await generateWithFallback(source, ["primary", "fallback"], async () => { count++; return "invalid"; }); } catch { failed = true; }
  assert(failed && count === 2);
});
Deno.test("campos cortados: reticências, menos de 150 sem ponto, vazio e íntegro", () => {
  assert(fieldState("Texto...").atual_cortado);
  assert(fieldState("Texto breve sem ponto").atual_cortado);
  assert(fieldState(" ").atual_vazio);
  assert(!fieldState("Texto breve completo.").atual_cortado);
  assert(!fieldState("x".repeat(150)).atual_cortado);
  assert(!fieldState("nacional", true).atual_cortado);
});
Deno.test("padrão não substitui texto íntegro; sobrescrever permite", () => {
  const p = validateAI(valid, source);
  assert(!eligibleProposals(p, { objetivo: "Texto íntegro." }, false).objetivo);
  assert(Boolean(eligibleProposals(p, { objetivo: "Texto íntegro." }, true).objetivo));
  assert(eligibleProposals(p, { objetivo: "Texto..." }, false).objetivo?.atual_cortado);
});
Deno.test("descarta enum inválido e origem inventada preservando campo válido", () => {
  const p = validateAI(JSON.stringify({ objetivo: { valor: "Objetivo", trecho_origem: source }, abrangencia: { valor: "local", trecho_origem: source }, recursos: { valor: "Milhões", trecho_origem: "Texto inventado" } }), source);
  assert(Boolean(p.objetivo) && !p.abrangencia && !p.recursos);
});
Deno.test("URLs internas e externas não oficiais são bloqueadas", () => {
  for (const url of ["https://127.0.0.1/a.pdf", "http://fapes.es.gov.br/a.pdf", "https://fapes.es.gov.br.evil.com/a.pdf"]) {
    let denied = false; try { trustedPDFUrl(url); } catch { denied = true; } assert(denied);
  }
  assert(trustedPDFUrl("https://fapes.es.gov.br/a.pdf").hostname === "fapes.es.gov.br");
  assert(!publicIP("10.0.0.1") && !publicIP("169.254.169.254") && !publicIP("::1") && !publicIP("::ffff:127.0.0.1"));
});
Deno.test("desativa raciocínio para obter JSON completo dentro do prazo", async () => {
  let body: Record<string, unknown> = {};
  const content = await callOpenRouter(source, "fallback", "https://openrouter.ai/api/v1/", "test-only", async (input, init) => {
    assert(input === "https://openrouter.ai/api/v1/chat/completions");
    body = JSON.parse(String(init && "body" in init ? init.body : undefined));
    return Response.json({ choices: [{ message: { content: valid }, finish_reason: "stop" }] });
  });
  assert((body.reasoning as { enabled: boolean }).enabled === false);
  assert(body.temperature === 0.1 && body.max_tokens === 16000 && content === valid);
  const format = body.response_format as { type: string; json_schema: { strict: boolean; schema: { properties: { resumo_tldr: { properties: { trecho_origem: { maxLength: number } } } } } } };
  assert(format.type === "json_schema" && format.json_schema.strict === true);
  assert(format.json_schema.schema.properties.resumo_tldr.properties.trecho_origem.maxLength === 300);
});
Deno.test("modelo gratuito indisponível usa reserva e retorna sugestões validadas", async () => {
  const calls: string[] = [], failures: number[] = [];
  const result = await generateWithFallback(source, ["free", "fallback"], model => callOpenRouter(source, model, "https://openrouter.ai/api/v1", "test-only", async () => {
    calls.push(model);
    return model === "free" ? Response.json({ error: "private provider payload" }, { status: 404 }) : Response.json({ choices: [{ message: { content: valid }, finish_reason: "stop" }] });
  }), (_model, status) => failures.push(status));
  assert(calls.join(",") === "free,fallback" && failures.join(",") === "503");
  assert(result.modelo === "fallback" && result.propostas.objetivo?.valor === "Pesquisa em instituições públicas.");
});
Deno.test("timeout recebe mensagem específica e não erro 502 genérico", async () => {
  let failed = false;
  try { await callOpenRouter(source, "fallback", "https://openrouter.ai/api/v1", "test-only", async () => { throw new DOMException("timeout", "TimeoutError"); }); }
  catch (e) { failed = e instanceof ExtractionError && e.status === 504 && e.message.includes("tempo de resposta"); }
  assert(failed);
});
Deno.test("limite 429 não é ocultado pela indisponibilidade do reserva", async () => {
  let failed = false;
  try { await generateWithFallback(source, ["free", "fallback"], model => callOpenRouter(source, model, "https://openrouter.ai/api/v1", "test-only", async () => Response.json({}, { status: model === "free" ? 429 : 404 }))); }
  catch (e) { failed = e instanceof ExtractionError && e.status === 429 && e.message === RATE_MESSAGE; }
  assert(failed);
});
Deno.test("respostas truncadas, malformadas e vazias são rejeitadas", async () => {
  for (const payload of ["invalid", { choices: [] }, { choices: [{ message: { content: " " } }] }, { choices: [{ message: { content: valid }, finish_reason: "length" }] }]) {
    let failed = false;
    try { await callOpenRouter(source, "fallback", "https://openrouter.ai/api/v1", "test-only", async () => typeof payload === "string" ? new Response(payload) : Response.json(payload)); }
    catch (e) { failed = e instanceof ExtractionError && e.status === 422; }
    assert(failed);
  }
});
Deno.test("falhas de autorização e saldo não revelam resposta do provedor", async () => {
  for (const status of [401, 403, 402]) {
    let failed = false;
    try { await callOpenRouter(source, "fallback", "https://openrouter.ai/api/v1", "test-only", async () => Response.json({ error: "private payload" }, { status })); }
    catch (e) { failed = e instanceof ExtractionError && e.status === 503 && !e.message.includes("private payload"); }
    assert(failed);
  }
});
Deno.test("tempo esgotado não repete o documento inteiro no modelo reserva", async () => {
  let calls = 0;
  let failed = false;
  try { await generateWithFallback("texto", ["a", "b"], () => { calls++; return Promise.reject(new ExtractionError(504, "tempo de resposta")); }); }
  catch (e) { failed = e instanceof ExtractionError && e.status === 504; }
  if (!failed || calls !== 1) throw new Error("Repetiu após tempo esgotado");
});
