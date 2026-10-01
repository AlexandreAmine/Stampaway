import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Another user's profile header (name, photo, bio, privacy). Cached by React
 * Query (persisted), so reopening a profile shows the real name at once;
 * it is still refetched on every open, so edits appear normally.
 */
export interface ProfileHeader {
  username: string;
  profile_picture: string | null;
  bio: string | null;
  country: string | null;
  /** undefined = not known yet (a preview seeded from the row you tapped). */
  is_private?: boolean;
  social_links?: unknown;
}

export const profileHeaderQueryKey = (userId: string | null) => ["profile-header", userId] as const;

export async function fetchProfileHeader(userId: string): Promise<ProfileHeader> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, profile_picture, bio, country, is_private, social_links")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data as ProfileHeader;
}

/**
 * Called when a finger lands on a link to someone's profile: shows the name
 * and photo we already have from that row straight away (only if nothing is
 * cached yet) and starts loading the full header before navigation begins.
 */
export function prefetchProfileHeader(
  queryClient: QueryClient,
  userId: string,
  preview?: { username?: string; profile_picture?: string | null },
) {
  const key = profileHeaderQueryKey(userId);
  if (preview?.username && !queryClient.getQueryData(key)) {
    // No is_private here on purpose: privacy is never assumed from a preview.
    queryClient.setQueryData<ProfileHeader>(key, {
      username: preview.username,
      profile_picture: preview.profile_picture ?? null,
      bio: null,
      country: null,
    }, { updatedAt: 0 }); // counts as stale, so the real fetch always runs
  }
  void queryClient.prefetchQuery({
    queryKey: key,
    queryFn: () => fetchProfileHeader(userId),
    staleTime: 10_000,
  });
}

/**
 * Spread onto anything that opens a user's profile, so PressPrefetch can
 * start loading it on touch: {...profileLinkProps(id, name, photo)}.
 */
export function profileLinkProps(userId: string | null | undefined, username?: string | null, profilePicture?: string | null) {
  if (!userId) return {};
  return {
    "data-prefetch-profile": userId,
    "data-profile-name": username ?? "",
    "data-profile-pic": profilePicture ?? "",
  };
}
