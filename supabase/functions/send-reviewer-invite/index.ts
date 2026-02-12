import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { inviteId, orgId, inviteCode } = await req.json();
    if (!inviteId || !orgId) throw new Error("Missing inviteId or orgId");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get invite with staging data
    const { data: invite, error: invErr } = await adminClient
      .from("reviewer_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("org_id", orgId)
      .single();
    if (invErr || !invite) throw new Error("Invite not found");

    // Get org name
    const { data: org } = await adminClient.from("organizations").select("name").eq("id", orgId).single();

    // Generate token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await hashToken(token);

    // Update invite with token
    await adminClient
      .from("reviewer_invites")
      .update({ token_hash: tokenHash })
      .eq("id", inviteId);

    // If a custom invite code was provided, update it
    if (inviteCode) {
      await adminClient
        .from("reviewer_invites")
        .update({ invite_code: inviteCode.toUpperCase().trim() })
        .eq("id", inviteId);
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      organization_id: orgId,
      entity: "reviewer",
      entity_id: inviteId,
      action: "REVIEWER_INVITE_SENT",
      metadata_json: { email: invite.email },
    });

    // Send email
    const fullName = invite.full_name || invite.email;
    const appUrl = req.headers.get("origin") || "https://proponente-pro.lovable.app";
    const inviteUrl = `${appUrl}/invite/reviewer?token=${token}`;
    const activateUrl = `${appUrl}/reviewer/activate`;
    const codeDisplay = invite.invite_code || inviteCode || null;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "ProjetoGO <onboarding@resend.dev>",
        to: [invite.email],
        subject: `Convite para Avaliador — ${org?.name || "ProjetoGO"}`,
        html: `
          <!DOCTYPE html><html><head><meta charset="utf-8">
          <style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}.container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}.header{background:#1a1a2e;color:#fff;padding:32px;text-align:center}.header h1{margin:0;font-size:22px}.content{padding:32px}.cta{text-align:center;margin:32px 0 16px}.cta a{background:#3b82f6;color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block}.footer{text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9}</style>
          </head><body><div class="container">
            <div class="header"><h1>📋 Convite para Avaliador</h1></div>
            <div class="content">
              <p>Olá, <strong>${fullName}</strong>,</p>
              <p>Você foi convidado(a) pela organização <strong>${org?.name || "—"}</strong> para atuar como avaliador(a) no ProjetoGO.</p>
              <div class="cta"><a href="${inviteUrl}">Aceitar Convite</a></div>
              ${codeDisplay ? `<p style="text-align:center;color:#475569;font-size:14px;margin-top:8px;">Ou use o código: <strong style="font-family:monospace;font-size:16px;letter-spacing:2px;">${codeDisplay}</strong><br/>em <a href="${activateUrl}">${activateUrl}</a></p>` : ''}
              <p style="color:#64748b;font-size:14px;">Este convite é válido por 7 dias.</p>
            </div>
            <div class="footer"><p>ProjetoGO — Email automático, não responda.</p></div>
          </div></body></html>`,
      });
    }

    return new Response(JSON.stringify({ success: true, inviteUrl, inviteCode: codeDisplay }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending reviewer invite:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);
