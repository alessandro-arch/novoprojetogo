import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { BodySchema, DEFAULT_MODEL, FALLBACK_MODEL, MAX_PDF_BYTES, ExtractionError, callOpenRouter,
import { serveCors } from "../_shared/cors.ts";
  requireCurator, collectPDFText, generateWithFallback, eligibleProposals, publicIP, trustedPDFUrl, type Proposals } from "./core.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
async function downloadPDF(input: string): Promise<Uint8Array> {
  let url = trustedPDFUrl(input);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const addresses = (await Promise.all(["A", "AAAA"].map(type => Deno.resolveDns(url.hostname, type as "A" | "AAAA").catch(() => [])))).flat();
    if (!addresses.length || addresses.some(ip => !publicIP(ip))) throw new ExtractionError(400, "Endereço do PDF indisponível ou não permitido.");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(25_000), headers: { Accept: "application/pdf" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new ExtractionError(422, "Redirecionamento do PDF inválido.");
      url = trustedPDFUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new ExtractionError(422, "Não foi possível baixar o PDF oficial."); }
    if (Number(response.headers.get("content-length")) > MAX_PDF_BYTES) { await response.body?.cancel(); throw new ExtractionError(413, "PDF excede o limite de 15 MB."); }
    if (!response.body) throw new ExtractionError(422, "PDF vazio.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_PDF_BYTES) throw new ExtractionError(413, "PDF excede o limite de 15 MB.");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new ExtractionError(422, "O link oficial não contém um PDF. Cadastre o documento principal do edital.");
    return bytes;
  }
  throw new ExtractionError(422, "O link do PDF tem redirecionamentos demais.");
}

serveCors(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) throw new ExtractionError(503, "Serviço temporariamente indisponível.");
    const authorization = req.headers.get("Authorization");
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization ?? "" } }, auth: { persistSession: false } });
    await requireCurator(authorization, async token => {
      const { data, error } = await client.auth.getClaims(token);
      return !error && Boolean(data?.claims?.sub);
    }, async () => {
      const { data, error } = await client.rpc("oe_is_curador");
      return !error && data === true;
    });
    let body: unknown;
    try { body = await req.json(); } catch { throw new ExtractionError(400, "Informe edital_id e sobrescrever em JSON."); }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) throw new ExtractionError(400, "edital_id deve ser um UUID e sobrescrever deve ser booleano.");
    const { edital_id, sobrescrever, etapa, pagina } = parsed.data;
    const [edital, document, rounds] = await Promise.all([
      client.from("oe_edital").select("resumo_tldr,objetivo,quem_pode,recursos,contrapartida,restricao_ies,requisitos_ies,abrangencia,valor_total_reais,valor_tipo,url_oficial").eq("id", edital_id).maybeSingle(),
      client.from("oe_documento").select("url").eq("edital_id", edital_id).eq("tipo", "edital").eq("substituido", false).order("versao", { ascending: false }).order("publicado_em", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      client.from("oe_rodada").select("abertura,prazo_fim,resultado_em").eq("edital_id", edital_id),
    ]);
    if (edital.error || document.error || rounds.error) throw new ExtractionError(500, "Não foi possível consultar o edital.");
    if (!edital.data) throw new ExtractionError(404, "Edital não encontrado.");
    const pdfUrl = document.data?.url || edital.data.url_oficial;
    if (!pdfUrl) throw new ExtractionError(422, "Edital sem documento principal ou link oficial.");
    if (etapa === "extrair_pdf") {
      const { extractPDFBatch } = await import("./pdf.ts");
      return json(await extractPDFBatch(await downloadPDF(pdfUrl), pagina));
    }
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new ExtractionError(503, "Configure OPENROUTER_API_KEY nos segredos do projeto.");
    const baseUrl = Deno.env.get("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1";
    const base = new URL(baseUrl);
    if (base.protocol !== "https:" || base.hostname !== "openrouter.ai" || base.username || base.password || (base.port && base.port !== "443")) throw new ExtractionError(503, "OPENROUTER_BASE_URL deve apontar para o OpenRouter oficial via HTTPS.");
    const models: [string, string] = [Deno.env.get("OPENROUTER_MODEL") || DEFAULT_MODEL, Deno.env.get("OPENROUTER_MODEL_FALLBACK") || FALLBACK_MODEL];
    let usedModel = models[0];
    // Self-invocations have independent CPU budgets. Every batch repeats JWT, curator and URL checks.
    const source = await collectPDFText(async start => {
      const response = await fetch(`${url}/functions/v1/operon-ia-extrair`, {
        method: "POST", headers: { Authorization: authorization ?? "", apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ edital_id, etapa: "extrair_pdf", pagina: start }), signal: AbortSignal.timeout(40_000),
      });
      const data = await response.json();
      if (!response.ok) throw new ExtractionError(response.status === 546 ? 422 : response.status,
        response.status === 546 ? "Este PDF exige processamento acima do limite por página. Não foi possível concluir a leitura." :
          typeof data.error === "string" ? data.error : "Não foi possível concluir a leitura do PDF oficial.");
      return data;
    });
      const generated = await generateWithFallback(source, models,
        model => callOpenRouter(source, model, baseUrl, apiKey),
        (model, status) => console.warn(JSON.stringify({ event: "operon_ia_attempt_failed", model, status })));
      usedModel = generated.modelo;
    const proposals = generated.propostas;
    let quota: { used: number; limit: number; remaining: number } | null = null;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        const parsedQuota = z.object({ used: z.number().int().nonnegative(), limit: z.number().int().nonnegative(), remaining: z.number().int().nonnegative() }).safeParse(data.data?.free_model_daily_requests);
        if (parsedQuota.success) quota = parsedQuota.data;
      } else await response.body?.cancel();
    } catch { /* Quota is optional; never expose the key endpoint's response. */ }
    const current = { ...edital.data, rodadas: (rounds.data ?? []).filter(r => r.abertura || r.prazo_fim || r.resultado_em) };
    return json({ propostas: eligibleProposals(proposals as Proposals, current, sobrescrever), modelo: usedModel, free_model_daily_requests: quota });
  } catch (e) {
    // Deliberately no document/provider payload or credentials in logs or error responses.
    return json({ error: e instanceof ExtractionError ? e.message : "Não foi possível gerar sugestões. Tente novamente mais tarde." }, e instanceof ExtractionError ? e.status : 500);
  }
});