import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import { Resend } from "npm:resend@2.0.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const GENERIC = "Não foi possível validar a matrícula. Confira os dados ou procure a secretaria do seu programa.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const matricula = String(body.matricula ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const tipo = body.tipo === "professor" ? "professor" : "aluno";
    const table = tipo === "professor" ? "sd_faculty" : "sd_students";
    const rawRedirect = String(body.redirectTo ?? "");
    const redirectTo = /^https:\/\/([a-z0-9-]+\.)*(innovago\.app|lovable\.app)(\/|$)|^http:\/\/localhost(:\d+)?(\/|$)/i.test(rawRedirect)
      ? rawRedirect : "https://projetogo.innovago.app/servicedesk/login";
    if (!/^[A-Za-z0-9.\-/]{3,40}$/.test(matricula)) return json({ error: "Matrícula inválida." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255) return json({ error: "E-mail inválido." }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "A senha deve ter de 8 a 72 caracteres." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const [{ count: byMat }, { count: byIp }] = await Promise.all([
      admin.from("sd_first_access_attempts").select("id", { count: "exact", head: true })
        .eq("matricula", matricula).eq("success", false).gte("created_at", since),
      ip
        ? admin.from("sd_first_access_attempts").select("id", { count: "exact", head: true })
            .eq("ip", ip).eq("success", false).gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);
    if ((byMat ?? 0) >= 5 || (byIp ?? 0) >= 20)
      return json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, 429);

    const fail = async (msg = GENERIC, status = 400) => {
      await admin.from("sd_first_access_attempts").insert({ matricula, ip, success: false });
      return json({ error: msg }, status);
    };

    const { data: rows, error: qErr } = tipo === "professor"
      ? await admin.from("sd_faculty").select("id, user_id, status").eq("enrollment", matricula)
      : await admin.from("sd_students").select("id, user_id, status, service_desk_access_active").eq("enrollment", matricula);
    if (qErr) throw qErr;
    if (!rows || rows.length !== 1) return await fail();
    const st = rows[0];
    if (st.user_id) return await fail("Esta matrícula já possui cadastro. Use \"Entrar\" ou \"Esqueci minha senha\".", 409);
    if (tipo === "professor" ? st.status !== "ativo" : (st.status === "trancado" || !st.service_desk_access_active))
      return await fail("Seu acesso ao Service Desk está suspenso. Procure a secretaria do seu programa.", 403);

    // Cria a conta sem usar o envio de e-mails do sistema de login (que tem limite por hora)
    // e envia a confirmação pelo Resend.
    const { data: link, error: cErr } = await admin.auth.admin.generateLink({
      type: "signup", email, password,
      options: { redirectTo, data: { source: "servicedesk_first_access", tipo } },
    });
    const createdUser = link?.user;
    if (cErr || !createdUser) {
      const m = cErr?.message ?? "";
      console.error("sd-first-access signup", matricula, cErr?.status, (cErr as any)?.code, m);
      if (/weak|easy to guess|pwned|leaked/i.test(m))
        return json({ error: "Esta senha é muito comum e foi recusada por segurança. Crie uma senha diferente, misturando letras maiúsculas, minúsculas, números e símbolos." }, 422);
      if (/password/i.test(m))
        return json({ error: "A senha não atende aos requisitos de segurança. Use letras maiúsculas, minúsculas, números e símbolos." }, 422);
      const exists = /already|registered|exists/i.test(m);
      return await fail(exists
        ? "Este e-mail já está cadastrado no ProjetoGO. Use outro e-mail ou entre com ele."
        : "Não foi possível criar o cadastro.", exists ? 409 : 400);
    }

    const { error: uErr } = await admin.from(table)
      .update(tipo === "professor" ? { user_id: createdUser.id } : { user_id: createdUser.id, email })
      .eq("id", st.id).is("user_id", null);
    if (uErr) {
      await admin.auth.admin.deleteUser(createdUser.id);
      throw uErr;
    }

    const actionLink = link.properties?.action_link ?? "";
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error: sendErr } = await resend.emails.send({
      from: "ProjetoGO <noreply@innovago.app>",
      to: [email],
      subject: "Confirme seu e-mail, Service Desk ProjetoGO",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <p>Olá!</p>
        <p>Recebemos o seu primeiro acesso ao Service Desk. Para ativar a sua conta, confirme o seu e-mail clicando no botão abaixo:</p>
        <p><a href="${actionLink}" style="background:#1e3a5f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Confirmar e-mail</a></p>
        <p>Depois, entre sempre em <a href="https://projetogo.innovago.app/servicedesk/login">projetogo.innovago.app/servicedesk/login</a> com este e-mail e a senha criada.</p>
        <p style="color:#666;font-size:12px">Se você não fez este cadastro, ignore este e-mail.</p></div>`,
    });
    if (sendErr) {
      console.error("sd-first-access resend", sendErr);
      await admin.from(table).update({ user_id: null }).eq("id", st.id).eq("user_id", createdUser.id);
      await admin.auth.admin.deleteUser(createdUser.id);
      return json({ error: "Não foi possível enviar o e-mail de confirmação. Confira o e-mail informado ou tente mais tarde." }, 502);
    }
    await admin.from("sd_first_access_attempts").insert({ matricula, ip, success: true });
    return json({ ok: true, needsConfirmation: true });
  } catch (e) {
    console.error("sd-first-access", e);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
