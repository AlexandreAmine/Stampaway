import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, UserPlus, Bell } from "lucide-react";
import { getFlagEmoji } from "@/lib/countryFlags";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPlaceCoordinates } from "@/lib/cityCoordinates";
import { GlobeActivityPopup } from "@/components/GlobeActivityPopup";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { MapboxFriendsMap, type MapPin } from "@/components/MapboxFriendsMap";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useAfterFirstPaint } from "@/hooks/useAfterFirstPaint";
import { warmTrendingPosters } from "@/lib/posterWarmup";
import { prefetchPlacePrimary } from "@/lib/placePrimaryQuery";

interface FriendActivity {
  id: string;
  user_id: string;
  username: string;
  profile_picture: string | null;
  place_id: string;
  place_name: string;
  place_country: string;
  place_type: string;
  rating: number | null;
  created_at: string;
  lat: number;
  lng: number;
  visit_month: number | null;
  visit_year: number | null;
  duration_days: number | null;
  review_text: string | null;
}



export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const globeReady = useAfterFirstPaint();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["home-feed"] }),
      queryClient.invalidateQueries({ queryKey: ["home-stats"] }),
    ]);
  }, [queryClient]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(380);
  const [selectedActivity, setSelectedActivity] = useState<FriendActivity | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadState, setUnreadState] = useState<{
    userId: string | null;
    count: number;
  }>({ userId: null, count: 0 });
  const unreadRequestSequenceRef = useRef(0);
  const unreadPendingRequestRef = useRef<number | null>(null);
  const unreadCount =
    unreadState.userId === (user?.id ?? null) ? unreadState.count : 0;
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Stats: unique countries & cities reviewed (matches Profile page logic).
  // Cached by React Query: renders instantly on revisit, refreshes silently.
  const statsQuery = useQuery({
    queryKey: ["home-stats", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("place_id, places!inner(type)")
        .eq("user_id", user!.id);
      const countries = new Set<string>();
      const cities = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.places?.type === "city") cities.add(r.place_id);
        else if (r.places?.type === "country") countries.add(r.place_id);
      });
      return { countriesCount: countries.size, citiesCount: cities.size };
    },
  });
  const countriesCount = statsQuery.data?.countriesCount ?? 0;
  const citiesCount = statsQuery.data?.citiesCount ?? 0;

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setMapWidth(containerRef.current.offsetWidth);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Pre-warm Explore/Search hero posters into the HTTP cache during idle
  // (first-launch smoothness; no-op after the first run this session)
  useEffect(() => {
    if (user) warmTrendingPosters();
  }, [user]);


  // Fetch unread notification count
  useEffect(() => {
    const userId = user?.id ?? null;
    const requestId = ++unreadRequestSequenceRef.current;
    let cancelled = false;

    setUnreadState((current) =>
      current.userId === userId ? current : { userId, count: 0 }
    );

    if (!userId) {
      unreadPendingRequestRef.current = null;
      return;
    }

    unreadPendingRequestRef.current = requestId;
    const isCurrentRequest = () =>
      !cancelled && unreadPendingRequestRef.current === requestId;

    const lastRead = localStorage.getItem(`notif_last_read_${userId}`);
    const lastReadDate = lastRead || "1970-01-01T00:00:00Z";

    const fetchUnreadCount = async () => {
      try {
        // One server-side RPC; previously this downloaded all of the user's
        // review ids and list ids to count likes with .in() filters.
        const { data, error } = await supabase.rpc("get_unread_notification_counts", {
          _since: lastReadDate,
        });
        if (error) throw error;

        const row = data?.[0];
        const count = row
          ? Number(row.followers_count) +
            Number(row.requests_count) +
            Number(row.review_likes_count) +
            Number(row.list_likes_count)
          : 0;

        if (!isCurrentRequest()) return;
        setUnreadState({ userId, count });
      } catch {
        if (isCurrentRequest()) {
          console.error("Failed to refresh unread notification count");
        }
      } finally {
        if (isCurrentRequest()) {
          unreadPendingRequestRef.current = null;
        }
      }
    };

    void fetchUnreadCount();

    return () => {
      cancelled = true;
      if (unreadPendingRequestRef.current === requestId) {
        unreadPendingRequestRef.current = null;
      }
    };
    // Note: intentionally not keyed on notifOpen — opening the sheet zeroes
    // the badge optimistically and stores the read timestamp, so refetching
    // on open/close was redundant network traffic.
  }, [user]);

  // Friend activity feed. Cached by React Query so switching back to Home
  // renders the map pins and list instantly while refreshing in background.
  const feedQuery = useQuery({
    queryKey: ["home-feed", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<{ hasFollowing: boolean; activities: FriendActivity[] }> => {
      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user!.id);

      const followingIds = following?.map((f) => f.following_id) || [];
      if (followingIds.length === 0) {
        return { hasFollowing: false, activities: [] };
      }

      const now = new Date();
      // Allow current month + previous month based on the *visit* date.
      // Compute the (year, month) pair for both months.
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = prev.getFullYear();
      const prevMonth = prev.getMonth() + 1;

      // The profiles we may need are exactly the followed users, so both
      // queries can run in parallel instead of profiles waiting on reviews.
      const [{ data: reviews }, { data: profiles }] = await Promise.all([
        supabase
          .from("reviews")
          .select("id, user_id, place_id, rating, created_at, visit_year, visit_month, duration_days, review_text, places!inner(name, country, type)")
          .in("user_id", followingIds)
          .not("visit_year", "is", null)
          .not("visit_month", "is", null)
          .or(`and(visit_year.eq.${currentYear},visit_month.eq.${currentMonth}),and(visit_year.eq.${prevYear},visit_month.eq.${prevMonth})`)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", followingIds),
      ]);

      const filtered = reviews || [];
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const mapped: FriendActivity[] = [];
      filtered.forEach((r: any) => {
        const coords = getPlaceCoordinates(r.places.name, r.places.country);
        if (!coords) return;
        const prof = profileMap.get(r.user_id);
        mapped.push({
          id: r.id,
          user_id: r.user_id,
          username: prof?.username || "User",
          profile_picture: prof?.profile_picture || null,
          place_id: r.place_id,
          place_name: r.places.name,
          place_country: r.places.country,
          place_type: r.places.type,
          rating: r.rating != null ? Number(r.rating) : null,
          created_at: r.created_at,
          lat: coords[0],
          lng: coords[1],
          visit_month: r.visit_month,
          visit_year: r.visit_year,
          duration_days: r.duration_days,
          review_text: r.review_text,
        });
      });

      return { hasFollowing: true, activities: mapped };
    },
  });
  const activities = feedQuery.data?.activities ?? [];
  const hasFollowing = feedQuery.data?.hasFollowing ?? true;
  const loading = feedQuery.isPending;

  const getAvatarUrl = (a: FriendActivity) =>
    a.profile_picture || fallbackAvatarUrl(a.username);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const handlePinClick = useCallback((a: FriendActivity) => {
    if (selectedActivity?.id === a.id) {
      navigate(`/place/${a.place_id}`);
      return;
    }
    setSelectedActivity(a);
  }, [selectedActivity, navigate]);

  // Mapbox label click: city/country names rendered by the basemap.
  // Look up matching place in our DB and navigate to it.
  const handleLabelClick = useCallback((text: string, type: "city" | "country") => {
    (async () => {
      const { data } = await supabase
        .from("places")
        .select("id")
        .ilike("name", text)
        .eq("type", type)
        .limit(1)
        .maybeSingle();
      if (data) navigate(`/place/${data.id}`);
    })();
  }, [navigate]);

  const mapHeight = Math.round(mapWidth * 1.1);

  return (
    <div className="min-h-screen pb-24 relative bg-background">
      <PullToRefresh onRefresh={handleRefresh} />
      {/* Fixed map background — stays visible while the activity list scrolls over it */}
      <div className="fixed top-0 left-0 right-0 z-0 pointer-events-none">
        <div className="mx-auto max-w-lg pointer-events-auto">
          {/* Header */}
          <div className="pt-14 pb-2 px-5 flex items-end justify-between relative z-10">
            <h1 className="font-brand text-3xl font-normal text-foreground tracking-tight leading-none">{t("home.title")}</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-background/60 backdrop-blur-sm rounded-full px-3 h-8">
                <span className="text-xs font-semibold text-foreground tabular-nums">{countriesCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("profile.countries")}</span>
                <span className="text-muted-foreground/40 mx-0.5">·</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{citiesCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("profile.cities")}</span>
              </div>
              <button onClick={() => {
                setNotifOpen(true);
                if (user) localStorage.setItem(`notif_last_read_${user.id}`, new Date().toISOString());
                setUnreadState({ userId: user?.id ?? null, count: 0 });
              }} className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center relative">
                <Bell className="w-5 h-5 text-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: mapHeight }}>
            {/* Map mounts one frame after the page shell paints so the header,
                stats and activity list appear instantly (container height is
                fixed, so nothing shifts) */}
            {globeReady && (
              <MapboxFriendsMap
                pins={activities as MapPin[]}
                loading={loading}
                width={mapWidth}
                height={mapHeight}
                onPinClick={(p) => handlePinClick(p as FriendActivity)}
                onLabelClick={handleLabelClick}
                selectedPinId={selectedActivity?.id ?? null}
              />
            )}

            {/* Activity popup overlay */}
            <GlobeActivityPopup
              activity={selectedActivity}
              onClose={() => setSelectedActivity(null)}
              onNavigate={() => {
                if (selectedActivity) navigate(`/place/${selectedActivity.place_id}`);
              }}
              onProfileNavigate={(userId) => navigate(userId === user?.id ? "/profile" : `/profile/${userId}`)}
            />
          </div>
        </div>
      </div>

      {/* Spacer that reserves room for the fixed map above */}
      <div style={{ height: mapHeight + 56 }} className="pointer-events-none" />

      {/* Activity list — scrolls over the fixed globe with a smooth fade into background */}
      <div className="relative z-10">
        {/* Soft fade from transparent to navy so the globe blends into the list */}
        <div className="h-16 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <div className="px-5 min-h-[60vh] bg-background">
          <h2 className="text-xl font-bold text-foreground mb-4">{t("home.recentActivity")}</h2>

          {!hasFollowing && !loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <p className="text-sm text-muted-foreground text-center">{t("home.followFriends")}</p>
              <button
                onClick={() => navigate("/search?tab=Users")}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                {t("home.findFriends")}
              </button>
            </div>
          ) : activities.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{t("home.noActivity")}</p>
          ) : null}

          <div className="space-y-1 pb-36">
            {(showAllActivities ? activities : activities.slice(0, 10)).map((a, i) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                transition={{ delay: Math.min(i, 12) * 0.04 }}
                onTouchStart={() => prefetchPlacePrimary(queryClient, a.place_id, user?.id ?? null)}
                onClick={() => handlePinClick(a)}
                className="flex items-center gap-3 py-2.5 w-full text-left"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(a.user_id === user?.id ? "/profile" : `/profile/${a.user_id}`); }}
                  className="shrink-0"
                >
                  <img
                    src={getAvatarUrl(a)}
                    alt={a.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-foreground" data-no-translate>{a.username}</span>
                    <span className="text-xs text-muted-foreground">• {formatDate(a.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getFlagEmoji(a.place_country) && (
                      <span className="text-sm shrink-0">{getFlagEmoji(a.place_country)}</span>
                    )}
                    <span className="text-sm font-bold text-foreground truncate">{a.place_name}</span>
                    {a.rating != null && (
                      <>
                        <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">{a.rating}</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
            {!showAllActivities && activities.length > 10 && (
              <button
                onClick={() => setShowAllActivities(true)}
                className="w-full mt-3 py-2.5 text-sm font-medium text-primary hover:bg-muted/40 rounded-lg transition-colors"
              >
                View more ({activities.length - 10})
              </button>
            )}
            {showAllActivities && activities.length > 10 && (
              <button
                onClick={() => setShowAllActivities(false)}
                className="w-full mt-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 rounded-lg transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        </div>
      </div>

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
