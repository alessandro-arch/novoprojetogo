import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const STATUS: Record<string, string> = { em_analise: "Em análise", aprovado: "Aprovado — aguardando execução", em_andamento: "Em andamento", concluido: "Concluído", recusado: "Recusado" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("unauthorized", { status: 401, headers: cors });
    const { request_id } = await req.json();
    if (typeof request_id !== "string" || !/^[0-9a-f-]{36}$/.test(request_id)) return new Response("bad request", { status: 400, headers: cors });
    const url = Deno.env.get("SUPABASE_URL")!;
    // Caller must be able to see the request (RLS)
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: visible } = await userClient.from("sd_requests").select("id").eq("id", request_id).maybeSingle();
    if (!visible) return new Response("forbidden", { status: 403, headers: cors });

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r } = await admin.from("sd_requests").select("*, sd_services(name)").eq("id", request_id).single();
    const { data: ev } = await admin.from("sd_request_events").select("note").eq("request_id", request_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const svc = esc(r.sd_services?.name || "Solicitação");
    const note = ev?.note ? `<p><b>Observação:</b> ${esc(ev.note)}</p>` : "";
    const link = "https://projetogo.innovago.app/servicedesk/login";

    const { data: authUser } = await admin.auth.admin.getUserById(r.requester_user_id);
    const to = authUser?.user?.email;
    if (to) await resend.emails.send({
      from: "ProjetoGO <noreply@innovago.app>", to: [to],
      subject: `${svc}: ${STATUS[r.status] || r.status}`,
      html: `<p>Olá, ${esc(r.requester_name)}.</p><p>Sua solicitação <b>${svc}</b> está: <b>${STATUS[r.status] || r.status}</b>.</p>${note}<p><a href="${link}">Acessar o Service Desk</a></p>`,
    });

    if (r.current_group_id && !["concluido", "recusado"].includes(r.status)) {
      const { data: gm } = await admin.from("sd_group_members").select("user_id").eq("group_id", r.current_group_id);
      const ids = (gm || []).map((x: any) => x.user_id);
      if (ids.length) {
        const { data: ps } = await admin.from("profiles").select("email").in("user_id", ids);
        const emails = (ps || []).map((p: any) => p.email).filter(Boolean);
        if (emails.length) await resend.emails.send({
          from: "ProjetoGO <noreply@innovago.app>", to: emails,
          subject: `Nova solicitação na sua fila: ${svc}`,
          html: `<p>Há uma solicitação aguardando sua equipe.</p><p><b>${svc}</b> — ${esc(r.requester_name)} (${esc(r.requester_enrollment)})</p><p><a href="${link}">Abrir o Service Desk</a></p>`,
        });
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
