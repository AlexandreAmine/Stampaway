import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { selectInChunks } from "@/lib/inChunks";
import { profileLinkProps } from "@/lib/profileHeaderQuery";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import { followOrRequest } from "@/lib/followActions";
import { hapticLight } from "@/lib/haptics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SearchUser {
  user_id: string;
  username: string;
  profile_picture: string | null;
  is_private: boolean;
}

interface FollowUser {
  id: string;
  followId: string;
  username: string;
  profile_picture: string | null;
}

export function FollowingTab({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const targetUserId = userId || user?.id;
  const queryClient = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  // Private accounts asked to follow from here (a request, not a follow).
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  // Follow taps still being saved, so a double tap can't send two.
  const followInFlight = useRef(new Set<string>());
  const [filterQuery, setFilterQuery] = useState("");
  const [pendingUnfollow, setPendingUnfollow] = useState<FollowUser | null>(null);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Cached by React Query: reopening this tab renders instantly from the
  // last known data while a background refetch keeps it fresh.
  const followingQuery = useQuery({
    queryKey: ["following", targetUserId ?? null],
    enabled: !!targetUserId,
    queryFn: async (): Promise<FollowUser[]> => {
      const { data } = await supabase
        .from("followers")
        .select("id, following_id")
        .eq("follower_id", targetUserId!);

      if (!data || data.length === 0) return [];

      const ids = data.map((f) => f.following_id);
      const { data: profiles } = await selectInChunks(ids, (chunk) =>
        supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", chunk)
      );

      return (profiles || []).map((p) => {
        const follow = data.find((f) => f.following_id === p.user_id);
        return { id: p.user_id, followId: follow!.id, username: p.username, profile_picture: p.profile_picture };
      });
    },
  });
  const following = followingQuery.data ?? [];
  const loading = followingQuery.isPending;

  const followingKey = ["following", targetUserId ?? null];
  const refreshFollowing = () => queryClient.invalidateQueries({ queryKey: followingKey });

  const searchUsers = async (search: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, profile_picture, is_private")
      .ilike("username", `%${search}%`)
      .neq("user_id", user.id)
      .limit(10);
    const results = data || [];
    // Show "Requested" for private accounts already asked.
    const privateIds = results.filter((u) => u.is_private).map((u) => u.user_id);
    if (privateIds.length > 0) {
      const { data: requests } = await supabase
        .from("follow_requests")
        .select("target_id")
        .eq("requester_id", user.id)
        .in("target_id", privateIds);
      if (requests?.length) {
        setRequestedIds((prev) => new Set([...prev, ...requests.map((r) => r.target_id)]));
      }
    }
    setSearchResults(results);
  };

  const addRequested = (id: string, requested: boolean) =>
    setRequestedIds((prev) => {
      const next = new Set(prev);
      if (requested) next.add(id);
      else next.delete(id);
      return next;
    });

  const closeSearch = () => {
    setShowSearch(false);
    setQuery("");
  };

  // Instant: the list (or the "Requested" label, for a private account)
  // updates on tap and is put back if the save fails. Private accounts get a
  // follow request, as on their profile page.
  const handleFollow = async (target: SearchUser) => {
    if (!user || followInFlight.current.has(target.user_id) || requestedIds.has(target.user_id)) return;
    const already = following.some((f) => f.id === target.user_id);
    if (already) { toast(t("following.already")); return; }
    followInFlight.current.add(target.user_id);
    hapticLight();

    const previous = queryClient.getQueryData<FollowUser[]>(followingKey);
    const showFollowed = () => {
      queryClient.setQueryData<FollowUser[]>(followingKey, (old) => [
        ...(old ?? []).filter((f) => f.id !== target.user_id),
        { id: target.user_id, followId: "", username: target.username, profile_picture: target.profile_picture },
      ]);
      toast.success(t("following.followed"));
      closeSearch();
    };
    if (target.is_private) addRequested(target.user_id, true);
    else showFollowed();

    try {
      const result = await followOrRequest(user.id, target.user_id);
      if (result === "requested" && !target.is_private) {
        // Turned private since the search: it's a request after all.
        queryClient.setQueryData(followingKey, previous);
        addRequested(target.user_id, true);
      } else if (result === "following" && target.is_private) {
        addRequested(target.user_id, false);
        showFollowed();
      }
      if (result === "following") invalidateOwnProfileContentCache(user.id);
    } catch {
      if (target.is_private) addRequested(target.user_id, false);
      else queryClient.setQueryData(followingKey, previous);
      toastError(t("following.followFailed"));
    } finally {
      followInFlight.current.delete(target.user_id);
      void refreshFollowing();
    }
  };

  // Instant: the row disappears on confirm and comes back if the save fails.
  const handleUnfollow = async (target: FollowUser) => {
    if (!user) return;
    const previous = queryClient.getQueryData<FollowUser[]>(followingKey);
    queryClient.setQueryData<FollowUser[]>(followingKey, (old) => (old ?? []).filter((f) => f.id !== target.id));
    hapticLight();
    toast.success(t("following.unfollowed", { username: target.username }));
    // By the pair rather than the row id, which a just-added row doesn't
    // have yet (the same row either way).
    const { error } = await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", target.id);
    if (error) {
      queryClient.setQueryData(followingKey, previous);
      toastError(t("following.unfollowFailed"));
      return;
    }
    invalidateOwnProfileContentCache(user.id);
    void refreshFollowing();
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-10 bg-muted/40 rounded-xl skeleton-shimmer" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full bg-muted/40 skeleton-shimmer" />
            <div className="h-3 w-32 bg-muted/40 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  const filtered = filterQuery.trim()
    ? following.filter((f) => f.username.toLowerCase().includes(filterQuery.toLowerCase()))
    : following;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Search bar (filter own list) + add button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={t("search")}
            className="w-full bg-card rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-9 h-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center"
            aria-label={t("following.findUsers")}
          >
            <Plus className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showSearch && !readOnly && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("following.findUsersPlaceholder")}
                className="w-full bg-card rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {searchResults.map((u) => {
              const isFollowing = following.some((f) => f.id === u.user_id);
              return (
                <div key={u.user_id} className="flex items-center justify-between py-2">
                  <button onClick={() => navigate(`/profile/${u.user_id}`)} {...profileLinkProps(u.user_id, u.username, u.profile_picture)} className="flex items-center gap-3">
                    <img
                      src={u.profile_picture || fallbackAvatarUrl(u.username)}
                      alt={u.username}
                      loading="lazy"
                      decoding="async"
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium text-foreground" data-no-translate>{u.username}</span>
                  </button>
                  {!isFollowing && !requestedIds.has(u.user_id) && (
                    <button onClick={() => handleFollow(u)} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg font-medium">
                      {t("profile.follow")}
                    </button>
                  )}
                  {!isFollowing && requestedIds.has(u.user_id) && (
                    <span className="text-xs text-muted-foreground px-3 py-1">{t("profile.requested")}</span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {following.length === 0 && !showSearch ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-sm text-muted-foreground">{t("following.none")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5">
              <button onClick={() => navigate(`/profile/${f.id}`)} {...profileLinkProps(f.id, f.username, f.profile_picture)} className="flex items-center gap-3">
                <img
                  src={f.profile_picture || fallbackAvatarUrl(f.username)}
                  alt={f.username}
                  loading="lazy"
                  decoding="async"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-foreground" data-no-translate>{f.username}</span>
              </button>
              {!readOnly && (
                <button onClick={() => setPendingUnfollow(f)} className="p-1.5">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && filterQuery.trim() && (
            <p className="text-xs text-muted-foreground text-center py-4">{t("common.noMatches")}</p>
          )}
        </div>
      )}

      {/* Unfollow confirmation */}
      <AlertDialog open={!!pendingUnfollow} onOpenChange={(v) => !v && setPendingUnfollow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.unfollow")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("following.stopConfirm", { username: pendingUnfollow?.username ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = pendingUnfollow;
                setPendingUnfollow(null);
                if (target) await handleUnfollow(target);
              }}
            >
              {t("profile.unfollow")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
