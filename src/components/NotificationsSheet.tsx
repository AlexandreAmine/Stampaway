import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, Heart, Check, XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { hapticSuccess, hapticMedium, hapticLight } from "@/lib/haptics";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import { useSheetTransition } from "@/hooks/useSheetTransition";
import { formatDistanceToNow } from "date-fns";

interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
}

interface NotifItem {
  type: "new_follower" | "follow_request" | "review_like" | "list_like" | "review_comment";
  id: string;
  userId: string;
  username: string;
  profilePicture: string | null;
  extra?: string;
  createdAt: string;
}

export function NotificationsSheet({ open, onClose }: NotificationsSheetProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { closing, requestClose } = useSheetTransition(open, onClose);

  // Cached by React Query (and persisted): reopening the sheet renders the
  // last known notifications instantly while a background refetch updates
  // them in place. isPending is only true on the very first open.
  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id ?? null],
    enabled: open && !!user,
    queryFn: () => fetchAllNotifications(user!.id),
  });
  const items = notificationsQuery.data ?? [];
  const loading = notificationsQuery.isPending;

  const fetchAllNotifications = async (userId: string): Promise<NotifItem[]> => {
    const allItems: NotifItem[] = [];

    // Stage 1 — independent lookups, all in parallel:
    // recent followers, follow requests, my review ids, my lists
    const [{ data: followers }, { data: requests }, { data: myReviews }, { data: myLists }] =
      await Promise.all([
        supabase
          .from("followers")
          .select("id, follower_id, created_at")
          .eq("following_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("follow_requests")
          .select("id, requester_id, created_at")
          .eq("target_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select("id, place_id")
          .eq("user_id", userId),
        supabase
          .from("lists")
          .select("id, name")
          .eq("user_id", userId),
      ]);

    const myReviewIds = (myReviews || []).map(r => r.id);
    const reviewPlaceMap = new Map((myReviews || []).map(r => [r.id, r.place_id]));
    const placeIds = [...new Set((myReviews || []).map(r => r.place_id))];
    const myListMap = new Map((myLists || []).map(l => [l.id, l.name]));
    const myListIds = [...myListMap.keys()];

    // Stage 2 — everything that depends on stage 1, all in parallel:
    // place names, likes/comments on my reviews, likes on my lists
    const [placesRes, reviewLikesRes, reviewCommentsRes, listLikesRes] = await Promise.all([
      placeIds.length > 0
        ? supabase.from("places").select("id, name").in("id", placeIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      myReviewIds.length > 0
        ? supabase
            .from("review_likes")
            .select("id, user_id, review_id, created_at")
            .in("review_id", myReviewIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as any[] }),
      myReviewIds.length > 0
        ? supabase
            .from("review_comments")
            .select("id, user_id, review_id, created_at")
            .in("review_id", myReviewIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as any[] }),
      myListIds.length > 0
        ? supabase
            .from("list_likes")
            .select("id, user_id, list_id, created_at")
            .in("list_id", myListIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const placeNameMap = new Map<string, string>();
    (placesRes.data || []).forEach(p => placeNameMap.set(p.id, p.name));
    const reviewLikes: any[] = reviewLikesRes.data || [];
    const reviewComments: any[] = reviewCommentsRes.data || [];
    const listLikes: any[] = listLikesRes.data || [];

    // Collect all user IDs for profiles
    const allUserIds = new Set<string>();
    (followers || []).forEach(f => allUserIds.add(f.follower_id));
    (requests || []).forEach(r => allUserIds.add(r.requester_id));
    reviewLikes.forEach(l => allUserIds.add(l.user_id));
    reviewComments.forEach(c => allUserIds.add(c.user_id));
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
      const placeId = reviewPlaceMap.get(l.review_id);
      const placeName = placeId ? placeNameMap.get(placeId) || "a destination" : "a destination";
      allItems.push({ type: "review_like", id: l.id, userId: l.user_id, username: p?.username || "User", profilePicture: p?.profile_picture || null, extra: placeName, createdAt: l.created_at });
    });

    reviewComments.forEach(c => {
      const p = pMap.get(c.user_id);
      const placeId = reviewPlaceMap.get(c.review_id);
      const placeName = placeId ? placeNameMap.get(placeId) || "a destination" : "a destination";
      allItems.push({ type: "review_comment", id: c.id, userId: c.user_id, username: p?.username || "User", profilePicture: p?.profile_picture || null, extra: placeName, createdAt: c.created_at });
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

    return allItems;
  };

  const acceptRequest = async (requestId: string, requesterId: string) => {
    if (!user) return;
    hapticMedium();
    // Add to followers
    const { error } = await supabase.from("followers").insert({ follower_id: requesterId, following_id: user.id });
    if (!error) invalidateOwnProfileContentCache(user.id);
    // Remove request
    await supabase.from("follow_requests").delete().eq("id", requestId);
    const profile = items.find(i => i.id === requestId);
    toast.success(`${profile?.username || "User"} started following you`);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const declineRequest = async (requestId: string) => {
    hapticLight();
    await supabase.from("follow_requests").delete().eq("id", requestId);
    toast.success("Follow request declined");
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 bg-black/60 ${closing ? "animate-out fade-out fill-mode-forwards duration-200" : "animate-in fade-in duration-200"}`}
        onClick={requestClose}
      />
      <div
        className={`relative bg-card w-full max-w-lg rounded-t-2xl border border-border flex flex-col ${closing ? "animate-out slide-out-to-bottom fill-mode-forwards duration-200" : "animate-in slide-in-from-bottom duration-200"}`}
        style={{ height: "85vh", maxHeight: "85vh" }}
      >
        <div className="bg-card flex items-center justify-between p-4 border-b border-border rounded-t-2xl shrink-0">
          <h2 className="text-lg font-bold text-foreground">Notifications</h2>
          <button onClick={requestClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4"
          style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem)" }}
        >
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted/40 rounded-xl skeleton-shimmer" />
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
                      <AvatarImage src={item.profilePicture || fallbackAvatarUrl(item.username)} />
                      <AvatarFallback>{item.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <button onClick={() => { onClose(); navigate(`/profile/${item.userId}`); }} className="font-semibold hover:underline" data-no-translate>{item.username}</button>
                      {" "}
                      {item.type === "new_follower" && t("notifications.newFollower")}
                      {item.type === "follow_request" && t("notifications.followRequest")}
                      {item.type === "review_like" && <>{t("notifications.likedReview")} <span className="font-medium" data-no-translate>{item.extra}</span></>}
                      {item.type === "review_comment" && <>{t("notifications.commentedReview")} <span className="font-medium" data-no-translate>{item.extra}</span></>}
                      {item.type === "list_like" && <>{t("notifications.likedListPre")} "<span className="font-medium" data-no-translate>{item.extra}</span>"</>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }).replace(/^about /, "")}</p>
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
