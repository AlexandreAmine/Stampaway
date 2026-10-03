import { supabase } from "@/integrations/supabase/client";

export type FollowResult = "following" | "requested";

/**
 * Follow someone the way their profile page does: a private account gets a
 * follow request, a public one is followed directly. Always asks the server
 * whether the account is private (a cached row may be out of date), because
 * the database itself accepts a direct follow of any account — the Search
 * and Following-tab buttons used to follow private accounts without asking.
 */
export async function followOrRequest(viewerId: string, targetId: string): Promise<FollowResult> {
  const { data: target, error: profileError } = await supabase
    .from("profiles")
    .select("is_private")
    .eq("user_id", targetId)
    .single();
  if (profileError) throw profileError;

  if (target?.is_private) {
    const { error } = await supabase.from("follow_requests").insert({ requester_id: viewerId, target_id: targetId });
    if (error) throw error;
    return "requested";
  }

  const { error } = await supabase.from("followers").insert({ follower_id: viewerId, following_id: targetId });
  if (error) throw error;
  return "following";
}
