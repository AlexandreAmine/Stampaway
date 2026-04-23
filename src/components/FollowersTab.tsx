import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Search } from "lucide-react";
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

interface FollowerUser {
  id: string;
  username: string;
  profile_picture: string | null;
}

export function FollowersTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const targetUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [pendingRemove, setPendingRemove] = useState<FollowerUser | null>(null);

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const { data } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("following_id", targetUserId);

      if (data && data.length > 0) {
        const ids = data.map((f) => f.follower_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", ids);

        if (profiles) {
          setFollowers(profiles.map((p) => ({ id: p.user_id, username: p.username, profile_picture: p.profile_picture })));
        }
      } else {
        setFollowers([]);
      }
      setLoading(false);
    })();
  }, [targetUserId]);

  const removeFollower = async (followerId: string, username: string) => {
    if (!user) return;
    await supabase.from("followers").delete().eq("follower_id", followerId).eq("following_id", user.id);
    setFollowers((prev) => prev.filter((f) => f.id !== followerId));
    toast.success(`${username} removed from followers`);
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
    ? followers.filter((f) => f.username.toLowerCase().includes(filterQuery.toLowerCase()))
    : followers;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Search"
          className="w-full bg-card rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {followers.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm text-muted-foreground">No followers yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2.5 w-full">
              <button onClick={() => navigate(`/profile/${f.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <img
                  src={f.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.username)}&background=3B82F6&color=fff&size=32`}
                  alt={f.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-foreground">{f.username}</span>
              </button>
              {isOwnProfile && (
                <button onClick={() => setPendingRemove(f)} className="p-1.5 rounded-full hover:bg-muted/50 shrink-0">
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

      {/* Remove follower confirmation */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(v) => !v && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove follower</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.username} will no longer follow you. They won't be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (pendingRemove) await removeFollower(pendingRemove.id, pendingRemove.username);
                setPendingRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
