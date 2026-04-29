import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Users, List, MessageSquare, Bookmark, Plus, BarChart3, Pencil } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { RatingHistogram } from "@/components/RatingHistogram";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getFlagUrl } from "@/lib/countryFlags";
import { CountryFacts } from "@/components/CountryFacts";
import { CityFacts } from "@/components/CityFacts";
import { toast } from "sonner";
import { DiaryEditSheet } from "@/components/DiaryEditSheet";
import { dedupeByNewest } from "@/lib/reviewDedup";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";

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
  const { t, language } = useLanguage();

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
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  useEffect(() => {
    if (id) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, language]);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);

    // Fetch place
    const { data: placeData } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
    if (!placeData) { setLoading(false); return; }
    setPlace(placeData);

    // Check wishlist status
    if (user) {
      const { data: wl } = await supabase.from("wishlists").select("id").eq("user_id", user.id).eq("place_id", id).maybeSingle();
      setInWishlist(!!wl);
    }

    // Fetch description - use DB description first, fallback to Wikipedia
    fetchDescription(placeData.name, placeData.type, placeData.country, (placeData as any).description);

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

    // Unique visitors (newest visit date per user, fallback to most recent created_at)
    const uniqueReviews = dedupeByNewest(reviews, (r) => r.user_id);
    const uniqueVisitorIds = uniqueReviews.map((r) => r.user_id);
    setVisitorsCount(uniqueVisitorIds.length);
    // ratingsCount set below after filtering

    if (uniqueVisitorIds.length > 0) {
      const { data: visitorProfiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", uniqueVisitorIds);
      setAllVisitors(
        uniqueReviews.map((r) => {
          const p = (visitorProfiles || []).find((pr: any) => pr.user_id === r.user_id);
          return { user_id: r.user_id, profile: p, rating: r.rating, liked: r.liked, review_id: r.id, has_review: !!(r.review_text && r.review_text.trim() !== "") };
        })
      );
    }

    // My review (newest visit date)
    if (user) {
      const myReviews = reviews.filter((r) => r.user_id === user.id);
      const newest = dedupeByNewest(myReviews, (r) => r.user_id);
      setMyReview(newest[0] || null);
    }

    // Average & distribution - use one review per user (newest date)
    const ratedReviews = uniqueReviews.filter((r) => r.rating !== null && r.rating !== undefined);
    if (ratedReviews.length > 0) {
      const sum = ratedReviews.reduce((a, r) => a + Number(r.rating), 0);
      setAvgRating(Math.round((sum / ratedReviews.length) * 10) / 10);

      const dist = Array(10).fill(0);
      ratedReviews.forEach((r) => {
        const idx = Math.round(Number(r.rating) * 2) - 1;
        if (idx >= 0 && idx < 10) dist[idx]++;
      });
      setDistribution(dist);
    }
    setRatingsCount(ratedReviews.length);

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

  const fetchDescription = async (name: string, type: string, country: string, dbDescription?: string | null) => {
    setLoadingDesc(true);
    let baseEn = dbDescription || "";
    if (!baseEn) {
      try {
        const searchTerm = type === "city" ? `${name} ${country}` : name;
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.extract) {
            const sentences = data.extract.split(". ");
            baseEn = sentences.slice(0, 3).join(". ") + (sentences.length > 3 ? "." : "");
          }
        }
      } catch {
        // silently fail
      }
    }

    if (!baseEn) {
      setDescription("");
      setLoadingDesc(false);
      return;
    }

    if (language === "en") {
      setDescription(baseEn);
      setLoadingDesc(false);
      return;
    }

    // Translate to current language
    try {
      const { data } = await supabase.functions.invoke("translate-text", {
        body: { texts: [baseEn], language, kind: "description" },
      });
      const translated = data?.translations?.[0] || baseEn;
      setDescription(translated);
    } catch {
      setDescription(baseEn);
    }
    setLoadingDesc(false);
  };

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  };

  const toggleWishlist = async () => {
    if (!user || !id || togglingWishlist) return;
    setTogglingWishlist(true);
    if (inWishlist) {
      await supabase.from("wishlists").delete().eq("user_id", user.id).eq("place_id", id);
      setInWishlist(false);
    } else {
      await supabase.from("wishlists").insert({ user_id: user.id, place_id: id });
      setInWishlist(true);
      toast.success(`${place?.name} added to wishlist`, { duration: 2000 });
    }
    setTogglingWishlist(false);
  };

  const localizedName = useLocalizedPlaceName(place?.name, place?.type === "country");
  const localizedCountry = useLocalizedPlaceName(place?.country, true);

  if (loading || !place) {
    return (
      <div className="min-h-screen bg-background pt-12 px-5 max-w-lg mx-auto">
        <div className="space-y-4">
          <div className="aspect-[3/4] w-full max-w-[240px] mx-auto bg-muted/40 rounded-xl animate-pulse" />
          <div className="h-7 w-2/3 mx-auto bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-1/3 mx-auto bg-muted/40 rounded animate-pulse" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
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
          bare
          className="w-full h-full rounded-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-5 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        {user && (
          <div className="absolute top-12 right-5 flex items-center gap-2">
            <button
              onClick={toggleWishlist}
              className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
            >
              <Bookmark className={`w-5 h-5 transition-colors ${inWishlist ? "text-primary fill-primary" : "text-foreground"}`} />
            </button>
            <button
              onClick={() => navigate(`/add?placeId=${id}&placeName=${encodeURIComponent(place?.name || "")}&placeCountry=${encodeURIComponent(place?.country || "")}&placeImage=${encodeURIComponent(place?.image || "")}`)}
              className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
            >
              <Plus className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}
      </div>

      <div className="px-5 -mt-16 relative z-10">
        {/* Name & Country */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-2 mb-1">
            {flagUrl && <img src={flagUrl} alt="" className="w-6 h-4 rounded-sm object-cover" />}
            <h1 className="text-2xl font-bold text-foreground">{localizedName}</h1>
          </div>
          {place.type === "city" && (
            <p
              className="text-sm text-muted-foreground mb-4 cursor-pointer hover:underline"
              onClick={async () => {
                const { data } = await supabase.from("places").select("id").eq("type", "country").eq("name", place.country).maybeSingle();
                if (data) navigate(`/place/${data.id}`);
              }}
            >
              {localizedCountry}
            </p>
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
              <p className="text-xs text-muted-foreground mt-0.5">{ratingsCount} {t("place.ratings")}</p>
            </div>
            <button
              onClick={() => navigate(`/place/${id}/categories`)}
              className="flex items-center gap-1 ml-auto"
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-primary font-medium">{t("place.categoryRatings")}</span>
            </button>
          </div>
          <RatingHistogram distribution={distribution} />
        </motion.div>

        {/* My Review */}
        {myReview && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <button
              onClick={() => setEditSheetOpen(true)}
              className="w-full bg-card rounded-xl p-4 border border-border mb-5 text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-primary font-medium">You rated this</p>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <StarRating rating={myReview.rating} size={14} liked={myReview.liked} />
                <span className="text-sm font-semibold text-foreground">{myReview.rating}</span>
              </div>
              {myReview.review_text && (
                <p className="text-xs text-muted-foreground mt-2">{myReview.review_text}</p>
              )}
            </button>
          </motion.div>
        )}

        {/* Visited by (friends) */}
        {friendVisitors.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-5">
            <button
              onClick={() => navigate(`/place/${id}/friendvisitors`)}
              className="flex items-center gap-1 mb-3"
            >
              <h3 className="text-sm font-semibold text-foreground">{t("place.friendsVisited")}</h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
              {friendVisitors.map((fv: any) => (
                <button
                  key={fv.id || fv.user_id}
                  onClick={() => navigate(`/review/${fv.review_id}`)}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-card border border-border rounded-full pl-1 pr-3 py-1"
                >
                  <Avatar className="w-8 h-8" onClick={(e) => { e.stopPropagation(); navigate(fv.user_id === user?.id ? "/profile" : `/profile/${fv.user_id}`); }}>
                    <AvatarImage src={fv.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fv.profile?.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{fv.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-0.5">
                    {fv.rating != null && (
                      <StarRating rating={Number(fv.rating)} size={12} />
                    )}
                    {fv.has_review && <MessageSquare className="w-3 h-3 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Want to visit (friends) */}
        {friendWishlist.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mb-5">
            <button
              onClick={() => navigate(`/place/${id}/wanttovisit`)}
              className="flex items-center gap-1 mb-3"
            >
              <h3 className="text-sm font-semibold text-foreground">{t("place.friendsWishlist")}</h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
              {friendWishlist.map((fw: any) => (
                <button key={fw.user_id} onClick={() => navigate(fw.user_id === user?.id ? "/profile" : `/profile/${fw.user_id}`)}>
                  <Avatar className="w-9 h-9 border-2 border-border">
                    <AvatarImage src={fw.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fw.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{fw.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              ))}
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
            <span className="text-[10px] text-muted-foreground">{t("place.visitors")}</span>
          </button>
          <button onClick={() => navigate(`/place/${id}/reviews`)} className="flex flex-col items-center gap-1">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{formatCount(writtenReviewsCount)}</span>
            <span className="text-[10px] text-muted-foreground">{t("place.reviews")}</span>
          </button>
          <button onClick={() => navigate(`/place/${id}/lists`)} className="flex flex-col items-center gap-1">
            <List className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{formatCount(listsCount)}</span>
            <span className="text-[10px] text-muted-foreground">{t("place.lists")}</span>
          </button>
        </motion.div>

        {/* City Key Facts */}
        {place.type === "city" && (
          <CityFacts cityName={place.name} countryName={place.country} placeId={place.id} />
        )}

        {/* Country-specific: Cities in country */}
        {place.type === "country" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6">
            {/* Cities in country header */}
            <button
              onClick={() => navigate(`/country/${encodeURIComponent(place.name)}/cities`)}
              className="flex items-center justify-between w-full mb-4"
            >
              <h3 className="text-lg font-bold text-foreground">{t("place.citiesIn", { country: localizedName })}</h3>
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
                <h3 className="text-sm font-semibold text-foreground">{t("place.wishlistCities", { country: localizedName })}</h3>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">{wishlistCities.length}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            )}

            {/* Country Key Facts */}
            <CountryFacts countryName={place.name} placeId={place.id} />
          </motion.div>
        )}
      </div>

      {/* Edit sheet for my review */}
      {myReview && place && (
        <DiaryEditSheet
          entry={{
            id: myReview.id,
            rating: myReview.rating,
            liked: myReview.liked,
            review_text: myReview.review_text,
            visit_year: myReview.visit_year,
            visit_month: myReview.visit_month,
            duration_days: myReview.duration_days,
            place: {
              id: place.id,
              name: place.name,
              country: place.country,
              type: place.type,
              image: place.image,
            },
          }}
          open={editSheetOpen}
          onClose={() => setEditSheetOpen(false)}
          onSaved={() => fetchAll()}
        />
      )}
    </div>
  );
}
