import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScoreInput {
  criteriaName: string;
  criteriaDescription: string | null;
  maxScore: number;
  weight: number;
  score: number;
  comment: string;
}

interface RequestBody {
  scores: ScoreInput[];
  recommendation: string;
  overallScore: number;
  knowledgeArea: string | null;
  editalTitle: string;
  proposalContent: Record<string, string> | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scores, recommendation, overallScore, knowledgeArea, editalTitle, proposalContent } =
      (await req.json()) as RequestBody;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const recommendationLabel: Record<string, string> = {
      approved: "Aprovado",
      approved_with_reservations: "Aprovado com ressalvas",
      not_approved: "Não aprovado",
    };

    const criteriaBlock = scores
      .map(
        (s) =>
          `- ${s.criteriaName} (peso ${s.weight}, máx ${s.maxScore}): nota ${s.score}${s.comment ? ` — "${s.comment}"` : ""}`
      )
      .join("\n");

    const proposalBlock = proposalContent
      ? Object.entries(proposalContent)
          .map(([k, v]) => `${k}: ${String(v).substring(0, 500)}`)
          .join("\n")
      : "Conteúdo não disponível.";

    const systemPrompt = `Você é um especialista acadêmico brasileiro que redige pareceres técnicos de avaliação para editais institucionais. 
Seu trabalho é gerar uma MINUTA de parecer formal, técnica e imparcial, baseada exclusivamente nos critérios, notas e comentários fornecidos.

Regras obrigatórias:
- Nunca mencione nomes de pessoas, instituições ou qualquer dado identificável
- Sempre se refira à proposta pelo código cego ou como "a proposta avaliada"
- Use linguagem formal acadêmica brasileira
- Estruture o parecer em seções: Introdução, Análise por Critério, Considerações Finais e Recomendação
- Seja objetivo, fundamentado nas notas e comentários fornecidos
- A minuta deve ter entre 300 e 600 palavras`;

    const userPrompt = `Gere uma minuta de parecer para a seguinte avaliação:

Edital: ${editalTitle}
Área do conhecimento: ${knowledgeArea || "Não especificada"}
Recomendação: ${recommendationLabel[recommendation] || recommendation}
Nota ponderada final: ${overallScore}

Critérios avaliados:
${criteriaBlock}

Resumo do conteúdo da proposta:
${proposalBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-review-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
