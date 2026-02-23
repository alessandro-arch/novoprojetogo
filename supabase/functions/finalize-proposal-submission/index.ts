import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Bytes(data: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalJson(item)).join(",") + "]";
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sorted.map(
    (key) =>
      JSON.stringify(key) +
      ":" +
      canonicalJson((obj as Record<string, unknown>)[key])
  );
  return "{" + pairs.join(",") + "}";
}

function generatePdfHtml(submission: any, editalTitle: string): string {
  const answers = submission.answers || {};
  const answersHtml = Object.entries(answers)
    .map(
      ([key, val]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;width:30%">${key}</td><td style="padding:4px 8px;border:1px solid #ddd">${
          typeof val === "object" ? JSON.stringify(val) : String(val)
        }</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposta ${submission.protocol}</title>
<style>body{font-family:Arial,sans-serif;margin:30px;color:#222}
h1{font-size:16px;border-bottom:2px solid #1a1a2e;padding-bottom:8px}
.meta{font-size:11px;color:#666;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:12px}
.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:8px;font-size:9px;color:#999;text-align:center}</style></head>
<body>
<h1>${editalTitle}</h1>
<div class="meta">
<p><strong>Protocolo:</strong> ${submission.protocol}</p>
<p><strong>ID:</strong> ${submission.id}</p>
<p><strong>Submetido em:</strong> ${submission.submitted_at}</p>
${submission.cnpq_area_code ? `<p><strong>Área CNPq:</strong> ${submission.cnpq_area_code}</p>` : ""}
</div>
<table>${answersHtml}</table>
<div class="footer">
<p>Documento arquivado com integridade criptográfica SHA-256 — ProjetoGO</p>
<p>Gerado em: ${new Date().toISOString()}</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "submission_id obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from("edital_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submissão não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if ((submission as any).user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get edital for org_id and title
    const { data: edital } = await adminClient
      .from("editais")
      .select("organization_id, title")
      .eq("id", (submission as any).edital_id)
      .single();

    const orgId = edital?.organization_id || "unknown";
    const editalTitle = edital?.title || "Edital";

    // Build canonical snapshot
    const snapshotData = {
      answers: (submission as any).answers,
      cnpq_area_code: (submission as any).cnpq_area_code,
      edital_id: (submission as any).edital_id,
      form_version_id: (submission as any).form_version_id,
      protocol: (submission as any).protocol,
      submitted_at: (submission as any).submitted_at,
      user_id: (submission as any).user_id,
    };

    const snapshotJson = canonicalJson(snapshotData);
    const integrityHash = await sha256(snapshotJson);

    // Generate PDF HTML
    const pdfHtml = generatePdfHtml(submission, editalTitle);
    const pdfBytes = new TextEncoder().encode(pdfHtml);
    const pdfIntegrityHash = await sha256Bytes(pdfBytes);

    // Upload to archive bucket
    const archivePath = `${orgId}/${(submission as any).edital_id}/${submission_id}.html`;
    const { error: uploadError } = await adminClient.storage
      .from("archive")
      .upload(archivePath, pdfBytes, {
        contentType: "text/html",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // If file already exists, that's ok (immutable)
      if (!uploadError.message?.includes("already exists") && !uploadError.message?.includes("Duplicate")) {
        throw uploadError;
      }
    }

    // Update submission with hashes
    const { error: updateError } = await adminClient
      .from("edital_submissions")
      .update({
        integrity_hash: integrityHash,
        pdf_integrity_hash: pdfIntegrityHash,
        integrity_status: "VERIFIED",
      } as any)
      .eq("id", submission_id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    // Insert audit log
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      organization_id: orgId,
      entity: "submission",
      entity_id: submission_id,
      action: "SUBMIT",
      entity_type: "submission",
      actor_role: "proponente",
      metadata_json: {
        integrity_hash: integrityHash,
        pdf_integrity_hash: pdfIntegrityHash,
        archive_path: archivePath,
      },
    } as any);

    return new Response(
      JSON.stringify({
        integrity_hash: integrityHash,
        pdf_integrity_hash: pdfIntegrityHash,
        archive_path: archivePath,
        integrity_status: "VERIFIED",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error finalizing submission:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao finalizar submissão." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
