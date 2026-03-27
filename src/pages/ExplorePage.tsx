import { useState, useEffect } from "react";
import { ChevronRight, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { ReviewCard } from "@/components/ReviewCard";
import { ListPreviewPosters } from "@/components/ListPreviewPosters";
import {
  EUROPE_COUNTRIES,
  ASIA_COUNTRIES,
  NORTH_AMERICA_COUNTRIES,
} from "@/lib/continents";

const tabs = ["Places", "Reviews", "Lists"];

type PlaceWithStat = {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
  stat: number;
};

type SectionConfig = {
  key: string;
  title: string;
  places: PlaceWithStat[];
  linkParams: string;
};

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState("Places");
  const navigate = useNavigate();
  const { user } = useAuth();

  // Places state
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [friendComments, setFriendComments] = useState<Map<string, { profile_picture: string | null; text: string; review_id: string }>>(new Map());

  // Reviews state
  const [friendReviews, setFriendReviews] = useState<any[]>([]);
  const [popularReviews, setPopularReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // Lists state
  const [friendLists, setFriendLists] = useState<any[]>([]);
  const [popularLists, setPopularLists] = useState<any[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  useEffect(() => {
    if (activeTab === "Places") fetchPlacesSections();
    if (activeTab === "Reviews") fetchReviewsSections();
    if (activeTab === "Lists") fetchListsSections();
  }, [activeTab]);

  // ── PLACES ──
  const fetchPlacesSections = async () => {
    setPlacesLoading(true);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: monthReviews } = await supabase
      .from("reviews")
      .select("place_id")
      .gte("created_at", startOfMonth);

    const monthCounts = new Map<string, number>();
    (monthReviews || []).forEach((r) => {
      monthCounts.set(r.place_id, (monthCounts.get(r.place_id) || 0) + 1);
    });

    let trendingCounts = monthCounts;
    if (monthCounts.size === 0) {
      const { data: allRevs } = await supabase.from("reviews").select("place_id");
      (allRevs || []).forEach((r) => {
        trendingCounts.set(r.place_id, (trendingCounts.get(r.place_id) || 0) + 1);
      });
    }

    const trendingIds = [...trendingCounts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const { data: allPlaces } = await supabase.from("places").select("*");
    const placesMap = new Map((allPlaces || []).map((p) => [p.id, p]));

    const { data: allRatings } = await supabase
      .from("reviews")
      .select("place_id, rating")
      .not("rating", "is", null);

    const ratingAgg = new Map<string, { total: number; count: number }>();
    (allRatings || []).forEach((r) => {
      const cur = ratingAgg.get(r.place_id) || { total: 0, count: 0 };
      cur.total += Number(r.rating);
      cur.count += 1;
      ratingAgg.set(r.place_id, cur);
    });

    const buildTrending = (type: string): PlaceWithStat[] =>
      trendingIds
        .map((id) => placesMap.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p && p.type === type)
        .slice(0, 8)
        .map((p) => ({ ...p, stat: trendingCounts.get(p.id) || 0 }));

    const buildTopRated = (type: string, countries: string[], limit: number): PlaceWithStat[] =>
      (allPlaces || [])
        .filter((p) => {
          if (p.type !== type) return false;
          return type === "country" ? countries.includes(p.name) : countries.includes(p.country);
        })
        .map((p) => {
          const s = ratingAgg.get(p.id);
          return { ...p, stat: s ? s.total / s.count : 0 };
        })
        .filter((p) => p.stat > 0)
        .sort((a, b) => b.stat - a.stat)
        .slice(0, limit);

    setSections([
      { key: "tc", title: "Trendy countries this month", places: buildTrending("country"), linkParams: "mode=trending&type=country" },
      { key: "tci", title: "Trendy cities this month", places: buildTrending("city"), linkParams: "mode=trending&type=city" },
      { key: "te", title: "Top 20 countries in Europe", places: buildTopRated("country", EUROPE_COUNTRIES, 8), linkParams: "mode=top-rated&type=country&continent=Europe&limit=20" },
      { key: "tna", title: "Top 15 cities in North America", places: buildTopRated("city", NORTH_AMERICA_COUNTRIES, 8), linkParams: "mode=top-rated&type=city&continent=North America&limit=15" },
      { key: "ta", title: "Top 25 countries in Asia", places: buildTopRated("country", ASIA_COUNTRIES, 8), linkParams: "mode=top-rated&type=country&continent=Asia&limit=25" },
    ]);

    // Fetch friend comments for displayed places
    if (user) {
      const { data: following } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
      const followingIds = (following || []).map((f) => f.following_id);
      if (followingIds.length > 0) {
        const { data: friendRevs } = await supabase
          .from("reviews")
          .select("id, place_id, review_text, user_id, created_at")
          .in("user_id", followingIds)
          .not("review_text", "is", null)
          .neq("review_text", "")
          .order("created_at", { ascending: false });
        
        if (friendRevs && friendRevs.length > 0) {
          const userIds = [...new Set(friendRevs.map((r) => r.user_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);
          const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
          
          const commentMap = new Map<string, { profile_picture: string | null; text: string; review_id: string }>();
          friendRevs.forEach((r) => {
            if (!commentMap.has(r.place_id)) {
              const prof = profileMap.get(r.user_id);
              commentMap.set(r.place_id, { profile_picture: prof?.profile_picture || null, text: r.review_text!, review_id: r.id });
            }
          });
          setFriendComments(commentMap);
        }
      }
    }

    setPlacesLoading(false);
  };

  // ── REVIEWS ──
  const fetchReviewsSections = async () => {
    setReviewsLoading(true);
    if (!user) { setReviewsLoading(false); return; }

    // Get who I follow
    const { data: following } = await supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", user.id);
    const followingIds = (following || []).map((f) => f.following_id);

    // Recent written reviews from friends (exclude own)
    if (followingIds.length > 0) {
      const { data: fRevs } = await supabase
        .from("reviews")
        .select("*, places!inner(name, image)")
        .in("user_id", followingIds)
        .not("review_text", "is", null)
        .neq("review_text", "")
        .order("created_at", { ascending: false })
        .limit(5);

      // Enrich with profile info
      const userIds = [...new Set((fRevs || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setFriendReviews(
        (fRevs || []).map((r: any) => {
          const prof = profileMap.get(r.user_id);
          return {
            ...r,
            profile_username: prof?.username,
            profile_picture: prof?.profile_picture,
            place_name: r.places?.name,
            place_image: r.places?.image,
          };
        })
      );
    } else {
      setFriendReviews([]);
    }

    // Most liked reviews (all users, exclude own)
    const { data: likeCounts } = await supabase
      .from("review_likes")
      .select("review_id");

    const counts = new Map<string, number>();
    (likeCounts || []).forEach((l) => {
      counts.set(l.review_id, (counts.get(l.review_id) || 0) + 1);
    });

    const topReviewIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((e) => e[0]);

    if (topReviewIds.length > 0) {
      const { data: popRevs } = await supabase
        .from("reviews")
        .select("*, places!inner(name, image)")
        .in("id", topReviewIds)
        .not("review_text", "is", null)
        .neq("review_text", "")
        .neq("user_id", user.id);

      const userIds = [...new Set((popRevs || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      const enriched = (popRevs || []).map((r: any) => {
        const prof = profileMap.get(r.user_id);
        return {
          ...r,
          profile_username: prof?.username,
          profile_picture: prof?.profile_picture,
          place_name: r.places?.name,
          place_image: r.places?.image,
        };
      });
      // Sort by like count
      enriched.sort((a: any, b: any) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
      setPopularReviews(enriched);
    } else {
      // Fallback: most recent written reviews (exclude own)
      const { data: recentRevs } = await supabase
        .from("reviews")
        .select("*, places!inner(name, image)")
        .not("review_text", "is", null)
        .neq("review_text", "")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const userIds = [...new Set((recentRevs || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setPopularReviews(
        (recentRevs || []).map((r: any) => {
          const prof = profileMap.get(r.user_id);
          return {
            ...r,
            profile_username: prof?.username,
            profile_picture: prof?.profile_picture,
            place_name: r.places?.name,
            place_image: r.places?.image,
          };
        })
      );
    }

    setReviewsLoading(false);
  };

  // ── LISTS ──
  const fetchListsSections = async () => {
    setListsLoading(true);
    if (!user) { setListsLoading(false); return; }

    const { data: following } = await supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", user.id);
    const followingIds = (following || []).map((f) => f.following_id);

    // Recent lists from friends (exclude own)
    if (followingIds.length > 0) {
      const { data: fLists } = await supabase
        .from("lists")
        .select("*")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(5);

      const userIds = [...new Set((fLists || []).map((l) => l.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      // Get item counts
      const enriched = await Promise.all(
        (fLists || []).map(async (l) => {
          const { count } = await supabase
            .from("list_items")
            .select("*", { count: "exact", head: true })
            .eq("list_id", l.id);
          const prof = profileMap.get(l.user_id);
          return { ...l, item_count: count || 0, username: prof?.username, profile_picture: prof?.profile_picture };
        })
      );
      setFriendLists(enriched);
    } else {
      setFriendLists([]);
    }

    // Most liked lists
    const { data: likeCounts } = await supabase
      .from("list_likes")
      .select("list_id");

    const counts = new Map<string, number>();
    (likeCounts || []).forEach((l) => {
      counts.set(l.list_id, (counts.get(l.list_id) || 0) + 1);
    });

    const topListIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((e) => e[0]);

    let popularData: any[] = [];
    if (topListIds.length > 0) {
      const { data } = await supabase
        .from("lists")
        .select("*")
        .in("id", topListIds);
      popularData = data || [];
    }

    if (popularData.length === 0) {
      const { data } = await supabase
        .from("lists")
        .select("*")
        .neq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      popularData = data || [];
    }
    // Filter out own lists
    popularData = popularData.filter((l) => l.user_id !== user.id);

    const userIds = [...new Set(popularData.map((l) => l.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, profile_picture")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    const enrichedPopular = await Promise.all(
      popularData.map(async (l) => {
        const { count } = await supabase
          .from("list_items")
          .select("*", { count: "exact", head: true })
          .eq("list_id", l.id);
        const prof = profileMap.get(l.user_id);
        const likeCount = counts.get(l.id) || 0;
        return { ...l, item_count: count || 0, like_count: likeCount, username: prof?.username, profile_picture: prof?.profile_picture };
      })
    );
    enrichedPopular.sort((a, b) => b.like_count - a.like_count);
    setPopularLists(enrichedPopular);

    setListsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        {/* Tabs */}
        <div className="flex items-center gap-6 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative pb-2"
            >
              <span
                className={`text-lg font-semibold transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="explore-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* ── PLACES TAB ── */}
        {activeTab === "Places" && (
          <>
            {placesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.key}>
                    <button
                      onClick={() => navigate(`/explore/list?${section.linkParams}`)}
                      className="flex items-center gap-1 mb-3"
                    >
                      <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                      <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                    {section.places.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    ) : (
                    <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
                        {section.places.map((place) => (
                          <button
                            key={place.id}
                            onClick={() => navigate(`/place/${place.id}`)}
                            className="flex-shrink-0 w-[130px]"
                          >
                            <div className="aspect-[3/4] w-full">
                              <DestinationPoster
                                placeId={place.id}
                                name={place.name}
                                country={place.country}
                                type={place.type as "city" | "country"}
                                image={place.image}
                                autoGenerate
                                className="w-full h-full"
                              />
                            </div>
                            {friendComments.has(place.id) && (() => {
                              const comment = friendComments.get(place.id)!;
                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/review/${comment.review_id}`); }}
                                  className="flex items-start gap-1.5 mt-1.5 px-0.5 w-full text-left"
                                >
                                  <img
                                    src={comment.profile_picture || `https://ui-avatars.com/api/?name=U&background=3B82F6&color=fff&size=20`}
                                    className="w-4 h-4 rounded-full shrink-0 mt-0.5"
                                    alt=""
                                  />
                                  <span className="text-[10px] text-muted-foreground line-clamp-2">{comment.text}</span>
                                </button>
                              );
                            })()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── REVIEWS TAB ── */}
        {activeTab === "Reviews" && (
          <>
            {reviewsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {friendReviews.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-3">Recent from friends</h2>
                    <div className="space-y-3">
                      {friendReviews.map((r) => (
                        <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                          <ReviewCard review={r} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-3">Most liked reviews</h2>
                  {popularReviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No reviews yet</p>
                  ) : (
                    <div className="space-y-3">
                      {popularReviews.map((r) => (
                        <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                          <ReviewCard review={r} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── LISTS TAB ── */}
        {activeTab === "Lists" && (
          <>
            {listsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {friendLists.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-3">Recent from friends</h2>
                    <div className="space-y-3">
                      {friendLists.map((l) => (
                        <ListCard key={l.id} list={l} />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-3">Most liked lists</h2>
                  {popularLists.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No lists yet</p>
                  ) : (
                    <div className="space-y-3">
                      {popularLists.map((l) => (
                        <ListCard key={l.id} list={l} showLikes />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── List Card for Explore ──
function ListCard({ list, showLikes = false }: { list: any; showLikes?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(list.like_count || 0);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from("list_likes")
        .select("id")
        .eq("list_id", list.id)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setLiked(!!data));
    }

    if (!list.like_count && list.like_count !== 0) {
      supabase
        .from("list_likes")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id)
        .then(({ count }) => setLikeCount(count || 0));
    }
  }, [list.id]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || toggling) return;
    setToggling(true);
    if (liked) {
      await supabase.from("list_likes").delete().eq("list_id", list.id).eq("user_id", user.id);
      setLiked(false);
      setLikeCount((c: number) => Math.max(0, c - 1));
    } else {
      await supabase.from("list_likes").insert({ list_id: list.id, user_id: user.id });
      setLiked(true);
      setLikeCount((c: number) => c + 1);
    }
    setToggling(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border border-border"
    >
      <div className="flex items-center justify-between">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => navigate(`/list/${list.id}`)}
        >
          <div className="flex items-center gap-2 mb-1">
            {list.profile_picture && (
              <img src={list.profile_picture} alt="" className="w-6 h-6 rounded-full object-cover" />
            )}
            <span className="text-xs text-muted-foreground">{list.username || "User"}</span>
          </div>
          <p className="text-sm font-bold text-foreground">{list.name}</p>
          <p className="text-xs text-muted-foreground">
            {list.item_count} destination{list.item_count !== 1 ? "s" : ""}
          </p>
          <ListPreviewPosters listId={list.id} maxItems={4} />
        </div>
        <button
          onClick={toggleLike}
          className="flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              liked ? "text-red-500 fill-red-500" : "text-muted-foreground"
            }`}
          />
          {likeCount > 0 && (
            <span className="text-xs text-muted-foreground">{likeCount}</span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
