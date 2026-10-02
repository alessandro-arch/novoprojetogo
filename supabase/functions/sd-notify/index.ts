import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const STATUS: Record<string, string> = { em_analise: "Em análise", aprovado: "Aprovado, aguardando execução", em_andamento: "Em andamento", concluido: "Concluído", recusado: "Recusado", correcao: "Correção necessária" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("unauthorized", { status: 401, headers: cors });
    const { request_id, event } = await req.json();
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
    const reqLink = `https://projetogo.innovago.app/servicedesk/solicitacao/${r.id}`;

    const { data: authUser } = await admin.auth.admin.getUserById(r.requester_user_id);
    const { data: st } = await admin.from("sd_students").select("email").eq("user_id", r.requester_user_id).maybeSingle();
    const { data: fa } = await admin.from("sd_faculty").select("personal_email").eq("user_id", r.requester_user_id).maybeSingle();
    const to = st?.email || fa?.personal_email || authUser?.user?.email;
    const protocol = esc(r.protocol || "");
    if (event === "liberar_vpn") {
      if (!r.vpn_conf_path || r.vpn_status !== "ativo") return new Response("not released", { status: 400, headers: cors });
      if (r.vpn_email_sent_at) return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      const { data: file, error: dlErr } = await admin.storage.from("servicedesk").download(r.vpn_conf_path);
      if (dlErr || !file) throw new Error("arquivo .conf indisponível");
      const b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
      const DEFAULT_VPN_INSTRUCTIONS = `O arquivo anexado é uma credencial pessoal. Por segurança:
• Não encaminhe nem compartilhe o arquivo com outras pessoas;
• Não publique o arquivo em grupos ou pastas compartilhadas;
• Utilize-o em apenas um dispositivo;
• Após a importação, exclua o arquivo da pasta de downloads e do e-mail, se possível;
• Em caso de perda, troca ou formatação do dispositivo, solicite uma nova configuração à equipe de TI.

COMPUTADOR (WINDOWS OU MACOS)
1. Instale o aplicativo oficial WireGuard: https://www.wireguard.com/install/
2. Abra o WireGuard.
3. Selecione "Adicionar túnel" ou "Add Tunnel".
4. Escolha "Importar túnel de arquivo" ou "Import tunnel from file".
5. Selecione o arquivo .conf anexado a este e-mail.
6. Após a importação, selecione o túnel "VPNCAPES" e clique em "Ativar".

CELULAR (ANDROID OU IPHONE)
1. Instale o aplicativo oficial WireGuard pela Play Store ou App Store.
2. Salve o arquivo .conf anexado no dispositivo.
3. Abra o WireGuard e toque no botão +.
4. Selecione "Importar de arquivo ou arquivo compactado".
5. Localize e selecione o arquivo .conf.
6. Ative o túnel "VPNCAPES".

COMO UTILIZAR
• Conecte o dispositivo à sua internet residencial ou rede móvel.
• Abra o WireGuard e ative a VPNCAPES.
• Acesse o Portal de Periódicos CAPES normalmente.
• Ao concluir a consulta, volte ao WireGuard e desative a VPN.
• Enquanto a VPN estiver ativa, a navegação do dispositivo utilizará a conexão e o IP institucional. Por isso, mantenha-a ativada somente durante o uso acadêmico.

Caso a VPN não conecte ou o Portal CAPES não reconheça o acesso institucional, entre em contato com a equipe de TI informando o dispositivo utilizado e, se possível, enviando uma captura do erro. Não envie o conteúdo do arquivo .conf nem qualquer chave privada.`;
      const { data: ins } = await admin.from("sd_settings").select("value").eq("organization_id", r.organization_id).eq("key", "vpn_instructions").maybeSingle();
      const instr = esc(typeof ins?.value === "string" && ins.value ? ins.value : DEFAULT_VPN_INSTRUCTIONS).replace(/\n/g, "<br>");
      const fname = r.vpn_conf_path.split("/").pop();
      if (!to) throw new Error("solicitante sem e-mail");
      const { error: sendErr } = await resend.emails.send({
        from: "ProjetoGO <noreply@innovago.app>", to: [to],
        subject: `Seu acesso VPN foi liberado | ${r.protocol}`,
        html: `<p>Olá, ${esc(r.requester_name.split(" ")[0])}.</p><p>Seu acesso <b>${svc}</b> (protocolo <b>${protocol}</b>) foi liberado. O arquivo de configuração segue anexo e também está disponível na sua área do Service Desk.</p>${r.vpn_valid_until ? `<p>Validade: <b>${r.vpn_valid_until.split("-").reverse().join("/")}</b></p>` : ""}${instr ? `<p><b>Instruções</b><br>${instr}</p>` : ""}<p><a href="${reqLink}">Abrir a solicitação</a></p>`,
        attachments: [{ filename: fname, content: b64 }],
      } as any);
      if (sendErr) throw new Error(String((sendErr as any).message || sendErr));
      await admin.from("sd_requests").update({ vpn_email_sent_at: new Date().toISOString() }).eq("id", r.id);
      await admin.from("sd_request_events").insert({ request_id: r.id, organization_id: r.organization_id, actor_user_id: (await userClient.auth.getUser()).data.user?.id, actor_name: "Sistema", action: "vpn_enviado", note: `Arquivo .conf e instruções enviados para ${to}` });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (to && event === "corrigir" && r.status === "correcao") await resend.emails.send({
      from: "ProjetoGO <noreply@innovago.app>", to: [to],
      subject: `Correção necessária em sua solicitação | ${r.protocol}`,
      html: `<p>Olá, ${esc(r.requester_name.split(" ")[0])}.</p><p>A equipe responsável pediu uma correção na sua solicitação <b>${svc}</b> (protocolo <b>${protocol}</b>).</p><p><b>Orientação:</b> ${esc(r.correction_note || "")}</p><p><a href="${reqLink}" style="display:inline-block;padding:10px 16px;background:#1e2433;color:#fff;border-radius:8px;text-decoration:none">Corrigir solicitação</a></p>`,
    });
    else if (to && !["reenviar", "impedimento"].includes(event)) await resend.emails.send({
      from: "ProjetoGO <noreply@innovago.app>", to: [to],
      subject: `${svc}: ${STATUS[r.status] || r.status}`,
      html: `<p>Olá, ${esc(r.requester_name)}.</p><p>Sua solicitação <b>${svc}</b> está: <b>${STATUS[r.status] || r.status}</b>.</p>${note}<p><a href="${link}">Acessar o Service Desk</a></p>`,
    });

    if (r.current_group_id && !["concluido", "recusado", "correcao"].includes(r.status) && ["criada", "aprovar", "reenviar"].includes(event)) {
      const { data: gm } = await admin.from("sd_group_members").select("user_id").eq("group_id", r.current_group_id);
      const ids = (gm || []).map((x: any) => x.user_id);
      if (ids.length) {
        const { data: ps } = await admin.from("profiles").select("email").in("user_id", ids);
        const emails = (ps || []).map((p: any) => p.email).filter(Boolean);
        if (emails.length) await resend.emails.send({
          from: "ProjetoGO <noreply@innovago.app>", to: emails,
          subject: event === "reenviar" ? `Correção recebida: ${svc} | ${r.protocol}` : `Nova solicitação na sua fila: ${svc}`,
          html: `<p>Há uma solicitação aguardando sua equipe.</p><p><b>${svc}</b>, ${esc(r.requester_name)} (${esc(r.requester_enrollment)})</p><p><a href="${reqLink}">Abrir a solicitação</a></p>`,
        });
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
