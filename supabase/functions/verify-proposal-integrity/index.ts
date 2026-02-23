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

    // Verify user is admin/manager of the org
    const { data: edital } = await adminClient
      .from("editais")
      .select("organization_id")
      .eq("id", (submission as any).edital_id)
      .single();

    if (!edital) {
      return new Response(JSON.stringify({ error: "Edital não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Recalculate integrity hash
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
    const recalculatedHash = await sha256(snapshotJson);
    const storedHash = (submission as any).integrity_hash;

    let status: string;
    let match: boolean;

    if (!storedHash) {
      status = "PENDING";
      match = false;
    } else if (recalculatedHash === storedHash) {
      status = "VERIFIED";
      match = true;
    } else {
      status = "MISMATCH";
      match = false;
    }

    // Update status
    await adminClient
      .from("edital_submissions")
      .update({ integrity_status: status } as any)
      .eq("id", submission_id);

    // Log the verification
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      organization_id: edital.organization_id,
      entity: "submission",
      entity_id: submission_id,
      action: match ? "INTEGRITY_VERIFIED" : "INTEGRITY_MISMATCH",
      entity_type: "submission",
      actor_role: membership?.role || globalRole?.role || "unknown",
      metadata_json: {
        stored_hash: storedHash,
        recalculated_hash: recalculatedHash,
        result: status,
      },
    } as any);

    return new Response(
      JSON.stringify({
        integrity_status: status,
        match,
        stored_hash: storedHash,
        recalculated_hash: recalculatedHash,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error verifying integrity:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao verificar integridade." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
