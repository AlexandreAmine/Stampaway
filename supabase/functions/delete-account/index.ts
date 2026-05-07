import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller using their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Delete user-owned content across all public tables.
    // Order matters: delete dependent rows before parents where FKs aren't cascading.
    const tablesByUserId = [
      "review_likes",
      "review_comments",
      "list_likes",
      "list_items", // will also be cleaned via lists cascade, but harmless
      "favorite_places",
      "wishlists",
      "yearly_goal_places",
      "yearly_goals",
      "follow_requests",
      "followers",
      "blocked_users",
      "review_tags",
      "reviews",
      "lists",
      "user_roles",
      "profiles",
    ];

    // Special: review_tags has tagged_user_id and tagged_by_user_id
    await admin.from("review_tags").delete().or(`tagged_user_id.eq.${userId},tagged_by_user_id.eq.${userId}`);

    // followers: follower_id or following_id
    await admin.from("followers").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);

    // follow_requests: requester_id or target_id
    await admin.from("follow_requests").delete().or(`requester_id.eq.${userId},target_id.eq.${userId}`);

    // blocked_users: blocker_id or blocked_id
    await admin.from("blocked_users").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    // Per-user_id columns
    const userIdTables = [
      "review_likes",
      "review_comments",
      "list_likes",
      "list_items",
      "favorite_places",
      "wishlists",
      "yearly_goal_places",
      "yearly_goals",
      "reviews",
      "lists",
      "user_roles",
      "profiles",
    ];
    for (const table of userIdTables) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error && !/does not exist|column .* does not exist/i.test(error.message)) {
        console.warn(`delete from ${table} failed:`, error.message);
      }
    }

    // Finally, delete the auth user (this frees up the email)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("auth deleteUser failed:", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-account error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
