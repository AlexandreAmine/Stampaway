import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Users, List, MessageSquare, Bookmark } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { RatingHistogram } from "@/components/RatingHistogram";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getFlagUrl } from "@/lib/countryFlags";

interface PlaceData {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
}

export default function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [place, setPlace] = useState<PlaceData | null>(null);
  const [description, setDescription] = useState("");
  const [loadingDesc, setLoadingDesc] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [distribution, setDistribution] = useState<number[]>(Array(10).fill(0));
  const [myReview, setMyReview] = useState<any>(null);
  const [visitorsCount, setVisitorsCount] = useState(0);
  const [writtenReviewsCount, setWrittenReviewsCount] = useState(0);
  const [listsCount, setListsCount] = useState(0);
  const [allVisitors, setAllVisitors] = useState<any[]>([]);
  const [allLists, setAllLists] = useState<any[]>([]);
  const [friendVisitors, setFriendVisitors] = useState<any[]>([]);
  const [friendWishlist, setFriendWishlist] = useState<any[]>([]);
  const [writtenReviews, setWrittenReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [inWishlist, setInWishlist] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [countryCities, setCountryCities] = useState<any[]>([]);
  const [wishlistCities, setWishlistCities] = useState<any[]>([]);

  useEffect(() => {
    if (id) fetchAll();
  }, [id, user]);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);

    // Fetch place
    const { data: placeData } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
    if (!placeData) { setLoading(false); return; }
    setPlace(placeData);

    // Fetch description from Wikipedia
    fetchDescription(placeData.name, placeData.type, placeData.country);

    // Fetch all reviews for this place
    const { data: allReviews } = await supabase
      .from("reviews")
      .select("id, rating, user_id, review_text, liked, created_at, visit_year, visit_month, duration_days")
      .eq("place_id", id);

    const reviews = allReviews || [];

    // Written reviews with profiles
    const written = reviews.filter((r) => r.review_text && r.review_text.trim() !== "");
    setWrittenReviewsCount(written.length);
    if (written.length > 0) {
      const writerIds = [...new Set(written.map((w) => w.user_id))];
      const { data: writerProfiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", writerIds);
      setWrittenReviews(
        written
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((w) => {
            const p = (writerProfiles || []).find((p: any) => p.user_id === w.user_id);
            return { ...w, profile: p };
          })
      );
    }

    // Unique visitors (most recent review per user)
    const reviewsByUser = new Map<string, any>();
    reviews.forEach((r) => {
      const existing = reviewsByUser.get(r.user_id);
      if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
        reviewsByUser.set(r.user_id, r);
      }
    });
    const uniqueReviews = Array.from(reviewsByUser.values());
    const uniqueVisitorIds = [...reviewsByUser.keys()];
    setVisitorsCount(uniqueVisitorIds.length);
    setRatingsCount(reviews.length);

    if (uniqueVisitorIds.length > 0) {
      const { data: visitorProfiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", uniqueVisitorIds);
      setAllVisitors(
        uniqueReviews.map((r) => {
          const p = (visitorProfiles || []).find((pr: any) => pr.user_id === r.user_id);
          return { user_id: r.user_id, profile: p, rating: r.rating, liked: r.liked, review_id: r.id, has_review: !!(r.review_text && r.review_text.trim() !== "") };
        })
      );
    }

    // My review
    if (user) {
      const mine = reviews.find((r) => r.user_id === user.id);
      setMyReview(mine || null);
    }

    // Average & distribution
    if (reviews.length > 0) {
      const sum = reviews.reduce((a, r) => a + Number(r.rating), 0);
      setAvgRating(Math.round((sum / reviews.length) * 10) / 10);

      const dist = Array(10).fill(0);
      reviews.forEach((r) => {
        const idx = Math.round(Number(r.rating) * 2) - 1;
        if (idx >= 0 && idx < 10) dist[idx]++;
      });
      setDistribution(dist);
    }

    // Lists containing this place (with list details)
    const { data: listItemsData } = await supabase
      .from("list_items")
      .select("list_id, lists!inner(id, name, user_id)")
      .eq("place_id", id);
    
    if (listItemsData && listItemsData.length > 0) {
      const listUserIds = [...new Set((listItemsData as any[]).map((li: any) => li.lists.user_id))];
      const { data: listProfiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", listUserIds);
      setAllLists(
        (listItemsData as any[]).map((li: any) => {
          const p = (listProfiles || []).find((pr: any) => pr.user_id === li.lists.user_id);
          return { list_id: li.lists.id, list_name: li.lists.name, profile: p };
        })
      );
    }
    setListsCount(listItemsData?.length || 0);

    // Friends activity (people I follow)
    if (user) {
      const { data: following } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
      const followingIds = (following || []).map((f) => f.following_id);

      if (followingIds.length > 0) {
        // Friends who visited (most recent per friend)
        const friendReviewsByUser = new Map<string, any>();
        reviews.filter((r) => followingIds.includes(r.user_id)).forEach((r) => {
          const existing = friendReviewsByUser.get(r.user_id);
          if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
            friendReviewsByUser.set(r.user_id, r);
          }
        });
        const uniqueFriendReviews = Array.from(friendReviewsByUser.values());
        if (uniqueFriendReviews.length > 0) {
          const friendIds = uniqueFriendReviews.map((r) => r.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", friendIds);
          setFriendVisitors(
            uniqueFriendReviews.map((r) => {
              const p = (profiles || []).find((p: any) => p.user_id === r.user_id);
              return { ...r, profile: p, review_id: r.id, has_review: !!(r.review_text && r.review_text.trim() !== "") };
            })
          );
        }

        // Friends who want to visit
        const { data: friendWish } = await supabase.from("wishlists").select("user_id").eq("place_id", id).in("user_id", followingIds);
        if (friendWish && friendWish.length > 0) {
          const wishIds = friendWish.map((w) => w.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", wishIds);
          setFriendWishlist(profiles || []);
        }
      }
    }

    // Fetch cities in this country (only for country pages)
    if (placeData.type === "country") {
      const { data: citiesData } = await supabase
        .from("places")
        .select("id, name, country, type, image")
        .eq("type", "city")
        .eq("country", placeData.name);

      if (citiesData && citiesData.length > 0) {
        const cityIds = citiesData.map((c) => c.id);
        const { data: cityReviews } = await supabase
          .from("reviews")
          .select("place_id")
          .in("place_id", cityIds);

        const counts = new Map<string, number>();
        (cityReviews || []).forEach((r) => {
          counts.set(r.place_id, (counts.get(r.place_id) || 0) + 1);
        });

        const sorted = citiesData
          .map((c) => ({ ...c, review_count: counts.get(c.id) || 0 }))
          .sort((a, b) => b.review_count - a.review_count);
        setCountryCities(sorted);
      }

      // Wishlist cities in this country
      if (user) {
        const { data: wishData } = await supabase
          .from("wishlists")
          .select("place_id, places!inner(id, name, country, type)")
          .eq("user_id", user.id);

        const wishCities = (wishData || [])
          .filter((w: any) => w.places.type === "city" && w.places.country === placeData.name);
        setWishlistCities(wishCities);
      }
    }

    setLoading(false);
  };

  const fetchDescription = async (name: string, type: string, country: string) => {
    setLoadingDesc(true);
    try {
      const searchTerm = type === "city" ? `${name} ${country}` : name;
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.extract) {
          const sentences = data.extract.split(". ");
          setDescription(sentences.slice(0, 3).join(". ") + (sentences.length > 3 ? "." : ""));
        }
      }
    } catch {
      // silently fail
    }
    setLoadingDesc(false);
  };

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  };

  if (loading || !place) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const flagUrl = getFlagUrl(place.type === "country" ? place.name : place.country, 40);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Poster Hero */}
      <div className="relative h-64 w-full">
        <DestinationPoster
          placeId={place.id}
          name={place.name}
          country={place.country}
          type={place.type as "city" | "country"}
          image={place.image}
          autoGenerate
          className="w-full h-full rounded-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-5 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="px-5 -mt-16 relative z-10">
        {/* Name & Country */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-2 mb-1">
            {flagUrl && <img src={flagUrl} alt="" className="w-6 h-4 rounded-sm object-cover" />}
            <h1 className="text-2xl font-bold text-foreground">{place.name}</h1>
          </div>
          {place.type === "city" && (
            <p className="text-sm text-muted-foreground mb-4">{place.country}</p>
          )}
        </motion.div>

        {/* Description */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          {loadingDesc ? (
            <div className="h-12 bg-card rounded-lg animate-pulse mb-5" />
          ) : description ? (
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">{description}</p>
          ) : null}
        </motion.div>

        {/* Rating Distribution */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl font-bold text-foreground">{avgRating || "—"}</span>
            <div>
              <StarRating rating={avgRating} size={14} />
              <p className="text-xs text-muted-foreground mt-0.5">{ratingsCount} ratings</p>
            </div>
          </div>
          <RatingHistogram distribution={distribution} />
        </motion.div>

        {/* My Review */}
        {myReview && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-xl p-4 border border-border mb-5">
            <p className="text-xs text-primary font-medium mb-1">You rated this</p>
            <div className="flex items-center gap-2">
              <StarRating rating={myReview.rating} size={14} liked={myReview.liked} />
              <span className="text-sm font-semibold text-foreground">{myReview.rating}</span>
            </div>
            {myReview.review_text && (
              <p className="text-xs text-muted-foreground mt-2">{myReview.review_text}</p>
            )}
          </motion.div>
        )}

        {/* Visited by (friends) */}
        {friendVisitors.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Visited by</h3>
            <div className="space-y-2.5">
              {friendVisitors.map((fv: any) => (
                <div key={fv.id || fv.user_id} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={fv.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fv.profile?.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{fv.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-foreground flex-1">{fv.profile?.username}</p>
                  <button
                    onClick={() => navigate(`/review/${fv.review_id}`)}
                    className="flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <StarRating rating={fv.rating} size={12} liked={fv.liked} />
                    {fv.has_review && <MessageSquare className="w-3 h-3 text-primary" />}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Want to visit (friends) */}
        {friendWishlist.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mb-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Want to visit</h3>
            <div className="flex -space-x-2">
              {friendWishlist.map((fw: any) => (
                <Avatar key={fw.user_id} className="w-8 h-8 border-2 border-background">
                  <AvatarImage src={fw.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fw.username || "?")}&background=3B82F6&color=fff`} />
                  <AvatarFallback>{fw.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              <span className="text-xs text-muted-foreground ml-4 self-center">
                {friendWishlist.map((f: any) => f.username).join(", ")}
              </span>
            </div>
          </motion.div>
        )}




        {/* Stats row - clickable */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-around py-5 border-t border-border mt-2"
        >
          <button onClick={() => navigate(`/place/${id}/visitors`)} className="flex flex-col items-center gap-1">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{formatCount(visitorsCount)}</span>
            <span className="text-[10px] text-muted-foreground">Visitors</span>
          </button>
          <button onClick={() => navigate(`/place/${id}/reviews`)} className="flex flex-col items-center gap-1">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{formatCount(writtenReviewsCount)}</span>
            <span className="text-[10px] text-muted-foreground">Reviews</span>
          </button>
          <button onClick={() => navigate(`/place/${id}/lists`)} className="flex flex-col items-center gap-1">
            <List className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{formatCount(listsCount)}</span>
            <span className="text-[10px] text-muted-foreground">Lists</span>
          </button>
        </motion.div>

        {/* Country-specific: Cities in country */}
        {place.type === "country" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6">
            {/* Cities in country header */}
            <button
              onClick={() => navigate(`/country/${encodeURIComponent(place.name)}/cities`)}
              className="flex items-center justify-between w-full mb-4"
            >
              <h3 className="text-lg font-bold text-foreground">Cities in {place.name}</h3>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Top 8 cities grid */}
            {countryCities.length > 0 && (
              <div className="grid grid-cols-4 gap-2.5 mb-6">
                {countryCities.slice(0, 8).map((city: any) => (
                  <button
                    key={city.id}
                    onClick={() => navigate(`/place/${city.id}`)}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden active:scale-[0.97] transition-transform"
                  >
                    <DestinationPoster
                      placeId={city.id}
                      name={city.name}
                      country={city.country}
                      type="city"
                      image={city.image}
                      autoGenerate
                      className="w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Wishlist cities in country */}
            {wishlistCities.length > 0 && (
              <button
                onClick={() => navigate(`/country/${encodeURIComponent(place.name)}/cities?mode=wishlist`)}
                className="flex items-center justify-between w-full py-3 border-t border-border"
              >
                <h3 className="text-sm font-semibold text-foreground">Cities in your wishlist</h3>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">{wishlistCities.length}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
