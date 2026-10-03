import { supabase } from "@/integrations/supabase/client";

/**
 * Lists matching the query, most liked first (top 30). Three requests in two
 * rounds: the lists with their item and like counts embedded, then the owners'
 * profiles and the viewer's follows of those owners together. It used to make
 * one count request per list (up to 100) after three sequential rounds.
 */
export async function fetchSearchLists(q: string, viewerId: string | null): Promise<any[]> {
  let qb = supabase
    .from("lists")
    .select("id, name, description, user_id, item_count:list_items(count), like_count:list_likes(count)");
  if (q) qb = qb.ilike("name", `%${q}%`);
  const { data } = await qb.limit(100);
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((l: any) => l.user_id))];
  const [{ data: profiles }, { data: follows }] = await Promise.all([
    supabase.from("profiles").select("user_id, username, profile_picture, is_private").in("user_id", userIds),
    viewerId
      ? supabase.from("followers").select("following_id").eq("follower_id", viewerId).in("following_id", userIds)
      : Promise.resolve({ data: [] as { following_id: string }[] }),
  ]);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  const followed = new Set((follows || []).map((f: any) => f.following_id));

  // Privacy filter: hide lists from private users unless the viewer follows them or is the owner
  const visibleLists = data.filter((l: any) => {
    const p: any = profileMap.get(l.user_id);
    if (!p?.is_private) return true;
    if (l.user_id === viewerId) return true;
    return followed.has(l.user_id);
  });

  const enriched = visibleLists.map((l: any) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    user_id: l.user_id,
    item_count: l.item_count?.[0]?.count ?? 0,
    like_count: l.like_count?.[0]?.count ?? 0,
    profiles: profileMap.get(l.user_id) || null,
  }));
  enriched.sort((a, b) => b.like_count - a.like_count);
  return enriched.slice(0, 30);
}
