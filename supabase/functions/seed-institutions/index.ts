import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { fields.push(current); current = ""; continue; }
    current += ch;
  }
  fields.push(current);
  return fields;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if already seeded
    const { count } = await supabase.from("institutions").select("*", { count: "exact", head: true });
    if (count && count > 0) {
      return new Response(JSON.stringify({ success: true, message: "Already seeded", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { csvText } = await req.json();
    if (!csvText) throw new Error("csvText is required");

    const lines = csvText.split("\n");
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = parseCsvLine(line);
      const nome = fields[1]?.trim();
      if (!nome) continue;

      const sigla = fields[2]?.trim();

      rows.push({
        name: nome,
        sigla: sigla && sigla !== "null" ? sigla : null,
        category: fields[3]?.trim() || null,
        organization_type: fields[7]?.trim() || null,
        municipio: fields[9]?.trim() || null,
        uf: fields[10]?.trim() || null,
        is_active: fields[11]?.trim() === "Ativa",
        source: "eMEC",
      });
    }

    // Batch insert
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("institutions").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ success: true, inserted, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
