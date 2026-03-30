import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";

interface LikedEntry {
  id: string;
  rating: number;
  place: { id: string; name: string; country: string; type: string; image: string | null };
}

interface LikedReview {
  id: string;
  review_id: string;
  review: any;
}

interface LikedList {
  id: string;
  list_id: string;
  list: any;
}

type Section = "countries" | "cities" | "reviews" | "lists";

export function LikesTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("countries");
  const [countries, setCountries] = useState<LikedEntry[]>([]);
  const [cities, setCities] = useState<LikedEntry[]>([]);
  const [likedReviews, setLikedReviews] = useState<any[]>([]);
  const [likedLists, setLikedLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    fetchAll();
  }, [targetUserId]);

  const fetchAll = async () => {
    if (!targetUserId) return;
    setLoading(true);

    // Liked destinations (countries & cities)
    const { data: destData } = await supabase
      .from("reviews")
      .select("id, rating, places!inner(id, name, country, type, image)")
      .eq("user_id", targetUserId)
      .eq("liked", true)
      .order("created_at", { ascending: false });

    if (destData) {
      const mapped = destData.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        place: { id: r.places.id, name: r.places.name, country: r.places.country, type: r.places.type, image: r.places.image },
      }));
      setCountries(mapped.filter((m) => m.place.type === "country"));
      setCities(mapped.filter((m) => m.place.type === "city"));
    }

    // Liked reviews
    const { data: reviewLikes } = await supabase
      .from("review_likes")
      .select("id, review_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (reviewLikes && reviewLikes.length > 0) {
      const reviewIds = reviewLikes.map((rl) => rl.review_id);
      const { data: reviews } = await supabase
        .from("reviews")
        .select("*, places!inner(name, image)")
        .in("id", reviewIds);

      if (reviews && reviews.length > 0) {
        const userIds = [...new Set(reviews.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

        setLikedReviews(
          reviewIds
            .map((rid) => {
              const r = reviews.find((rv: any) => rv.id === rid);
              if (!r) return null;
              const prof = profileMap.get(r.user_id);
              return {
                ...r,
                profile_username: prof?.username,
                profile_picture: prof?.profile_picture,
                place_name: (r as any).places?.name,
                place_image: (r as any).places?.image,
              };
            })
            .filter(Boolean)
        );
      }
    }

    // Liked lists
    const { data: listLikes } = await supabase
      .from("list_likes")
      .select("id, list_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (listLikes && listLikes.length > 0) {
      const listIds = listLikes.map((ll) => ll.list_id);
      const { data: lists } = await supabase
        .from("lists")
        .select("*")
        .in("id", listIds);

      if (lists && lists.length > 0) {
        const userIds = [...new Set(lists.map((l) => l.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

        const enriched = await Promise.all(
          listIds.map(async (lid) => {
            const l = lists.find((ls: any) => ls.id === lid);
            if (!l) return null;
            const { count } = await supabase
              .from("list_items")
              .select("*", { count: "exact", head: true })
              .eq("list_id", l.id);
            const prof = profileMap.get(l.user_id);
            return {
              ...l,
              item_count: count || 0,
              username: prof?.username,
              profile_picture: prof?.profile_picture,
            };
          })
        );
        setLikedLists(enriched.filter(Boolean));
      }
    }

    setLoading(false);
  };

  const sections: { key: Section; label: string; count: number }[] = [
    { key: "countries", label: "Countries", count: countries.length },
    { key: "cities", label: "Cities", count: cities.length },
    { key: "reviews", label: "Reviews", count: likedReviews.length },
    { key: "lists", label: "Lists", count: likedLists.length },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Section tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === s.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {s.label} {s.count > 0 && `(${s.count})`}
          </button>
        ))}
      </div>

      {/* Countries */}
      {activeSection === "countries" && (
        countries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No liked countries yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {countries.map((item) => (
              <button key={item.id} onClick={() => navigate(`/place/${item.place.id}`)} className="relative text-left">
                <div className="aspect-[3/4] w-full relative">
                  {isOtherUser && <PosterWishlistButton placeId={item.place.id} placeName={item.place.name} />}
                  <DestinationPoster placeId={item.place.id} name={item.place.name} country={item.place.country} type="country" image={item.place.image} className="w-full h-full" />
                </div>
                <div className="mt-1.5 flex justify-center">
                  <StarRating rating={item.rating} size={12} liked />
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Cities */}
      {activeSection === "cities" && (
        cities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No liked cities yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {cities.map((item) => (
              <button key={item.id} onClick={() => navigate(`/place/${item.place.id}`)} className="relative text-left">
                <div className="aspect-[3/4] w-full relative">
                  {isOtherUser && <PosterWishlistButton placeId={item.place.id} placeName={item.place.name} />}
                  <DestinationPoster placeId={item.place.id} name={item.place.name} country={item.place.country} type="city" image={item.place.image} className="w-full h-full" />
                </div>
                <div className="mt-1.5 flex justify-center">
                  <StarRating rating={item.rating} size={12} liked />
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Reviews */}
      {activeSection === "reviews" && (
        likedReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No liked reviews yet</p>
        ) : (
          <div className="space-y-3">
            {likedReviews.map((r: any) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )
      )}

      {/* Lists */}
      {activeSection === "lists" && (
        likedLists.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No liked lists yet</p>
        ) : (
          <div className="space-y-3">
            {likedLists.map((l: any) => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-4 border border-border">
                <button onClick={() => navigate(`/profile/${l.user_id}`)} className="w-full text-left">
                  <div className="flex items-center gap-2 mb-1">
                    {l.profile_picture && (
                      <img src={l.profile_picture} alt="" className="w-6 h-6 rounded-full object-cover" />
                    )}
                    <span className="text-xs text-muted-foreground">{l.username || "User"}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.item_count} destination{l.item_count !== 1 ? "s" : ""}</p>
                </button>
              </motion.div>
            ))}
          </div>
        )
      )}
    </motion.div>
  );
}
