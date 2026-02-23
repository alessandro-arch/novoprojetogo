import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(
        JSON.stringify({ error: "Submissão não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get edital
    const { data: edital } = await adminClient
      .from("editais")
      .select("organization_id, title")
      .eq("id", (submission as any).edital_id)
      .single();

    if (!edital) {
      return new Response(JSON.stringify({ error: "Edital não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify permissions
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", edital.organization_id)
      .single();

    const { data: globalRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "icca_admin")
      .maybeSingle();

    const isStaff =
      globalRole ||
      (membership &&
        ["org_admin", "edital_manager"].includes(membership.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch audit logs for this submission
    const { data: logs } = await adminClient
      .from("audit_logs")
      .select("*")
      .eq("entity_id", submission_id)
      .order("created_at", { ascending: true })
      .limit(500);

    // Get exporter profile
    const { data: exporterProfile } = await adminClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .single();

    const ROLE_LABELS: Record<string, string> = {
      icca_admin: "Admin ICCA",
      org_admin: "Admin Org",
      edital_manager: "Gestor",
      proponente: "Proponente",
      reviewer: "Avaliador",
    };

    const logsRows = (logs || [])
      .map((log: any) => {
        const date = new Date(log.created_at).toLocaleString("pt-BR");
        const role = log.actor_role
          ? ROLE_LABELS[log.actor_role] || log.actor_role
          : log.user_role
          ? ROLE_LABELS[log.user_role] || log.user_role
          : "Sistema";
        const action = log.action || "";
        const diffHtml = log.diff
          ? `<pre style="font-size:9px;margin:0;white-space:pre-wrap">${JSON.stringify(log.diff, null, 2)}</pre>`
          : "";
        const hashBadge = log.log_hash
          ? `<span style="font-size:8px;color:#888">${log.log_hash.slice(0, 12)}…</span>`
          : "";
        return `<tr><td>${date}</td><td>${action}</td><td>${role}</td><td>${diffHtml}</td><td>${hashBadge}</td></tr>`;
      })
      .join("");

    const sub = submission as any;
    const integrityColor =
      sub.integrity_status === "VERIFIED"
        ? "#22c55e"
        : sub.integrity_status === "MISMATCH"
        ? "#ef4444"
        : "#9ca3af";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório de Auditoria</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#222}
h1{font-size:16px;color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px}
h2{font-size:13px;margin-top:20px;color:#333}
.meta{font-size:10px;color:#666;margin-bottom:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;color:white}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#1a1a2e;color:white;padding:4px 6px;text-align:left;font-size:9px}
td{padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px;vertical-align:top}
tr:nth-child(even){background:#f9f9f9}
.footer{margin-top:24px;border-top:1px solid #ccc;padding-top:6px;font-size:9px;color:#999;text-align:center}
pre{background:#f5f5f5;padding:4px;border-radius:3px;overflow:hidden}
</style></head><body>
<h1>🔒 Relatório de Auditoria — ProjetoGO</h1>
<div class="meta">
<p><strong>Edital:</strong> ${edital.title}</p>
<p><strong>Protocolo:</strong> ${sub.protocol || "—"}</p>
<p><strong>ID Submissão:</strong> ${sub.id}</p>
<p><strong>Submetido em:</strong> ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString("pt-BR") : "—"}</p>
</div>

<h2>Integridade Criptográfica</h2>
<p>
  <span class="badge" style="background:${integrityColor}">${sub.integrity_status || "PENDING"}</span>
</p>
<table>
<tr><td style="width:30%;font-weight:bold">integrity_hash (SHA-256)</td><td style="font-family:monospace;font-size:9px">${sub.integrity_hash || "—"}</td></tr>
<tr><td style="font-weight:bold">pdf_integrity_hash (SHA-256)</td><td style="font-family:monospace;font-size:9px">${sub.pdf_integrity_hash || "—"}</td></tr>
</table>

<h2>Timeline de Auditoria (${(logs || []).length} registros)</h2>
<table>
<tr><th>Data/Hora</th><th>Ação</th><th>Papel</th><th>Diff</th><th>Hash</th></tr>
${logsRows}
</table>

<div class="footer">
<p>Exportado por: ${exporterProfile?.full_name || user.email || user.id} em ${new Date().toLocaleString("pt-BR")}</p>
<p>Documento gerado automaticamente — ProjetoGO</p>
</div></body></html>`;

    // Log the export
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      organization_id: edital.organization_id,
      entity: "submission",
      entity_id: submission_id,
      action: "EXPORT_PDF",
      entity_type: "submission",
      actor_role: membership?.role || globalRole?.role || "unknown",
      metadata_json: { export_type: "audit_report" },
    } as any);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename=audit-report-${submission_id.slice(0, 8)}.html`,
      },
    });
  } catch (err) {
    console.error("Error exporting audit report:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao exportar relatório." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
