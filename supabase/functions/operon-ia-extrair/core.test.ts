import { requireCurator, ExtractionError, extractAndGenerate, generateWithFallback, validateAI, fieldState, eligibleProposals, trustedPDFUrl, publicIP } from "./core.ts";
const assert = (v: unknown, message = "Assertion failed") => { if (!v) throw new Error(message); };
const source = "Pesquisa em instituições públicas. Submissões no edital.";
const valid = JSON.stringify({ objetivo: { valor: "Pesquisa em instituições públicas.", trecho_origem: "Pesquisa em instituições públicas." } });
Deno.test("não curador recebe 403 antes de qualquer extração", async () => {
  let denied = false;
  try { await requireCurator("Bearer user-token", async () => true, async () => false); }
  catch (e) { denied = e instanceof ExtractionError && e.status === 403; }
  assert(denied);
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