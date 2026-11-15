import { canManageFomentoOrganization, findAuthUserByEmail } from "../_shared/firstAccessPolicy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is fomento admin
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check fomento admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("fomento_role, fomento_org_id")
      .eq("user_id", caller.id)
      .single();

    if (!["admin", "superadmin"].includes(callerProfile?.fomento_role ?? "")) {
      return new Response(JSON.stringify({ error: "Only fomento admins can invite" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const { org_id, resend, check_status } = body;

    if (!canManageFomentoOrganization(callerProfile?.fomento_role, callerProfile?.fomento_org_id, org_id)) {
      return new Response(JSON.stringify({ error: "Organization access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetOrg, error: orgError } = await adminClient
      .from("fomento_organizations").select("id").eq("id", org_id).maybeSingle();
    if (orgError) throw orgError;
    if (!targetOrg) return new Response(JSON.stringify({ error: "Organization not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // ─── Check admin status endpoint ──────────────────────
    if (check_status && org_id) {
      const { data: org } = await adminClient
        .from("fomento_organizations")
        .select("admin_user_id, admin_email, admin_status")
        .eq("id", org_id)
        .single();

      if (!org?.admin_user_id) {
        return new Response(
          JSON.stringify({ admin_status: "sem_admin" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check last_sign_in_at from auth
      const { data: authUser } = await adminClient.auth.admin.getUserById(org.admin_user_id);
      let status = org.admin_status || "pendente";

      if (authUser?.user?.last_sign_in_at) {
        status = "ativo";
        // Update stored status if different
        if (org.admin_status !== "ativo") {
          await adminClient
            .from("fomento_organizations")
            .update({ admin_status: "ativo" })
            .eq("id", org_id);
        }
      }

      return new Response(
        JSON.stringify({ admin_status: status, last_sign_in_at: authUser?.user?.last_sign_in_at || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !full_name || full_name.length > 200 || !org_id) {
      return new Response(JSON.stringify({ error: "email, full_name, and org_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists
    const existingUser = await findAuthUserByEmail(adminClient.auth.admin, email);

    if (existingUser) {
      const { data: prior, error: priorError } = await adminClient.from("profiles")
        .select("fomento_role, fomento_org_id").eq("user_id", existingUser.id).maybeSingle();
      if (priorError) throw priorError;
      if (prior?.fomento_role === "superadmin" || (prior?.fomento_org_id && prior.fomento_org_id !== org_id)) {
        return new Response(JSON.stringify({ error: "A conta já possui vínculo administrativo incompatível" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let userId: string;
    let isNew = false;

    if (existingUser) {
      userId = existingUser.id;

      // If resend flag, re-invite existing user
      if (resend) {
        const { error: resendError } = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name },
          redirectTo: "https://projetogo.innovago.app/fomento/login",
        });
        // Supabase may throw "already confirmed" — still log it
        if (resendError && !resendError.message?.includes("already")) {
          return new Response(JSON.stringify({ error: resendError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      isNew = true;
      // Invite new user via magic link
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name },
          redirectTo: "https://projetogo.innovago.app/fomento/login",
        });

      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = inviteData.user.id;
    }

    // Set fomento_role = 'admin' on profile
    const { data: existingProfile, error: profileReadError } = await adminClient
      .from("profiles")
      .select("id, fomento_role, fomento_org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileReadError) throw profileReadError;

    if (existingProfile?.fomento_role === "superadmin" ||
        (existingProfile?.fomento_org_id && existingProfile.fomento_org_id !== org_id)) {
      return new Response(JSON.stringify({ error: "A conta já possui vínculo administrativo incompatível" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existingProfile) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ fomento_role: "admin", fomento_org_id: org_id, full_name, email })
        .eq("user_id", userId);
      if (profileError) throw profileError;
    } else {
      const { error: profileError } = await adminClient
        .from("profiles")
        .insert({ user_id: userId, fomento_role: "admin", fomento_org_id: org_id, full_name, email });
      if (profileError) throw profileError;
    }

    // Update org with admin info + set status to pendente
    const { error: orgWriteError } = await adminClient
      .from("fomento_organizations")
      .update({
        admin_user_id: userId,
        admin_name: full_name,
        admin_email: email,
        admin_status: "pendente",
      })
      .eq("id", org_id);
    if (orgWriteError) throw orgWriteError;

    // Log invite
    await adminClient
      .from("fomento_invite_log")
      .insert({
        organization_id: org_id,
        email,
        enviado_por: caller.id,
      });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, is_new: isNew, resent: !!resend }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
