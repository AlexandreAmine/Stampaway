import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Search, ChevronDown } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { DestinationPoster } from "@/components/DestinationPoster";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { fetchAllTimeVisitorCountMap, fetchAverageRatingMap, fetchAllPlaces, fetchCategoryAverageMap } from "@/lib/placeRankings";
import { ListPreviewPosters } from "@/components/ListPreviewPosters";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
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

const DEST_SORT_LABELS: Record<string, string> = {
  "most-popular": "Most popular",
  "avg-highest": "Average highest first",
  "category-avg": "Categories average highest first",
};

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

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const filterTabLabels: Record<FilterTab, string> = {
    Countries: t("search.countries"),
    Cities: t("search.cities"),
    Lists: t("search.lists"),
    Users: t("search.users"),
  };
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return (filterTabs as readonly string[]).includes(t || "") ? (t as FilterTab) : "Countries";
  })();
  const [activeFilter, setActiveFilter] = useState<FilterTab>(initialTab);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [destSort, setDestSort] = useState<DestSort>("most-popular");
  const [selectedCategory, setSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [grouped, setGrouped] = useState(false);
  const [visibleCount, setVisibleCount] = useState(250);

  useEffect(() => {
    if (!user) return;
    supabase.from("followers").select("following_id").eq("follower_id", user.id).then(({ data }) => {
      setFollowingIds(new Set((data || []).map((f) => f.following_id)));
    });
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => search(), 250);
    return () => clearTimeout(t);
  }, [query, activeFilter]);

  useEffect(() => { search(); }, [activeFilter]);

  useEffect(() => { setVisibleCount(250); }, [query, activeFilter, destSort, selectedCategory, grouped]);

  const search = async () => {
    setLoading(true);
    const q = query.trim();
    const placeType = activeFilter === "Countries" ? "country" : activeFilter === "Cities" ? "city" : null;

    if (placeType) {
      // Fetch ALL places and visitor counts using centralized helpers
      const [countMap, allPlaces] = await Promise.all([
        fetchAllTimeVisitorCountMap(),
        fetchAllPlaces(),
      ]);

      let filtered = allPlaces.filter((p: any) => p.type === placeType);
      if (q) filtered = filtered.filter((p: any) => p.name.toLowerCase().includes(q.toLowerCase()));

      const withCounts = filtered.map((p: any) => ({ ...p, review_count: countMap.get(p.id) || 0 }));
      withCounts.sort((a: any, b: any) => {
        const diff = b.review_count - a.review_count;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
      setPlaces(withCounts);
    } else if (activeFilter === "Lists") {
      let qb = supabase.from("lists").select("id, name, description, user_id");
      if (q) qb = qb.ilike("name", `%${q}%`);
      qb = qb.limit(100);
      const { data } = await qb;
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((l: any) => l.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture, is_private").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        // Privacy filter: hide lists from private users unless current user follows them or is the owner
        const privateOwnerIds = (profiles || []).filter((p: any) => p.is_private && p.user_id !== user?.id).map((p: any) => p.user_id);
        let allowedFollowing = new Set<string>();
        if (user && privateOwnerIds.length > 0) {
          const { data: follows } = await supabase.from("followers").select("following_id").eq("follower_id", user.id).in("following_id", privateOwnerIds);
          (follows || []).forEach((f: any) => allowedFollowing.add(f.following_id));
        }
        const visibleLists = data.filter((l: any) => {
          const p: any = profileMap.get(l.user_id);
          if (!p?.is_private) return true;
          if (l.user_id === user?.id) return true;
          return allowedFollowing.has(l.user_id);
        });

        const listIds = visibleLists.map((l: any) => l.id);
        const { data: allLikes } = listIds.length > 0
          ? await supabase.from("list_likes").select("list_id").in("list_id", listIds)
          : { data: [] as any[] };
        const likeCountMap = new Map<string, number>();
        (allLikes || []).forEach((lk: any) => {
          likeCountMap.set(lk.list_id, (likeCountMap.get(lk.list_id) || 0) + 1);
        });
        const enriched = await Promise.all(
          visibleLists.map(async (l: any) => {
            const { count } = await supabase.from("list_items").select("*", { count: "exact", head: true }).eq("list_id", l.id);
            return { ...l, item_count: count || 0, like_count: likeCountMap.get(l.id) || 0, profiles: profileMap.get(l.user_id) || null };
          })
        );
        enriched.sort((a, b) => b.like_count - a.like_count);
        setLists(enriched.slice(0, 30));
      } else {
        setLists([]);
      }
    } else if (activeFilter === "Users") {
      let qb = supabase.from("profiles").select("id, user_id, username, profile_picture");
      if (q) qb = qb.ilike("username", `%${q}%`);
      qb = qb.order("username").limit(30);
      const { data } = await qb;
      setUsers(data || []);
    }
    setLoading(false);
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

  useEffect(() => {
    if ((activeFilter !== "Countries" && activeFilter !== "Cities") || places.length === 0) return;
    if (destSort === "most-popular") return;

    (async () => {
      if (destSort === "avg-highest") {
        let avgMap = avgMapCacheRef.current;
        if (!avgMap) {
          avgMap = await fetchAverageRatingMap();
          avgMapCacheRef.current = avgMap;
        }
        // Apply immediately — no need to await if cached
        setPlaces((prev) => prev.map((p) => ({ ...p, _avg: avgMap!.get(p.id) || 0 })));
      } else if (destSort === "category-avg") {
        let catMap = catMapCacheRef.current[selectedCategory];
        if (!catMap) {
          catMap = await fetchCategoryAverageMap(selectedCategory);
          catMapCacheRef.current[selectedCategory] = catMap;
        }
        setPlaces((prev) => prev.map((p) => ({ ...p, _catAvg: catMap!.get(p.id) || 0 })));
      }
    })();
  }, [destSort, selectedCategory, places.length, activeFilter]);

  const sortedPlaces = getSortedPlaces();

  const renderDestinations = () => {
    if (loading) return <LoadingSpinner />;
    const isDestTab = activeFilter === "Countries" || activeFilter === "Cities";
    if (!isDestTab) return null;
    if (!sortedPlaces.length) return <EmptyState text={t("noResults")} />;

    const currentLabel = destSort === "category-avg"
      ? `${selectedCategory}`
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
        CONTINENT_ORDER.forEach((c) => { if (map.has(c)) groups.push({ label: c, items: map.get(c)! }); });
      } else {
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, items]) => groups.push({ label, items }));
      }
    }

    const renderPlaceGrid = (items: any[]) => (
      <div className="grid grid-cols-3 gap-3">
        {items.map((p: any) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
            <DestinationPoster placeId={p.id} name={p.name} country={p.country} type={p.type as "city" | "country"} image={p.image} className="w-full h-full" />
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
              <DropdownMenuItem onClick={() => setDestSort("most-popular")} className={destSort === "most-popular" ? "text-primary font-semibold" : ""}>
                {t("search.mostPopular")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDestSort("avg-highest")} className={destSort === "avg-highest" ? "text-primary font-semibold" : ""}>
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
              let remaining = visibleCount;
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
          renderPlaceGrid(sortedPlaces.slice(0, visibleCount))
        )}
        {sortedPlaces.length > visibleCount && (
          <div className="flex justify-center mt-5">
            <button
              onClick={() => setVisibleCount((c) => c + 250)}
              className="text-xs font-medium px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:bg-accent transition-colors"
            >
              View more
            </button>
          </div>
        )}
      </>
    );
  };

  const renderResults = () => {
    if (activeFilter === "Countries" || activeFilter === "Cities") return renderDestinations();

    if (loading) return <LoadingSpinner />;

    if (activeFilter === "Lists") {
      if (!lists.length) return <EmptyState text="No lists found" />;
      return (
        <div className="space-y-3">
          {lists.map((l: any) => (
            <motion.button key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate(`/list/${l.id}`)} className="w-full text-left bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3">
                {l.profiles && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={l.profiles.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.profiles.username || "?")}&background=0B1E46&color=fff`} />
                    <AvatarFallback>{l.profiles.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground" data-no-translate>{l.name}</p>
                  {l.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{l.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {l.profiles && <p className="text-xs text-muted-foreground">by <span data-no-translate>{l.profiles.username}</span></p>}
                    <span className="text-xs text-muted-foreground">• {l.item_count ?? "?"} destination{(l.item_count ?? 0) !== 1 ? "s" : ""}</span>
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
      if (!users.length) return <EmptyState text="No users found" />;
      return (
        <div className="space-y-3">
          {users.map((u: any) => {
            const isMe = u.user_id === user?.id;
            const isFollowing = followingIds.has(u.user_id);
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between py-3">
                <button onClick={() => navigate(isMe ? "/profile" : `/profile/${u.user_id}`)} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=0B1E46&color=fff`} />
                    <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground" data-no-translate>{u.username}</p>
                  </div>
                </button>
                {!isMe && !isFollowing && (
                  <button
                    onClick={async () => {
                      if (!user) return;
                      const { error } = await supabase.from("followers").insert({ follower_id: user.id, following_id: u.user_id });
                      if (error) { toast.error("Failed to follow"); return; }
                      setFollowingIds((prev) => new Set([...prev, u.user_id]));
                      toast.success(`Following ${u.username}!`);
                    }}
                    className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium"
                  >
                    Follow
                  </button>
                )}
                {!isMe && isFollowing && (
                  <span className="text-xs text-muted-foreground px-3 py-1.5">Following</span>
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
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{t("nav.search")}</h1>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
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
                setActiveFilter(tab);
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
          <div className="w-12 h-12 rounded-lg bg-muted/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-muted/40 rounded animate-pulse" />
            <div className="h-2 w-20 bg-muted/40 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
