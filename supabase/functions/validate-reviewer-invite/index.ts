import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) throw new Error("Missing token");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const tokenHash = await hashToken(token);

    const { data: invite, error } = await adminClient
      .from("reviewer_invites").select("*").eq("token_hash", tokenHash).is("used_at", null).single();

    if (error || !invite) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já utilizado." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou. Solicite um novo à organização." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Return invite staging data directly
    return new Response(JSON.stringify({
      invite: { id: invite.id, expires_at: invite.expires_at },
      reviewer: {
        full_name: invite.full_name || null,
        email: invite.email,
        institution: invite.institution || null,
      },
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error validating invite:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);
