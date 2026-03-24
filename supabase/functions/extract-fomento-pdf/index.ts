import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  pdfBase64: string;
  type: "project" | "bolsista";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, type } = (await req.json()) as RequestBody;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!pdfBase64) throw new Error("pdfBase64 is required");

    const promptProject = `Extraia do documento e retorne APENAS JSON puro sem markdown:
{ "pesquisador_principal":"", "titulo":"", "edital":"", "orgao_financiador":"",
  "ano":null, "data_assinatura":"YYYY-MM-DD", "vigencia_inicio":"YYYY-MM-DD",
  "vigencia_fim":"YYYY-MM-DD", "valor_total":null,
  "fonte":"publica ou privada", "natureza":"auxilio_financeiro ou bolsa",
  "area":"",
  "rubricas":[{"tipo":"","valor":null}] }
Campos não encontrados retornar null.`;

    const promptBolsista = `Extraia do documento de bolsa e retorne APENAS JSON puro sem markdown:
{ "nome_bolsista":"", "email_bolsista":"", "modalidade":"ic|mestrado|doutorado|pos_doc|apoio_tecnico|extensao",
  "orientador":"", "coorientador":null, "coordenador":"", "edital":"", "orgao_financiador":"",
  "numero_termo":"", "cotas_total":null, "data_inicio":"YYYY-MM-DD", "data_fim":"YYYY-MM-DD",
  "titulo_plano":"", "area_conhecimento":"", "ppg_nome":"" }
NÃO extrair valor_mensal. Campos não encontrados retornar null.`;

    const prompt = type === "bolsista" ? promptBolsista : promptProject;

    // Use Lovable AI gateway with a vision-capable model
    // We encode the PDF content as a data URL and ask the model to extract
    const userMessage = `Analise o seguinte documento PDF codificado em base64 e extraia as informações solicitadas.

O conteúdo do PDF em base64 tem ${pdfBase64.length} caracteres. Aqui estão os primeiros e últimos segmentos para contexto, mas o documento completo será processado.

${prompt}

PDF (base64): ${pdfBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um assistente especializado em extrair dados estruturados de documentos acadêmicos brasileiros (termos de outorga, concessão, formulários de bolsa). Retorne APENAS JSON puro, sem markdown, sem explicações.",
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "document.pdf",
                  file_data: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Clean markdown wrappers if present
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Nenhum JSON válido encontrado na resposta da IA" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-fomento-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
