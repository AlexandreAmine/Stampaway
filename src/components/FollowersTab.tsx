import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
    setFollowers(prev => prev.filter(f => f.id !== followerId));
    toast.success(`${username} removed from followers`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (followers.length === 0) {
    return <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">No followers yet</p></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
      {followers.map((f) => (
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
            <button onClick={() => removeFollower(f.id, f.username)} className="p-1.5 rounded-full hover:bg-muted/50 shrink-0">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      ))}
    </motion.div>
  );
}