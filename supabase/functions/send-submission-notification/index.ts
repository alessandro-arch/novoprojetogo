import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  submissionId: string;
  protocol: string;
  editalTitle: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { submissionId, protocol, editalTitle }: NotificationRequest = await req.json();
    if (!submissionId || !protocol || !editalTitle) {
      throw new Error("Missing required fields");
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const recipientEmail = profile?.email || user.email;
    const recipientName = profile?.full_name || "Proponente";

    if (!recipientEmail) {
      throw new Error("No email found for user");
    }

    const appUrl = req.headers.get("origin") || "https://proponente-pro.lovable.app";
    const viewUrl = `${appUrl}/proponente`;

    const emailResponse = await resend.emails.send({
      from: "ProjetoGO <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `Proposta submetida com sucesso — Protocolo ${protocol}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
            .header { background: #1a1a2e; color: #fff; padding: 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { padding: 32px; }
            .protocol-box { background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
            .protocol-box .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .protocol-box .value { font-size: 28px; font-weight: bold; color: #1e40af; font-family: monospace; margin-top: 8px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
            .info-label { color: #64748b; font-size: 14px; }
            .info-value { color: #1e293b; font-size: 14px; font-weight: 500; }
            .cta { text-align: center; margin: 32px 0 16px; }
            .cta a { background: #3b82f6; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; }
            .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Proposta Submetida</h1>
            </div>
            <div class="content">
              <p>Olá, <strong>${recipientName}</strong>,</p>
              <p>Sua proposta foi submetida com sucesso ao edital abaixo:</p>
              
              <div class="protocol-box">
                <div class="label">Número do Protocolo</div>
                <div class="value">${protocol}</div>
              </div>

              <div style="margin: 24px 0;">
                <div class="info-row">
                  <span class="info-label">Edital</span>
                  <span class="info-value">${editalTitle}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Data de submissão</span>
                  <span class="info-value">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status</span>
                  <span class="info-value">Submetida</span>
                </div>
              </div>

              <p style="color: #64748b; font-size: 14px;">
                Guarde o número do protocolo para referência futura. Você pode acessar sua proposta a qualquer momento pelo portal.
              </p>

              <div class="cta">
                <a href="${viewUrl}">Acessar Minhas Propostas</a>
              </div>
            </div>
            <div class="footer">
              <p>Este é um email automático do ProjetoGO. Não responda a este email.</p>
              <p>ID da submissão: ${submissionId}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Submission notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
