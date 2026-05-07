import { useState, useEffect } from "react";
import { ChevronLeft, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlaceCategoryRatings } from "@/components/SubRatingsDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Section = "visitors" | "friendvisitors" | "reviews" | "lists" | "wanttovisit" | "categories";

export default function PlaceSubPage() {
  const { id, section } = useParams<{ id: string; section: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [placeName, setPlaceName] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<"most_liked" | "most_recent" | "friends_first">("most_liked");
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Map<string, number>>(new Map());
  const [friendIds, setFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (id && section) fetchData();
  }, [id, section]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const { data: place } = await supabase.from("places").select("name").eq("id", id).maybeSingle();
    setPlaceName(place?.name || "");

    if (section === "visitors" || section === "friendvisitors") {
      // For friendvisitors, we need the user's following list
      let followingSet = new Set<string>();
      if (section === "friendvisitors" && user) {
        const { data: following } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
        followingSet = new Set((following || []).map((f) => f.following_id));
      }

      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, rating, user_id, review_text, liked, created_at")
        .eq("place_id", id)
        .order("created_at", { ascending: false });

      // Most recent per user
      const seen = new Set<string>();
      let unique = (reviews || []).filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });

      // For friendvisitors, filter to only people the user follows
      if (section === "friendvisitors") {
        unique = unique.filter((r) => followingSet.has(r.user_id));
      }

      const userIds = unique.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      setData(
        unique.map((r) => {
          const p = (profiles || []).find((pr: any) => pr.user_id === r.user_id);
          return { ...r, profile: p, has_review: !!(r.review_text && r.review_text.trim() !== "") };
        })
      );
    } else if (section === "reviews") {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, rating, user_id, review_text, liked, created_at")
        .eq("place_id", id)
        .not("review_text", "is", null)
        .neq("review_text", "")
        .order("created_at", { ascending: false });

      // Most recent written review per user
      const seen = new Set<string>();
      const unique = (reviews || []).filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });

      const userIds = unique.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);

      // Fetch like counts for all reviews
      const reviewIds = unique.map((r) => r.id);
      const likeCounts = new Map<string, number>();
      if (reviewIds.length > 0) {
        const { data: likes } = await supabase
          .from("review_likes")
          .select("review_id")
          .in("review_id", reviewIds);
        (likes || []).forEach((l) => {
          likeCounts.set(l.review_id, (likeCounts.get(l.review_id) || 0) + 1);
        });
      }
      setReviewLikeCounts(likeCounts);

      // Fetch friend IDs
      if (user) {
        const { data: following } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
        setFriendIds((following || []).map((f) => f.following_id));
      }

      setData(
        unique.map((r) => {
          const p = (profiles || []).find((pr: any) => pr.user_id === r.user_id);
          return { ...r, profile: p };
        })
      );
    } else if (section === "lists") {
      const { data: listItems } = await supabase
        .from("list_items")
        .select("list_id, lists!inner(id, name, user_id)")
        .eq("place_id", id);

      if (listItems && listItems.length > 0) {
        const listUserIds = [...new Set((listItems as any[]).map((li: any) => li.lists.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", listUserIds);
        setData(
          (listItems as any[]).map((li: any) => {
            const p = (profiles || []).find((pr: any) => pr.user_id === li.lists.user_id);
            return { list_id: li.lists.id, list_name: li.lists.name, profile: p };
          })
        );
      }
    } else if (section === "wanttovisit") {
      const { data: wishlistData } = await supabase
        .from("wishlists")
        .select("user_id")
        .eq("place_id", id);

      if (wishlistData && wishlistData.length > 0) {
        const userIds = wishlistData.map((w) => w.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);
        setData(profiles || []);
      }
    }

    setLoading(false);
  };

  const title = section === "visitors" ? "Visitors" : section === "friendvisitors" ? "Visited by friends" : section === "reviews" ? "Reviews" : section === "wanttovisit" ? "Want to go" : section === "categories" ? "Category Ratings" : "Lists";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground">{placeName}</p>
          </div>
          {section === "reviews" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReviewFilter("most_liked")} className={reviewFilter === "most_liked" ? "bg-accent" : ""}>
                  Most liked
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReviewFilter("most_recent")} className={reviewFilter === "most_recent" ? "bg-accent" : ""}>
                  Most recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReviewFilter("friends_first")} className={reviewFilter === "friends_first" ? "bg-accent" : ""}>
                  Friend reviews first
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {loading && section !== "categories" ? (
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : section === "categories" ? (
          <PlaceCategoryRatings placeId={id!} userId={user?.id} />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No {title.toLowerCase()} yet</p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {(section === "visitors" || section === "friendvisitors") &&
              data.map((v: any) => (
                <div key={v.user_id} className="flex items-center gap-3 w-full">
                  <button onClick={() => navigate(v.user_id === user?.id ? "/profile" : `/profile/${v.user_id}`)} className="flex items-center gap-3 min-w-0 w-1/2 text-left">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={v.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.profile?.username || "?")}&background=3B82F6&color=fff`} />
                      <AvatarFallback>{v.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-foreground flex-1">{v.profile?.username || "User"}</p>
                  </button>
                  <button onClick={() => navigate(`/review/${v.id}`)} className="flex items-center justify-end gap-1.5 active:scale-95 transition-transform w-1/2 min-h-9 text-right">
                    {v.rating != null && <StarRating rating={Number(v.rating)} size={12} liked={v.liked} />}
                    {v.has_review && <MessageSquare className="w-3 h-3 text-primary" />}
                  </button>
                </div>
              ))}

            {section === "reviews" &&
              (() => {
                let sorted = [...data];
                if (reviewFilter === "most_liked") {
                  sorted.sort((a, b) => (reviewLikeCounts.get(b.id) || 0) - (reviewLikeCounts.get(a.id) || 0));
                } else if (reviewFilter === "most_recent") {
                  sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                } else if (reviewFilter === "friends_first") {
                  sorted.sort((a, b) => {
                    const aFriend = friendIds.includes(a.user_id) ? 1 : 0;
                    const bFriend = friendIds.includes(b.user_id) ? 1 : 0;
                    if (bFriend !== aFriend) return bFriend - aFriend;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  });
                }
                return sorted.map((rv: any) => (
                  <ReviewCard
                    key={rv.id}
                    review={{
                      id: rv.id,
                      user_id: rv.user_id,
                      rating: rv.rating,
                      review_text: rv.review_text,
                      created_at: rv.created_at,
                      profile_username: rv.profile?.username,
                      profile_picture: rv.profile?.profile_picture,
                    }}
                    showImage={false}
                    hidePlaceName
                  />
                ));
              })()}

            {section === "lists" &&
              data.map((l: any, i: number) => (
                <button key={i} onClick={() => navigate(`/list/${l.list_id}`)} className="flex items-center gap-3 w-full text-left">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={l.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.profile?.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{l.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-no-translate>{l.list_name}</p>
                    <p className="text-xs text-muted-foreground">by {l.profile?.username || "User"}</p>
                  </div>
                </button>
              ))}

            {section === "wanttovisit" &&
              data.map((w: any) => (
                <button key={w.user_id} onClick={() => navigate(w.user_id === user?.id ? "/profile" : `/profile/${w.user_id}`)} className="flex items-center gap-3 w-full text-left">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={w.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{w.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-foreground flex-1">{w.username || "User"}</p>
                </button>
              ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
