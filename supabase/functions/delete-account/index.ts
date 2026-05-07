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

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      console.error("auth.getUser failed:", userErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    console.log(`Deleting account for user ${userId}`);

    const safe = async (label: string, p: Promise<{ error: any }>) => {
      const { error } = await p;
      if (error) console.warn(`[${label}] ${error.message}`);
    };

    // 1) Get user's reviews and lists ids so we can clean their dependents
    const { data: userReviews } = await admin.from("reviews").select("id").eq("user_id", userId);
    const reviewIds = (userReviews ?? []).map((r: any) => r.id);
    const { data: userLists } = await admin.from("lists").select("id").eq("user_id", userId);
    const listIds = (userLists ?? []).map((l: any) => l.id);

    // 2) Clean dependents on user's reviews (others' likes, comments, tags, sub-ratings)
    if (reviewIds.length) {
      await safe("review_sub_ratings", admin.from("review_sub_ratings").delete().in("review_id", reviewIds));
      await safe("review_likes(on user reviews)", admin.from("review_likes").delete().in("review_id", reviewIds));
      await safe("review_comments(on user reviews)", admin.from("review_comments").delete().in("review_id", reviewIds));
      await safe("review_tags(on user reviews)", admin.from("review_tags").delete().in("review_id", reviewIds));
    }

    // 3) Clean dependents on user's lists (others' likes, items)
    if (listIds.length) {
      await safe("list_likes(on user lists)", admin.from("list_likes").delete().in("list_id", listIds));
      await safe("list_items(on user lists)", admin.from("list_items").delete().in("list_id", listIds));
    }

    // 4) Clean rows the user authored or that reference them
    await safe("review_tags(by/about user)", admin.from("review_tags").delete().or(`tagged_user_id.eq.${userId},tagged_by_user_id.eq.${userId}`));
    await safe("followers", admin.from("followers").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`));
    await safe("follow_requests", admin.from("follow_requests").delete().or(`requester_id.eq.${userId},target_id.eq.${userId}`));
    await safe("blocked_users", admin.from("blocked_users").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`));

    const userIdTables = [
      "review_likes",
      "review_comments",
      "list_likes",
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
      await safe(table, admin.from(table).delete().eq("user_id", userId));
    }

    // 5) Finally, delete the auth user (frees the email)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("auth.admin.deleteUser failed:", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully deleted user ${userId}`);
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
