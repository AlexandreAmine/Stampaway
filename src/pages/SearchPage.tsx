import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { PullToRefresh } from "@/components/PullToRefresh";
import { hapticSelection, hapticLight } from "@/lib/haptics";
import { profileLinkProps } from "@/lib/profileHeaderQuery";
import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { matchesPlaceName, normalizeSearchText } from "@/lib/placeSearch";
import { getCachedPlaceName } from "@/lib/placeNames";
import { prefetchPlacePrimary } from "@/lib/placePrimaryQuery";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePerfReady } from "@/lib/perfMarks";
import { useProgressiveCount } from "@/hooks/useProgressiveCount";
import { continentLabel } from "@/lib/continentLabels";
import { subCategoryLabel } from "@/lib/subCategories";
import type { Language, TranslationKey } from "@/i18n/translations";
import { DestinationPoster } from "@/components/DestinationPoster";
import { RecentSearches, type RecentPlace } from "@/components/RecentSearches";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { fetchAllTimeVisitorCountMap, fetchAverageRatingMap, fetchAllPlaces, fetchCategoryAverageMap, peekAllPlaces, peekAllTimeVisitorCountMap, clearRankingsCache } from "@/lib/placeRankings";
import { ListPreviewPosters } from "@/components/ListPreviewPosters";
import { fetchSearchLists } from "@/lib/searchLists";
import { followOrRequest, type FollowResult } from "@/lib/followActions";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategorySortDropdown, type SubRatingCategory } from "@/components/CategorySortDropdown";
import {
  EUROPE_COUNTRIES, ASIA_COUNTRIES, NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES, AFRICA_COUNTRIES, OCEANIA_COUNTRIES,
} from "@/lib/continents";

const filterTabs = ["Countries", "Cities", "Lists", "Users"] as const;
type FilterTab = (typeof filterTabs)[number];

type DestSort = "most-popular" | "avg-highest" | "category-avg";

const CONTINENT_ORDER = ["Europe", "Asia", "North America", "South America", "Africa", "Oceania", "Other"];
function getContinent(country: string): string {
  if (EUROPE_COUNTRIES.includes(country)) return "Europe";
  if (ASIA_COUNTRIES.includes(country)) return "Asia";
  if (NORTH_AMERICA_COUNTRIES.includes(country)) return "North America";
  if (SOUTH_AMERICA_COUNTRIES.includes(country)) return "South America";
  if (AFRICA_COUNTRIES.includes(country)) return "Africa";
  if (OCEANIA_COUNTRIES.includes(country)) return "Oceania";
  return "Other";
}

