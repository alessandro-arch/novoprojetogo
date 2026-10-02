import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import { Resend } from "npm:resend@2.0.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SITE = "https://projetogo.innovago.app";

// Envia o link de redefinição de senha pelo Resend (sem o limite por hora do envio padrão).
// Responde sempre "ok" para não revelar se o e-mail existe.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const back = String(body.back ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255) return json({ error: "E-mail inválido." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const key = `reset:${email}`.slice(0, 300);
    const [{ count: byMail }, { count: byIp }] = await Promise.all([
      admin.from("sd_first_access_attempts").select("id", { count: "exact", head: true }).eq("matricula", key).gte("created_at", since),
      ip
        ? admin.from("sd_first_access_attempts").select("id", { count: "exact", head: true }).like("matricula", "reset:%").eq("ip", ip).gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);
    if ((byMail ?? 0) >= 3 || (byIp ?? 0) >= 20)
      return json({ error: "Muitas solicitações. Aguarde 15 minutos e tente novamente." }, 429);
    await admin.from("sd_first_access_attempts").insert({ matricula: key, ip, success: false });

    const suffix = back === "sd" ? "?back=sd" : "";
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: "recovery", email, options: { redirectTo: `${SITE}/reset-password${suffix}` },
    });
    if (lErr || !link?.properties?.action_link) {
      console.error("sd-password-reset link", lErr?.message);
      return json({ ok: true });
    }
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error: sendErr } = await resend.emails.send({
      from: "ProjetoGO <noreply@innovago.app>",
      to: [email],
      subject: "Redefinição de senha, ProjetoGO",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <p>Olá!</p>
        <p>Recebemos um pedido para redefinir a sua senha. Clique no botão abaixo para criar uma nova senha:</p>
        <p><a href="${link.properties.action_link}" style="background:#1e3a5f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Redefinir senha</a></p>
        <p style="color:#666;font-size:12px">Se você não fez este pedido, ignore este e-mail. Sua senha atual continua valendo.</p></div>`,
    });
    if (sendErr) {
      console.error("sd-password-reset resend", sendErr);
      return json({ error: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos." }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("sd-password-reset", e);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
