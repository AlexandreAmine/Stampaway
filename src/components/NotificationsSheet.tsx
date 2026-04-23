import { useState, useEffect } from "react";
import { X, UserPlus, Heart, Check, XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
}

interface NotifItem {
  type: "new_follower" | "follow_request" | "review_like" | "list_like";
  id: string;
  userId: string;
  username: string;
  profilePicture: string | null;
  extra?: string;
  createdAt: string;
}

export function NotificationsSheet({ open, onClose }: NotificationsSheetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    fetchAll();
  }, [open, user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const allItems: NotifItem[] = [];

    // Recent followers
    const { data: followers } = await supabase
      .from("followers")
      .select("id, follower_id, created_at")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Follow requests
    const { data: requests } = await supabase
      .from("follow_requests")
      .select("id, requester_id, created_at")
      .eq("target_id", user.id)
      .order("created_at", { ascending: false });

    // Review likes
    const { data: myReviews } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id);
    const myReviewIds = (myReviews || []).map(r => r.id);

    let reviewLikes: any[] = [];
    if (myReviewIds.length > 0) {
      const { data } = await supabase
        .from("review_likes")
        .select("id, user_id, review_id, created_at")
        .in("review_id", myReviewIds)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      reviewLikes = data || [];
    }

    // List likes
    const { data: myLists } = await supabase
      .from("lists")
      .select("id, name")
      .eq("user_id", user.id);
    const myListMap = new Map((myLists || []).map(l => [l.id, l.name]));
    const myListIds = [...myListMap.keys()];

    let listLikes: any[] = [];
    if (myListIds.length > 0) {
      const { data } = await supabase
        .from("list_likes")
        .select("id, user_id, list_id, created_at")
        .in("list_id", myListIds)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      listLikes = data || [];
    }

    // Collect all user IDs for profiles
    const allUserIds = new Set<string>();
    (followers || []).forEach(f => allUserIds.add(f.follower_id));
    (requests || []).forEach(r => allUserIds.add(r.requester_id));
    reviewLikes.forEach(l => allUserIds.add(l.user_id));
    listLikes.forEach(l => allUserIds.add(l.user_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, profile_picture")
      .in("user_id", [...allUserIds]);
    const pMap = new Map((profiles || []).map(p => [p.user_id, p]));

    (requests || []).forEach(r => {
      const p = pMap.get(r.requester_id);
      allItems.push({ type: "follow_request", id: r.id, userId: r.requester_id, username: p?.username || "User", profilePicture: p?.profile_picture || null, createdAt: r.created_at });
    });

    (followers || []).forEach(f => {
      const p = pMap.get(f.follower_id);
      allItems.push({ type: "new_follower", id: f.id, userId: f.follower_id, username: p?.username || "User", profilePicture: p?.profile_picture || null, createdAt: f.created_at });
    });

    reviewLikes.forEach(l => {
      const p = pMap.get(l.user_id);
      allItems.push({ type: "review_like", id: l.id, userId: l.user_id, username: p?.username || "User", profilePicture: p?.profile_picture || null, createdAt: l.created_at });
    });

    listLikes.forEach(l => {
      const p = pMap.get(l.user_id);
      allItems.push({ type: "list_like", id: l.id, userId: l.user_id, username: p?.username || "User", profilePicture: p?.profile_picture || null, extra: myListMap.get(l.list_id) || "a list", createdAt: l.created_at });
    });

    // Sort by date, but keep follow_requests at top
    allItems.sort((a, b) => {
      if (a.type === "follow_request" && b.type !== "follow_request") return -1;
      if (b.type === "follow_request" && a.type !== "follow_request") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setItems(allItems);
    setLoading(false);
  };

  const acceptRequest = async (requestId: string, requesterId: string) => {
    if (!user) return;
    // Add to followers
    await supabase.from("followers").insert({ follower_id: requesterId, following_id: user.id });
    // Remove request
    await supabase.from("follow_requests").delete().eq("id", requestId);
    const profile = items.find(i => i.id === requestId);
    toast.success(`${profile?.username || "User"} started following you`);
    fetchAll();
  };

  const declineRequest = async (requestId: string) => {
    await supabase.from("follow_requests").delete().eq("id", requestId);
    toast.success("Follow request declined");
    fetchAll();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card w-full max-w-lg rounded-t-2xl border border-border max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom">
        <div className="sticky top-0 bg-card z-10 flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Activity</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
<div className="p-4 pb-16">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-3">
                  <button onClick={() => { onClose(); navigate(item.userId === user?.id ? "/profile" : `/profile/${item.userId}`); }}>
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={item.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=3B82F6&color=fff`} />
                      <AvatarFallback>{item.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <button onClick={() => { onClose(); navigate(`/profile/${item.userId}`); }} className="font-semibold hover:underline">{item.username}</button>
                      {" "}
                      {item.type === "new_follower" && "started following you"}
                      {item.type === "follow_request" && "wants to follow you"}
                      {item.type === "review_like" && "liked your review"}
                      {item.type === "list_like" && <>liked your list "<span className="font-medium">{item.extra}</span>"</>}
                    </p>
                  </div>
                  {item.type === "follow_request" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => acceptRequest(item.id, item.userId)} className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </button>
                      <button onClick={() => declineRequest(item.id)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <XIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
