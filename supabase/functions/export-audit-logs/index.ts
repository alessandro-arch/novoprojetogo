import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user with anon client
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, format, entity_filter } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is org staff
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    const { data: globalRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "icca_admin")
      .maybeSingle();

    const isStaff = globalRole || (membership && ["org_admin", "edital_manager"].includes(membership.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch logs
    let query = adminClient
      .from("audit_logs")
      .select("*")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (entity_filter) {
      query = query.eq("entity", entity_filter);
    }

    const { data: logs, error: logsError } = await query;
    if (logsError) throw logsError;

    const ENTITY_LABELS: Record<string, string> = {
      edital: "Edital",
      proposal: "Proposta",
      review_assignment: "Designação",
      review: "Avaliação",
      proposal_decision: "Parecer",
      scoring_criteria: "Critério",
    };

    const ROLE_LABELS: Record<string, string> = {
      icca_admin: "Admin ICCA",
      org_admin: "Admin Org",
      edital_manager: "Gestor",
      proponente: "Proponente",
      reviewer: "Avaliador",
    };

    if (format === "csv") {
      const header = "Data/Hora,Entidade,Ação,Papel,ID Entidade,Detalhes";
      const rows = (logs || []).map((log: any) => {
        const date = new Date(log.created_at).toLocaleString("pt-BR");
        const entity = ENTITY_LABELS[log.entity] || log.entity;
        const action = log.action;
        const role = log.user_role ? (ROLE_LABELS[log.user_role] || log.user_role) : "Sistema";
        const entityId = log.entity_id || "";
        const meta = log.metadata_json ? JSON.stringify(log.metadata_json) : "";
        return `"${date}","${entity}","${action}","${role}","${entityId}","${meta.replace(/"/g, '""')}"`;
      });

      const csv = [header, ...rows].join("\n");
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=audit-logs.csv",
        },
      });
    }

    if (format === "pdf") {
      // Generate a simple HTML-based PDF
      const tableRows = (logs || []).map((log: any) => {
        const date = new Date(log.created_at).toLocaleString("pt-BR");
        const entity = ENTITY_LABELS[log.entity] || log.entity;
        const parts = log.action.split(".");
        const op = parts[1] === "insert" ? "Criação" : parts[1] === "update" ? "Alteração" : parts[1] === "delete" ? "Exclusão" : parts[1];
        const role = log.user_role ? (ROLE_LABELS[log.user_role] || log.user_role) : "Sistema";
        const entityId = log.entity_id ? log.entity_id.slice(0, 8) + "..." : "";
        let details = "";
        if (log.metadata_json?.old_status) {
          details = `${log.metadata_json.old_status} → ${log.metadata_json.new_status}`;
        }
        return `<tr><td>${date}</td><td>${entity}</td><td>${op}</td><td>${role}</td><td>${entityId}</td><td>${details}</td></tr>`;
      }).join("");

      const html = `
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Trilha de Auditoria</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
  h1 { font-size: 18px; color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px; }
  .meta { color: #666; margin-bottom: 16px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1a2e; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .footer { margin-top: 20px; text-align: center; color: #999; font-size: 9px; }
</style>
</head><body>
<h1>🔒 Trilha de Auditoria — ProjetoGO</h1>
<p class="meta">Gerado em: ${new Date().toLocaleString("pt-BR")} · Total de registros: ${(logs || []).length}</p>
<table>
<tr><th>Data/Hora</th><th>Entidade</th><th>Ação</th><th>Papel</th><th>ID</th><th>Detalhes</th></tr>
${tableRows}
</table>
<p class="footer">Documento gerado automaticamente. Registros imutáveis — não editáveis após gravação.</p>
</body></html>`;

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": "attachment; filename=audit-logs.html",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Formato inválido. Use 'csv' ou 'pdf'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error exporting audit logs:", err);
    return new Response(JSON.stringify({ error: "Erro ao exportar logs de auditoria." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
