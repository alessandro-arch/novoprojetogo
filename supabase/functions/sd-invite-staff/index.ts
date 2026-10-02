import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const UUID = /^[0-9a-f-]{36}$/;
const ROLES = ["admin", "operador"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const orgId = String(body.org_id || "");
    const role = String(body.role || "operador");
    const groupId = body.group_id ? String(body.group_id) : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return json({ error: "E-mail inválido" }, 400);
    if (fullName.length < 3 || fullName.length > 200) return json({ error: "Informe o nome completo" }, 400);
    if (!UUID.test(orgId) || (groupId && !UUID.test(groupId)) || !ROLES.includes(role)) return json({ error: "Dados inválidos" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "Não autenticado" }, 401);
    const { data: isAdmin } = await userClient.rpc("sd_is_admin", { _user_id: caller.id, _org_id: orgId });
    const { data: isSuper } = isAdmin ? { data: true } : await userClient.rpc("sd_is_superadmin", { _user_id: caller.id });
    if (!isAdmin && !isSuper) return json({ error: "Apenas administradores da instituição podem convidar" }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: org } = await admin.from("organizations").select("name, sigla").eq("id", orgId).single();
    let groupName = "";
    if (groupId) {
      const { data: g } = await admin.from("sd_groups").select("name, organization_id").eq("id", groupId).maybeSingle();
      if (!g || g.organization_id !== orgId) return json({ error: "Grupo inválido" }, 400);
      groupName = g.name;
    }

    // Existing account?
    const { data: found } = await admin.rpc("find_profile_by_email", { _email: email });
    let userId: string = found?.[0]?.user_id;
    const isNew = !userId;
    if (isNew) {
      const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
      if (error || !created.user) return json({ error: error?.message || "Falha ao criar conta" }, 500);
      userId = created.user.id;
    }

    const { error: mErr } = await admin.from("sd_members").upsert({ organization_id: orgId, user_id: userId, role, status: "ativo" }, { onConflict: "organization_id,user_id" });
    if (mErr) return json({ error: mErr.message }, 500);
    if (groupId) {
      const { data: gm } = await admin.from("sd_group_members").select("id").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
      if (!gm) {
        const { error: gErr } = await admin.from("sd_group_members").insert({ group_id: groupId, organization_id: orgId, user_id: userId });
        if (gErr) return json({ error: gErr.message }, 500);
      }
    }

    const site = "https://projetogo.innovago.app";
    let actionHtml: string;
    if (isNew) {
      const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: `${site}/reset-password?back=sd` } });
      if (lErr) return json({ error: lErr.message }, 500);
      actionHtml = `<p>Para começar, crie a sua senha clicando no botão abaixo:</p>
        <p><a href="${link.properties.action_link}" style="background:#1e3a5f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Criar minha senha</a></p>
        <p>Depois, entre sempre em <a href="${site}/servicedesk/login">${site}/servicedesk/login</a> com este e-mail e a senha criada.</p>`;
    } else {
      actionHtml = `<p>Você já tem conta no ProjetoGO. Entre em <a href="${site}/servicedesk/login">${site}/servicedesk/login</a> com o seu e-mail e senha de sempre.</p>`;
    }
    const orgName = esc(org?.sigla || org?.name || "instituição");
    const grp = groupName ? ` no grupo <b>${esc(groupName)}</b>` : "";
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error: sendErr } = await resend.emails.send({
      from: "ProjetoGO <noreply@innovago.app>",
      to: [email],
      subject: `Convite para a Central de Atendimento, ${org?.sigla || "Service Desk"}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <p>Olá, ${esc(fullName)}.</p>
        <p>Você foi convidado(a) para atuar no Service Desk da ${orgName}${grp}.</p>
        ${actionHtml}
        <p style="color:#666;font-size:12px">Se você não esperava este convite, ignore este e-mail.</p></div>`,
    });
    if (sendErr) return json({ ok: true, user_id: userId, is_new: isNew, email_error: sendErr.message });
    return json({ ok: true, user_id: userId, is_new: isNew });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
