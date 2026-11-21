import { createClient } from "npm:@supabase/supabase-js@2";
import { ApiError, chaveDoPedido, chaveValida, filtrarLista, formatarDetalhe, lerConsulta } from "./core.ts";

// API somente leitura para ferramentas externas (ex.: Claude Code). Sem CORS: não é para navegador.
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const SELECT = "id,titulo,numero,ano,orgao,situacao,abrangencia,categoria,tipo,areas,resumo_tldr,objetivo,quem_pode,recursos,contrapartida,requisitos_ies,restricao_ies,valor_tipo,valor_total_reais,valor_confirmado_em,valor_observacao,url_oficial,publicado_em,verificado_em,updated_at,status_curadoria,oe_fonte(slug,nome,esfera,uf),oe_rodada(ordem,abertura,prazo_fim,resultado_em,observacao)";

Deno.serve(async req => {
  if (req.method !== "GET") return json({ error: "Use GET." }, 405);
  try {
    if (!(await chaveValida(chaveDoPedido(req.headers), Deno.env.get("OPERON_API_KEY")))) throw new ApiError(401, "Chave de acesso inválida ou ausente.");
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) throw new ApiError(503, "Serviço temporariamente indisponível.");
    const consulta = lerConsulta(new URL(req.url).searchParams);
    const db = createClient(url, service, { auth: { persistSession: false } });

    if (consulta.id) {
      const { data: edital, error } = await db.from("oe_edital").select(SELECT).eq("id", consulta.id).eq("status_curadoria", "publicado").maybeSingle();
      if (error) throw error;
      if (!edital) throw new ApiError(404, "Edital não encontrado ou não publicado.");
      const [docs, evs] = await Promise.all([
        db.from("oe_documento").select("tipo,rotulo,url,versao,publicado_em,substituido").eq("edital_id", consulta.id).order("publicado_em", { ascending: false }),
        db.from("oe_evento").select("tipo,ocorrido_em,liberado,valor_anterior,valor_novo").eq("edital_id", consulta.id).eq("liberado", true).order("ocorrido_em", { ascending: false }),
      ]);
      if (docs.error) throw docs.error;
      if (evs.error) throw evs.error;
      return json(formatarDetalhe(edital, docs.data ?? [], evs.data ?? []));
    }

    const { data, error } = await db.from("oe_edital").select(SELECT).eq("status_curadoria", "publicado").limit(5000);
    if (error) throw error;
    const { total, itens } = filtrarLista(data ?? [], consulta);
    return json({ total, limite: consulta.limite, offset: consulta.offset, itens });
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error("operon-editais-api", e instanceof Error ? e.name : "erro");
    return json({ error: "Falha ao consultar editais." }, 500);
  }
});
