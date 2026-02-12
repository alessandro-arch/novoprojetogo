import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) { attempts.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  entry.count++;
  return entry.count <= 5;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invite_code } = await req.json();
    if (!invite_code) throw new Error("Missing invite_code");

    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 1 minuto." }), { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const code = invite_code.toUpperCase().trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: invite, error } = await adminClient
      .from("reviewer_invites").select("*").eq("invite_code", code).is("used_at", null).single();

    if (error || !invite) {
      return new Response(JSON.stringify({ error: "Código não encontrado ou já utilizado." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou. Solicite um novo à organização." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Get org name
    const { data: org } = await adminClient.from("organizations").select("name").eq("id", invite.org_id).single();

    // Return invite staging data (no need to query reviewers table)
    return new Response(JSON.stringify({
      invite: { id: invite.id, expires_at: invite.expires_at, org_id: invite.org_id },
      reviewer: {
        full_name: invite.full_name || null,
        email: invite.email,
        institution: invite.institution || null,
      },
      org_name: org?.name || "",
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error validating code:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