/** Destinations of one type matching the query, most visited first. */
function buildDestinationResults(
  allPlaces: any[],
  countMap: Map<string, number>,
  placeType: "country" | "city",
  q: string,
  language: Language,
): any[] {
  let filtered = allPlaces.filter((p: any) => p.type === placeType);
  if (q) {
    // Matches the English DB name OR the localized name for the active
    // language (e.g. FR "espag" finds "Spain" via "Espagne"),
    // accent-insensitive both ways.
    const normalizedQuery = normalizeSearchText(q);
    filtered = filtered.filter((p: any) => matchesPlaceName(p, normalizedQuery, language));
  }

  const withCounts = filtered.map((p: any) => ({ ...p, review_count: countMap.get(p.id) || 0 }));
  withCounts.sort((a: any, b: any) => {
    const diff = b.review_count - a.review_count;
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  return withCounts;
}

/**
 * Lists and Users results already seen this session, keyed by query, so
 * coming back to those filters shows them at once instead of a spinner.
 * Every visit still refetches and replaces them, as before. Reset when the
 * signed-in user changes (list visibility depends on who is looking).
 */
const sessionResults = {
  userId: null as string | null,
  lists: new Map<string, any[]>(),
  users: new Map<string, any[]>(),
  // Who the viewer follows ("following") or has asked to follow ("requested").
  relations: null as Map<string, FollowResult> | null,
};
function sessionResultsFor(userId: string | null) {
  if (sessionResults.userId !== userId) {
    sessionResults.userId = userId;
    sessionResults.lists.clear();
    sessionResults.users.clear();
    sessionResults.relations = null;
  }
  return sessionResults;
}

const SEARCH_FILTER_KEY = "stampaway_search_filter";

const placeTypeForTab = (tab: FilterTab) => (tab === "Countries" ? "country" : tab === "Cities" ? "city" : null);

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t, tn, language } = useLanguage();
  const filterTabLabels: Record<FilterTab, string> = {
    Countries: t("search.countries"),
    Cities: t("search.cities"),
    Lists: t("search.lists"),
    Users: t("search.users"),
  };
  // A ?tab= link wins; otherwise come back to the filter last used this
  // session (it used to reset to Countries after opening a result and going
  // back).
  const initialTab = (() => {
    const isTab = (v: string | null): v is FilterTab => (filterTabs as readonly string[]).includes(v || "");
    const fromUrl = searchParams.get("tab");
    if (isTab(fromUrl)) return fromUrl;
    try {
      const remembered = sessionStorage.getItem(SEARCH_FILTER_KEY);
      if (isTab(remembered)) return remembered;
    } catch {
      // Storage unavailable: fall back to the default filter.
    }
    return "Countries";
  })();
  const [activeFilter, setActiveFilter] = useState<FilterTab>(initialTab);
  const [query, setQuery] = useState("");
  // Read during the first render (not in an effect) so the grid below
  // doesn't jump down a frame later when the recents appear.
  const [recentSearches] = useState<RecentPlace[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      return Array.isArray(saved) ? saved.slice(0, 8) : [];
    } catch {
      // Corrupt or blocked storage just means no recents to show.
      return [];
    }
  });
  // Built from the cached catalog while building the FIRST render, so Search
  // shows its grid immediately instead of a skeleton on every visit; the
  // mount search below refreshes it silently.
  const [places, setPlaces] = useState<any[]>(() => {
    const placeType = placeTypeForTab(initialTab);
    const allPlaces = placeType ? peekAllPlaces() : null;
    const countMap = placeType ? peekAllTimeVisitorCountMap() : null;
    return placeType && allPlaces && countMap
      ? buildDestinationResults(allPlaces, countMap, placeType, "", language)
      : [];
  });
  const [lists, setLists] = useState<any[]>(() => sessionResultsFor(user?.id ?? null).lists.get("") ?? []);
  const [users, setUsers] = useState<any[]>(() => sessionResultsFor(user?.id ?? null).users.get("") ?? []);
  // The mount search starts right away; when the first filter has nothing to
  // show yet, start in the loading state so it shows the spinner rather than
  // flashing "no results" for a frame.
  const [loading, setLoading] = useState(() =>
    placeTypeForTab(initialTab) ? places.length === 0 : (initialTab === "Lists" ? lists : users).length === 0
  );
  const [relations, setRelationsState] = useState<Map<string, FollowResult>>(
    () => sessionResultsFor(user?.id ?? null).relations ?? new Map()
  );
  const setRelations = (update: (prev: Map<string, FollowResult>) => Map<string, FollowResult>) => {
    setRelationsState((prev) => {
      const next = update(prev);
      sessionResultsFor(user?.id ?? null).relations = next;
      return next;
    });
  };
  const setRelation = (userId: string, relation: FollowResult | null) =>
    setRelations((prev) => {
      const next = new Map(prev);
      if (relation) next.set(userId, relation);
      else next.delete(userId);
      return next;
    });
  // Follow taps still being saved, so a double tap can't send two.
  const followingInFlight = useRef(new Set<string>());
  const [destSort, setDestSort] = useState<DestSort>("most-popular");
  const [selectedCategory, setSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [grouped, setGrouped] = useState(false);
  const [visibleCount, setVisibleCount] = useState(250);
  const onPlacesFilter = !!placeTypeForTab(activeFilter);
  usePerfReady("search:skeleton", onPlacesFilter && loading && places.length === 0);
  usePerfReady("search", onPlacesFilter && !loading && places.length > 0, `${places.length} places`);
  usePerfReady("search:lists", activeFilter === "Lists" && lists.length > 0, `${lists.length} lists${loading ? " (refreshing)" : ""}`);
  const searchStateRef = useRef<{ initialized: boolean; query: string; activeFilter: FilterTab }>({
    initialized: false,
    query: "",
    activeFilter: initialTab,
  });
  const searchRequestIdRef = useRef(0);
  const visiblePlaceSearchContextRef = useRef<string | null>(
    places.length > 0 ? `${initialTab}\u0000` : null
  );
  const sortMetricRequestIdRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("followers").select("following_id").eq("follower_id", user.id),
      supabase.from("follow_requests").select("target_id").eq("requester_id", user.id),
    ]).then(([{ data: follows }, { data: requests }]) => {
      const next = new Map<string, FollowResult>();
      (requests || []).forEach((r) => next.set(r.target_id, "requested"));
      (follows || []).forEach((f) => next.set(f.following_id, "following"));
      setRelations(() => next);
    });
  }, [user]);

  useEffect(() => {
    const previous = searchStateRef.current;
    const filterChanged = previous.initialized && previous.activeFilter !== activeFilter;
    const queryChanged = previous.initialized && previous.query !== query;

    searchStateRef.current = { initialized: true, query, activeFilter };

    if (!previous.initialized || filterChanged) {
      search();
      return;
    }

    if (queryChanged) {
      const t = setTimeout(() => search(), 250);
      return () => clearTimeout(t);
    }
  }, [query, activeFilter]);

  useEffect(() => { setVisibleCount(250); }, [query, activeFilter, destSort, selectedCategory, grouped]);

  const search = async () => {
    const requestId = ++searchRequestIdRef.current;
    setLoading(true);
    const q = query.trim();
    const requestFilter = activeFilter;
    const placeType = placeTypeForTab(requestFilter);

    if (placeType) {
      const contextKey = `${requestFilter}\u0000${q}`;
      const sameContext = visiblePlaceSearchContextRef.current === contextKey;
      if (!sameContext) setPlaces([]);

      try {
        // Fetch ALL places and visitor counts using centralized helpers
        const [countMap, allPlaces] = await Promise.all([
          fetchAllTimeVisitorCountMap(),
          fetchAllPlaces(),
        ]);

        const withCounts = buildDestinationResults(allPlaces, countMap, placeType, q, language);

        if (searchRequestIdRef.current !== requestId) return;
        setPlaces(withCounts);
        visiblePlaceSearchContextRef.current = contextKey;
      } catch (error) {
        if (searchRequestIdRef.current === requestId) {
          console.error("Failed to load destination search rankings:", error);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
      return;
    }

    // Lists / Users: show this query's results from earlier in the session
    // right away (or clear, so the spinner shows), then refresh them.
    const viewerId = user?.id ?? null;
    const isLists = requestFilter === "Lists";
    const cache = isLists ? sessionResultsFor(viewerId).lists : sessionResultsFor(viewerId).users;
    const setResults = isLists ? setLists : setUsers;
    setResults(cache.get(q) ?? []);
    try {
      let results: any[];
      if (isLists) {
        results = await fetchSearchLists(q, viewerId);
      } else {
        let qb = supabase.from("profiles").select("id, user_id, username, profile_picture, is_private");
        if (q) qb = qb.ilike("username", `%${q}%`);
        qb = qb.order("username").limit(30);
        const { data } = await qb;
        results = data || [];
      }
      // A newer search (another keystroke or filter) has taken over.
      if (searchRequestIdRef.current !== requestId) return;
      cache.set(q, results);
      setResults(results);
    } catch (error) {
      console.error(`Failed to search ${requestFilter}:`, error);
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const getSortedPlaces = () => {
    if (destSort === "most-popular") {
      return [...places].sort((a, b) => {
        const diff = (b.review_count || 0) - (a.review_count || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    }
    if (destSort === "avg-highest") {
      return [...places].sort((a, b) => (b._avg ?? 0) - (a._avg ?? 0));
    }
    if (destSort === "category-avg") {
      return [...places].sort((a, b) => (b._catAvg ?? 0) - (a._catAvg ?? 0));
    }
    return places;
  };

  // Cache sort metric maps so switching tabs (Countries ↔ Cities) reuses them instantly
  const avgMapCacheRef = useRef<Map<string, number> | null>(null);
  const catMapCacheRef = useRef<Record<string, Map<string, number>>>({});
  // Bumped by pull to refresh so the sort metrics are fetched again too.
  const [metricsVersion, setMetricsVersion] = useState(0);

  const handleRefresh = async () => {
    clearRankingsCache();
    avgMapCacheRef.current = null;
    catMapCacheRef.current = {};
    await search();
    setMetricsVersion((v) => v + 1);
  };

  useEffect(() => {
    const requestId = ++sortMetricRequestIdRef.current;
    if ((activeFilter !== "Countries" && activeFilter !== "Cities") || places.length === 0) return;
    if (destSort === "most-popular") return;

    let cancelled = false;
    (async () => {
      try {
        if (destSort === "avg-highest") {
          let avgMap = avgMapCacheRef.current;
          if (!avgMap) {
            avgMap = await fetchAverageRatingMap();
            avgMapCacheRef.current = avgMap;
          }
          if (cancelled || sortMetricRequestIdRef.current !== requestId) return;
          setPlaces((prev) => prev.map((p) => ({ ...p, _avg: avgMap!.get(p.id) || 0 })));
        } else if (destSort === "category-avg") {
          let catMap = catMapCacheRef.current[selectedCategory];
          if (!catMap) {
            catMap = await fetchCategoryAverageMap(selectedCategory);
            catMapCacheRef.current[selectedCategory] = catMap;
          }
          if (cancelled || sortMetricRequestIdRef.current !== requestId) return;
          setPlaces((prev) => prev.map((p) => ({ ...p, _catAvg: catMap!.get(p.id) || 0 })));
        }
      } catch (error) {
        if (!cancelled && sortMetricRequestIdRef.current === requestId) {
          console.error("Failed to load destination sort rankings:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destSort, selectedCategory, places.length, activeFilter, metricsVersion]);

  const sortedPlaces = getSortedPlaces();
  // Up to 250 posters per page of results: the first eight rows render now,
  // the rest over the next few frames.
  const renderedPlaceCount = useProgressiveCount(Math.min(visibleCount, sortedPlaces.length), {
    initial: 24,
    step: 96,
    resetKey: `${activeFilter}\u0000${query}\u0000${grouped}`,
  });

  const renderDestinations = () => {
    // Keep showing the current results while they refresh (stale-while-
    // revalidate); the skeleton is only for when there is nothing to show.
    if (loading && places.length === 0) return <LoadingSpinner />;
    const isDestTab = activeFilter === "Countries" || activeFilter === "Cities";
    if (!isDestTab) return null;
    if (!sortedPlaces.length) return <EmptyState text={t("noResults")} />;

    const currentLabel = destSort === "category-avg"
      ? subCategoryLabel(selectedCategory, t)
      : destSort === "most-popular" ? t("search.mostPopular") : t("search.avgHighest");

    const groupLabel = activeFilter === "Countries" ? t("profile.byContinent") : t("profile.byCountry");

    // Grouping
    const groups: { label: string; items: any[] }[] = [];
    if (grouped) {
      const map = new Map<string, any[]>();
      sortedPlaces.forEach((p) => {
        const key = activeFilter === "Countries" ? getContinent(p.name) : p.country;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      });
      if (activeFilter === "Countries") {
        CONTINENT_ORDER.forEach((c) => { if (map.has(c)) groups.push({ label: continentLabel(c, t), items: map.get(c)! }); });
      } else {
        [...map.entries()]
          .map(([country, items]) => ({ label: getCachedPlaceName(country, language, true), items }))
          .sort((a, b) => a.label.localeCompare(b.label))
          .forEach((group) => groups.push(group));
      }
    }

    const renderPlaceGrid = (items: any[]) => (
      <div className="grid grid-cols-3 gap-3">
        {items.map((p: any, itemIndex: number) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            onTouchStart={() => prefetchPlacePrimary(queryClient, p.id, user?.id ?? null)}
            onClick={() => {
              try {
                const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]");
                const filtered = saved.filter((s: any) => s.id !== p.id);
                const updated = [{ id: p.id, name: p.name, country: p.country, type: p.type, image: p.image }, ...filtered].slice(0, 15);
                localStorage.setItem("recentSearches", JSON.stringify(updated));
              } catch { /* ignore */ }
              navigate(`/place/${p.id}`);
            }}
            className="aspect-[3/4] w-full relative"
          >
            <PosterWishlistButton placeId={p.id} placeName={p.name} />
            <DestinationPoster placeId={p.id} name={p.name} country={p.country} type={p.type as "city" | "country"} image={p.image} priority={itemIndex < 6} className="w-full h-full" />
          </motion.button>
        ))}
      </div>
    );

    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setGrouped((g) => !g)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              grouped ? "bg-primary text-primary-foreground" : "text-muted-foreground border border-border hover:text-foreground"
            }`}
          >
            {groupLabel}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground transition-colors">
              {currentLabel}
              <ChevronDown className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuItem onClick={() => { hapticSelection(); setDestSort("most-popular"); }} className={destSort === "most-popular" ? "text-primary font-semibold" : ""}>
                {t("search.mostPopular")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { hapticSelection(); setDestSort("avg-highest"); }} className={destSort === "avg-highest" ? "text-primary font-semibold" : ""}>
                {t("search.avgHighest")}
              </DropdownMenuItem>
              <CategorySortDropdown
                label={t("search.catAvgHighest")}
                onSelect={(cat) => { setSelectedCategory(cat); setDestSort("category-avg"); }}
                selectedCategory={selectedCategory}
                isActive={destSort === "category-avg"}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {grouped ? (
          <div className="space-y-5">
            {(() => {
              let remaining = renderedPlaceCount;
              const visibleGroups: { label: string; items: any[] }[] = [];
              for (const g of groups) {
                if (remaining <= 0) break;
                visibleGroups.push({ label: g.label, items: g.items.slice(0, remaining) });
                remaining -= g.items.length;
              }
              return visibleGroups.map((group) => (
                <div key={group.label}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h3>
                  {renderPlaceGrid(group.items)}
                </div>
              ));
            })()}
          </div>
        ) : (
          renderPlaceGrid(sortedPlaces.slice(0, renderedPlaceCount))
        )}
        {sortedPlaces.length > visibleCount && (
          <div className="flex justify-center mt-5">
            <button
              onClick={() => setVisibleCount((c) => c + 250)}
              className="text-xs font-medium px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:bg-accent transition-colors"
            >
              {t("common.viewMore")}
            </button>
          </div>
        )}
      </>
    );
  };

  const renderResults = () => {
    if (activeFilter === "Countries" || activeFilter === "Cities") return renderDestinations();

    // Results from earlier this session stay visible while they refresh.
    const shown = activeFilter === "Lists" ? lists : users;
    if (loading && shown.length === 0) return <LoadingSpinner />;

    if (activeFilter === "Lists") {
      if (!lists.length) return <EmptyState text={t("search.noLists")} />;
      return (
        <div className="space-y-3">
          {lists.map((l: any) => (
            <motion.button key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate(`/list/${l.id}`)} className="w-full text-left bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                {l.profiles && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={l.profiles.profile_picture || fallbackAvatarUrl(l.profiles.username || "?")} />
                    <AvatarFallback>{l.profiles.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground" data-no-translate>{l.name}</p>
                  {l.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{l.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {l.profiles && <p className="text-xs text-muted-foreground">{t("lists.by")} <span data-no-translate>{l.profiles.username}</span></p>}
                    <span className="text-xs text-muted-foreground">• {l.item_count == null ? "?" : tn("count.destination", l.item_count)}</span>
                  </div>
                </div>
              </div>
              <ListPreviewPosters listId={l.id} />
            </motion.button>
          ))}
        </div>
      );
    }

    if (activeFilter === "Users") {
      if (!users.length) return <EmptyState text={t("search.noUsers")} />;
      return (
        <div className="space-y-3">
          {users.map((u: any) => {
            const isMe = u.user_id === user?.id;
            const relation = relations.get(u.user_id);
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between py-3">
                <button onClick={() => navigate(isMe ? "/profile" : `/profile/${u.user_id}`)} {...profileLinkProps(u.user_id, u.username, u.profile_picture)} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.profile_picture || fallbackAvatarUrl(u.username)} />
                    <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground" data-no-translate>{u.username}</p>
                  </div>
                </button>
                {!isMe && !relation && (
                  <button
                    onClick={async () => {
                      if (!user || followingInFlight.current.has(u.user_id)) return;
                      followingInFlight.current.add(u.user_id);
                      // Instant: show the expected result now (a request for a
                      // private account), correct it from the server's answer.
                      hapticLight();
                      setRelation(u.user_id, u.is_private ? "requested" : "following");
                      try {
                        const result = await followOrRequest(user.id, u.user_id);
                        setRelation(u.user_id, result);
                        if (result === "following") {
                          invalidateOwnProfileContentCache(user.id);
                          toast.success(t("search.followingUser", { username: u.username }));
                        }
                      } catch {
                        setRelation(u.user_id, null);
                        toastError(t("following.followFailed"));
                      } finally {
                        followingInFlight.current.delete(u.user_id);
                      }
                    }}
                    className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium"
                  >
                    {t("profile.follow")}
                  </button>
                )}
                {!isMe && relation && (
                  <span className="text-xs text-muted-foreground px-3 py-1.5">
                    {t(relation === "requested" ? "profile.requested" : "profile.following")}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PullToRefresh onRefresh={handleRefresh} />
      <div className="pt-14 px-5">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="page-title">{t("nav.search")}</h1>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            enterKeyHint="search"
            autoCorrect="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (activeFilter !== tab) hapticSelection();
                setActiveFilter(tab);
                try {
                  sessionStorage.setItem(SEARCH_FILTER_KEY, tab);
                } catch {
                  // Not remembering the filter is harmless.
                }
                setGrouped(false);
                // Reset sort to "Most popular" when switching between Countries <-> Cities
                if ((tab === "Countries" || tab === "Cities") && destSort !== "most-popular") {
                  setDestSort("most-popular");
                }
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {filterTabLabels[tab]}
            </button>
          ))}
        </div>

        {!query &&
          recentSearches.length > 0 &&
          (activeFilter === "Countries" || activeFilter === "Cities") && (
            <RecentSearches
              places={recentSearches}
              onPressStart={(p) => prefetchPlacePrimary(queryClient, p.id, user?.id ?? null)}
              onSelect={(p) => navigate(`/place/${p.id}`)}
            />
          )}

        {renderResults()}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="space-y-3 pt-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-lg bg-muted/40 skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-muted/40 rounded skeleton-shimmer" />
            <div className="h-2 w-20 bg-muted/40 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
