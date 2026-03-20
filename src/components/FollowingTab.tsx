import { useState, useEffect } from "react";
import { Plus, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  useEffect(() => {
    if (user) fetchFollowing();
  }, [user]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchFollowing = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers")
      .select("id, following_id")
      .eq("follower_id", user.id);

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

  const handleUnfollow = async (followId: string) => {
    await supabase.from("followers").delete().eq("id", followId);
    toast.success("Unfollowed");
    fetchFollowing();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{following.length} following</p>
        <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 text-primary" />
        </button>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-card rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {searchResults.map((u) => {
              const isFollowing = following.some((f) => f.id === u.user_id);
              return (
                <div key={u.user_id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=3B82F6&color=fff&size=32`}
                      alt={u.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium text-foreground">{u.username}</span>
                  </div>
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
          {following.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <img
                  src={f.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.username)}&background=3B82F6&color=fff&size=32`}
                  alt={f.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-foreground">{f.username}</span>
              </div>
              <button onClick={() => handleUnfollow(f.followId)} className="p-1.5">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
