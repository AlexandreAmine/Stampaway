import { useState, useEffect } from "react";
import { Plus, X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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

interface FollowUser {
  id: string;
  followId: string;
  username: string;
  profile_picture: string | null;
}

export function FollowingTab({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const targetUserId = userId || user?.id;
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ user_id: string; username: string; profile_picture: string | null }[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [pendingUnfollow, setPendingUnfollow] = useState<FollowUser | null>(null);

  useEffect(() => {
    if (targetUserId) fetchFollowing();
  }, [targetUserId]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchFollowing = async () => {
    if (!targetUserId) return;
    const { data } = await supabase
      .from("followers")
      .select("id, following_id")
      .eq("follower_id", targetUserId);

    if (data && data.length > 0) {
      const ids = data.map((f) => f.following_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", ids);

      if (profiles) {
        setFollowing(profiles.map((p) => {
          const follow = data.find((f) => f.following_id === p.user_id);
          return { id: p.user_id, followId: follow!.id, username: p.username, profile_picture: p.profile_picture };
        }));
      }
    } else {
      setFollowing([]);
    }
    setLoading(false);
  };

  const searchUsers = async (search: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, profile_picture")
      .ilike("username", `%${search}%`)
      .neq("user_id", user.id)
      .limit(10);
    setSearchResults(data || []);
  };

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    const already = following.some((f) => f.id === targetId);
    if (already) { toast("Already following"); return; }
    const { error } = await supabase.from("followers").insert({ follower_id: user.id, following_id: targetId });
    if (error) { toast.error("Failed to follow"); return; }
    toast.success("Following!");
    setShowSearch(false);
    setQuery("");
    fetchFollowing();
  };

  const handleUnfollow = async (followId: string, username: string) => {
    await supabase.from("followers").delete().eq("id", followId);
    toast.success(`Unfollowed ${username}`);
    fetchFollowing();
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-10 bg-muted/40 rounded-xl animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full bg-muted/40 animate-pulse" />
            <div className="h-3 w-32 bg-muted/40 rounded animate-pulse" />
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
            placeholder="Search"
            className="w-full bg-card rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-9 h-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center"
            aria-label="Find users to follow"
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
                placeholder="Find users to follow..."
                className="w-full bg-card rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {searchResults.map((u) => {
              const isFollowing = following.some((f) => f.id === u.user_id);
              return (
                <div key={u.user_id} className="flex items-center justify-between py-2">
                  <button onClick={() => navigate(`/profile/${u.user_id}`)} className="flex items-center gap-3">
                    <img
                      src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=3B82F6&color=fff&size=32`}
                      alt={u.username}
                      loading="lazy"
                      decoding="async"
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium text-foreground">{u.username}</span>
                  </button>
                  {!isFollowing && (
                    <button onClick={() => handleFollow(u.user_id)} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg font-medium">
                      Follow
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {following.length === 0 && !showSearch ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-sm text-muted-foreground">Not following anyone yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5">
              <button onClick={() => navigate(`/profile/${f.id}`)} className="flex items-center gap-3">
                <img
                  src={f.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.username)}&background=3B82F6&color=fff&size=32`}
                  alt={f.username}
                  loading="lazy"
                  decoding="async"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-foreground">{f.username}</span>
              </button>
              {!readOnly && (
                <button onClick={() => setPendingUnfollow(f)} className="p-1.5">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && filterQuery.trim() && (
            <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
          )}
        </div>
      )}

      {/* Unfollow confirmation */}
      <AlertDialog open={!!pendingUnfollow} onOpenChange={(v) => !v && setPendingUnfollow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow</AlertDialogTitle>
            <AlertDialogDescription>
              Stop following {pendingUnfollow?.username}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (pendingUnfollow) await handleUnfollow(pendingUnfollow.followId, pendingUnfollow.username);
                setPendingUnfollow(null);
              }}
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
