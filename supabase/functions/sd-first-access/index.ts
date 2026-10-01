import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

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

    const { data: rows, error: qErr } = await admin
      .from("sd_students")
      .select("id, user_id, status, service_desk_access_active")
      .eq("enrollment", matricula);
    if (qErr) throw qErr;
    if (!rows || rows.length !== 1) return await fail();
    const st = rows[0];
    if (st.user_id) return await fail("Esta matrícula já possui cadastro. Use \"Entrar\" ou \"Esqueci minha senha\".", 409);
    if (st.status === "trancado" || !st.service_desk_access_active)
      return await fail("Seu acesso ao Service Desk está suspenso. Procure a secretaria do seu programa.", 403);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { source: "servicedesk_first_access" },
    });
    if (cErr || !created.user) {
      const exists = /already|registered|exists/i.test(cErr?.message ?? "");
      return await fail(exists
        ? "Este e-mail já está cadastrado no ProjetoGO. Use outro e-mail ou entre com ele."
        : "Não foi possível criar o cadastro.", exists ? 409 : 400);
    }

    const { error: uErr } = await admin.from("sd_students")
      .update({ user_id: created.user.id, email })
      .eq("id", st.id).is("user_id", null);
    if (uErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw uErr;
    }
    await admin.from("sd_first_access_attempts").insert({ matricula, ip, success: true });
    return json({ ok: true });
  } catch (e) {
    console.error("sd-first-access", e);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
