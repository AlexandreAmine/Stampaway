import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  created_at: string;
}

export function YourActivity({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const all: ActivityItem[] = [];

      // Loggings (reviews created)
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, created_at, updated_at, place_id")
        .eq("user_id", user.id);
      
      const placeIds = [...new Set((reviews || []).map(r => r.place_id))];
      let placeMap: Record<string, string> = {};
      if (placeIds.length > 0) {
        const { data: places } = await supabase.from("places").select("id, name").in("id", placeIds);
        (places || []).forEach(p => { placeMap[p.id] = p.name; });
      }

      (reviews || []).forEach(r => {
        all.push({ id: `log-${r.id}`, type: "log", description: `Logged ${placeMap[r.place_id] || "a destination"}`, created_at: r.created_at });
        if (r.updated_at && r.updated_at !== r.created_at) {
          all.push({ id: `edit-${r.id}`, type: "edit", description: `Edited entry for ${placeMap[r.place_id] || "a destination"}`, created_at: r.updated_at });
        }
      });

      // Review likes (by me)
      const { data: reviewLikes } = await supabase
        .from("review_likes")
        .select("id, created_at, review_id")
        .eq("user_id", user.id);
      
      if (reviewLikes && reviewLikes.length > 0) {
        const rlReviewIds = reviewLikes.map(l => l.review_id);
        const { data: likedReviews } = await supabase.from("reviews").select("id, user_id").in("id", rlReviewIds);
        const likedUserIds = [...new Set((likedReviews || []).map(r => r.user_id))];
        let userMap: Record<string, string> = {};
        if (likedUserIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", likedUserIds);
          (profiles || []).forEach(p => { userMap[p.user_id] = p.username; });
        }
        reviewLikes.forEach(l => {
          const rev = (likedReviews || []).find(r => r.id === l.review_id);
          const uname = rev ? userMap[rev.user_id] || "someone" : "someone";
          all.push({ id: `rl-${l.id}`, type: "review_like", description: `Liked ${uname}'s review`, created_at: l.created_at });
        });
      }

      // List likes (by me)
      const { data: listLikes } = await supabase
        .from("list_likes")
        .select("id, created_at, list_id")
        .eq("user_id", user.id);
      
      if (listLikes && listLikes.length > 0) {
        const llIds = listLikes.map(l => l.list_id);
        const { data: likedLists } = await supabase.from("lists").select("id, name").in("id", llIds);
        const listMap: Record<string, string> = {};
        (likedLists || []).forEach(l => { listMap[l.id] = l.name; });
        listLikes.forEach(l => {
          all.push({ id: `ll-${l.id}`, type: "list_like", description: `Liked the list "${listMap[l.list_id] || "a list"}"`, created_at: l.created_at });
        });
      }

      // Following (people I started following)
      const { data: following } = await supabase
        .from("followers")
        .select("id, created_at, following_id")
        .eq("follower_id", user.id);
      
      if (following && following.length > 0) {
        const fIds = following.map(f => f.following_id);
        const { data: fProfiles } = await supabase.from("profiles").select("user_id, username").in("user_id", fIds);
        const fMap: Record<string, string> = {};
        (fProfiles || []).forEach(p => { fMap[p.user_id] = p.username; });
        following.forEach(f => {
          all.push({ id: `fol-${f.id}`, type: "follow", description: `Started following ${fMap[f.following_id] || "someone"}`, created_at: f.created_at });
        });
      }

      // Blocked users
      const { data: blocks } = await supabase
        .from("blocked_users")
        .select("id, created_at, blocked_id")
        .eq("blocker_id", user.id);
      
      if (blocks && blocks.length > 0) {
        const bIds = blocks.map(b => b.blocked_id);
        const { data: bProfiles } = await supabase.from("profiles").select("user_id, username").in("user_id", bIds);
        const bMap: Record<string, string> = {};
        (bProfiles || []).forEach(p => { bMap[p.user_id] = p.username; });
        blocks.forEach(b => {
          all.push({ id: `blk-${b.id}`, type: "block", description: `Blocked ${bMap[b.blocked_id] || "someone"}`, created_at: b.created_at });
        });
      }

      // Wishlist additions
      const { data: wishlists } = await supabase
        .from("wishlists")
        .select("id, created_at, place_id")
        .eq("user_id", user.id);
      
      if (wishlists && wishlists.length > 0) {
        const wPlaceIds = wishlists.map(w => w.place_id);
        let wPlaceMap: Record<string, string> = {};
        if (wPlaceIds.length > 0) {
          const { data: wPlaces } = await supabase.from("places").select("id, name").in("id", wPlaceIds);
          (wPlaces || []).forEach(p => { wPlaceMap[p.id] = p.name; });
        }
        wishlists.forEach(w => {
          all.push({ id: `wl-${w.id}`, type: "wishlist", description: `Added ${wPlaceMap[w.place_id] || "a destination"} to wishlist`, created_at: w.created_at });
        });
      }

      // Lists created
      const { data: lists } = await supabase
        .from("lists")
        .select("id, created_at, name")
        .eq("user_id", user.id);
      
      (lists || []).forEach(l => {
        all.push({ id: `lst-${l.id}`, type: "list_create", description: `Created the list "${l.name}"`, created_at: l.created_at });
      });

      // Yearly goals set/edited
      const { data: goals } = await supabase
        .from("yearly_goals")
        .select("id, created_at, updated_at, year, continent")
        .eq("user_id", user.id);
      
      (goals || []).forEach(g => {
        const label = g.continent === "total" ? `${g.year}` : `${g.year} (${g.continent})`;
        all.push({ id: `goal-${g.id}`, type: "goal_set", description: `Set yearly goal for ${label}`, created_at: g.created_at });
        if (g.updated_at && g.updated_at !== g.created_at) {
          all.push({ id: `goal-edit-${g.id}`, type: "goal_edit", description: `Edited yearly goal for ${label}`, created_at: g.updated_at });
        }
      });

      // Yearly goal places (must-visit additions)
      const { data: goalPlaces } = await supabase
        .from("yearly_goal_places")
        .select("id, created_at, place_id, year")
        .eq("user_id", user.id);
      
      if (goalPlaces && goalPlaces.length > 0) {
        const gpPlaceIds = goalPlaces.map(g => g.place_id);
        let gpPlaceMap: Record<string, string> = {};
        if (gpPlaceIds.length > 0) {
          const { data: gpPlaces } = await supabase.from("places").select("id, name").in("id", gpPlaceIds);
          (gpPlaces || []).forEach(p => { gpPlaceMap[p.id] = p.name; });
        }
        goalPlaces.forEach(g => {
          all.push({ id: `gp-${g.id}`, type: "goal_place", description: `Added ${gpPlaceMap[g.place_id] || "a destination"} to ${g.year} must-visit list`, created_at: g.created_at });
        });
      }

      // Favorites
      const { data: favorites } = await supabase
        .from("favorite_places")
        .select("id, created_at, place_id")
        .eq("user_id", user.id);
      
      if (favorites && favorites.length > 0) {
        const favPlaceIds = favorites.map(f => f.place_id);
        let favPlaceMap: Record<string, string> = {};
        if (favPlaceIds.length > 0) {
          const { data: favPlaces } = await supabase.from("places").select("id, name").in("id", favPlaceIds);
          (favPlaces || []).forEach(p => { favPlaceMap[p.id] = p.name; });
        }
        favorites.forEach(f => {
          all.push({ id: `fav-${f.id}`, type: "favorite", description: `Added ${favPlaceMap[f.place_id] || "a destination"} to favorites`, created_at: f.created_at });
        });
      }

      // Sort by most recent
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(all);
      setLoading(false);
    })();
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case "log": return "📍";
      case "edit": return "✏️";
      case "review_like": return "❤️";
      case "list_like": return "❤️";
      case "follow": return "👤";
      case "block": return "🚫";
      case "wishlist": return "🔖";
      case "list_create": return "📋";
      case "favorite": return "⭐";
      case "goal_set": return "🎯";
      case "goal_edit": return "🎯";
      case "goal_place": return "📌";
      default: return "•";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack}><ChevronLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="text-xl font-bold text-foreground">Your Activity</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">No activity yet</p>
        ) : (
          <div className="space-y-0">
            {activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                <span className="text-base mt-0.5">{getIcon(a.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
