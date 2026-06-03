import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const normalized = email.trim().toLowerCase();

    // Find user by email
    let target: { id: string; email_confirmed_at: string | null } | null = null;
    let page = 1;
    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const found = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized);
      if (found) {
        target = { id: found.id, email_confirmed_at: found.email_confirmed_at ?? null };
        break;
      }
      if (data.users.length < 200) break;
      page++;
    }

    if (!target) return new Response(JSON.stringify({ deleted: false, reason: "not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (target.email_confirmed_at) return new Response(JSON.stringify({ deleted: false, reason: "confirmed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Delete profile first (no FK, but to be clean), then the auth user
    await admin.from("profiles").delete().eq("user_id", target.id);
    const { error: delErr } = await admin.auth.admin.deleteUser(target.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ deleted: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
