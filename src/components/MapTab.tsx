import { useState, useEffect, memo } from "react";
import { placeLinkProps } from "@/lib/placePrimaryQuery";
import { hapticSelection } from "@/lib/haptics";
import { useNavigate } from "react-router-dom";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { continentLabel } from "@/lib/continentLabels";
import { getCachedPlaceName } from "@/lib/placeNames";
import { CountryFlag } from "@/components/CountryFlag";
import { getCountryCode } from "@/lib/countryFlags";
import { cityPosition, useCityPositions } from "@/lib/placeCoordinates";
import { numericToAlpha2 } from "@/lib/isoCountryCodes";
import {
  EUROPE_COUNTRIES, ASIA_COUNTRIES, NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES, AFRICA_COUNTRIES, OCEANIA_COUNTRIES,
} from "@/lib/continents";

// Bundled locally (public/countries-110m.json) so the profile map never
// depends on a third-party CDN request at runtime.
const GEO_URL = "/countries-110m.json";
const ANTARCTICA_ID = "010";

// Read once per app session and handed to the maps as data. Given the URL,
// react-simple-maps downloads and parses the file again on every mount and
// draws nothing until that finishes; given the parsed file, it draws on
// mount. Until the first read completes, the URL is used as before.
let worldTopology: object | null = null;
if (typeof window !== "undefined" && typeof fetch === "function") {
  fetch(GEO_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) worldTopology = data;
    })
    .catch(() => {});
}
const worldGeography = () => worldTopology ?? GEO_URL;


const CONTINENTS: Record<string, string[]> = {
  "Africa": AFRICA_COUNTRIES,
  "Asia": ASIA_COUNTRIES,
  "Europe": EUROPE_COUNTRIES,
  "North America": NORTH_AMERICA_COUNTRIES,
  "South America": SOUTH_AMERICA_COUNTRIES,
  "Oceania": OCEANIA_COUNTRIES,
};

interface UserMapData {
  visitedCodes: Set<string>;
  fiveStarCountryCodes: Set<string>;
  /** coords: best position known when loaded; the map refines it (useCityPositions). */
  fiveStarCities: { name: string; country: string; coords: [number, number] | null; placeId: string }[];
  visitedCountries: Set<string>;
  visitedCitiesCount: number;
  continentStats: Record<string, { visited: number; total: number }>;
  countryPlaceMap: Record<string, string>;
  countryRatings: Record<string, number | null>; // alpha2 -> best rating
  ratedCities: { name: string; country: string; coords: [number, number] | null; placeId: string; rating: number | null }[];
}

async function fetchUserMapData(userId: string, options: { throwOnError?: boolean } = {}): Promise<UserMapData> {
  const res = await supabase
    .from("reviews")
    .select("place_id, rating, places!inner(name, country, type)")
    .eq("user_id", userId);

  if (res.error && options.throwOnError) throw res.error;

  const codes = new Set<string>();
  const fiveStarCountryCodes = new Set<string>();
  const placeMap: Record<string, string> = {};
  const visitedCountryNames = new Set<string>();
  const cityCountByCountry: Record<string, number> = {};
  let cityCount = 0;
  const fiveStars: UserMapData["fiveStarCities"] = [];
  const countryRatings: Record<string, number | null> = {};
  const ratedCities: UserMapData["ratedCities"] = [];

  (res.data || []).forEach((r: any) => {
    const code = getCountryCode(r.places.country);
    if (r.places.type === "country") {
      if (code) {
        codes.add(code);
        placeMap[code] = r.place_id;
        if (r.rating === 5) fiveStarCountryCodes.add(code);
        const existing = countryRatings[code];
        const rating = r.rating != null ? Number(r.rating) : null;
        if (rating != null && (existing == null || rating > existing)) {
          countryRatings[code] = rating;
        } else if (!(code in countryRatings)) {
          countryRatings[code] = null;
        }
      }
      visitedCountryNames.add(r.places.country);
    }
    if (r.places.type === "city") {
      // City logs must NOT mark the country as visited on the map.
      // Only register a place mapping fallback so clicking a (country-logged) country still opens correctly.
      if (code && !placeMap[code]) placeMap[code] = r.place_id;
      cityCount++;
      const c = r.places.country;
      cityCountByCountry[c] = (cityCountByCountry[c] || 0) + 1;
      const rating = r.rating != null ? Number(r.rating) : null;
      // Every city is kept, located or not: the map places it once the
      // phone's geocoder has found it (by name and country, so Valencia in
      // Venezuela isn't drawn in Spain).
      const coords = cityPosition(r.places.name, c);
      if (r.rating === 5) fiveStars.push({ name: r.places.name, country: c, coords, placeId: r.place_id });
      ratedCities.push({ name: r.places.name, country: c, coords, placeId: r.place_id, rating });
    }
  });

  const cStats: Record<string, { visited: number; total: number }> = {};
  for (const [continent, countries] of Object.entries(CONTINENTS)) {
    const visited = countries.filter((c) => visitedCountryNames.has(c)).length;
    cStats[continent] = { visited, total: countries.length };
  }

  return {
    visitedCodes: codes,
    fiveStarCountryCodes,
    fiveStarCities: fiveStars,
    visitedCountries: visitedCountryNames,
    visitedCitiesCount: cityCount,
    continentStats: cStats,
    countryPlaceMap: placeMap,
    countryRatings,
    ratedCities,
  };
}

// ─── Solo Map ───
export { fetchUserMapData };
export type { UserMapData };

function getRatingColor(rating: number | null | undefined): string {
  if (rating == null) return "hsl(217, 91%, 60%)"; // blue - no grade
  if (rating >= 4.5) return "hsl(0, 85%, 50%)";    // red
  if (rating >= 3.5) return "hsl(25, 95%, 53%)";   // orange
  if (rating >= 2) return "hsl(45, 95%, 50%)";     // yellow
  return "hsl(75, 60%, 45%)";                       // green-yellow
}

function getCityDotColor(rating: number | null | undefined): string {
  if (rating != null && rating === 5) return "hsl(0, 100%, 55%)"; // flashy red
  return getRatingColor(rating);
}

export const SoloMapChart = memo(({ data, onCountryClick, onCityClick, coloredMode }: {
  data: UserMapData;
  onCountryClick?: (alpha2: string) => void;
  onCityClick?: (placeId: string) => void;
  coloredMode?: boolean;
}) => {
  const fiveStarCities = useCityPositions(data.fiveStarCities);
  return (
  <ComposableMap
    projection="geoMercator"
    projectionConfig={{ scale: 120, center: [0, 30] }}
    style={{ width: "100%", height: "100%" }}
  >
    <ZoomableGroup>
      <Geographies geography={worldGeography()}>
        {({ geographies }) =>
          geographies.filter((geo) => geo.id !== ANTARCTICA_ID).map((geo) => {
            const alpha2 = numericToAlpha2[geo.id] || "";
            const isVisited = data.visitedCodes.has(alpha2);
            let fill = "hsl(0, 0%, 18%)";
            if (isVisited) {
              fill = coloredMode
                ? getRatingColor(data.countryRatings[alpha2])
                : "hsl(217, 91%, 60%)";
            }
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke="hsl(0, 0%, 12%)"
                strokeWidth={0.5}
                onClick={() => isVisited && onCountryClick?.(alpha2)}
                style={{
                  default: { outline: "none", cursor: isVisited ? "pointer" : "default" },
                  hover: { outline: "none", fill: isVisited ? fill : "hsl(0, 0%, 25%)", opacity: isVisited ? 0.85 : 1, cursor: isVisited ? "pointer" : "default" },
                  pressed: { outline: "none" },
                }}
              />
            );
          })
        }
      </Geographies>
      {coloredMode && fiveStarCities.map((city) => (
        <Marker key={city.placeId} coordinates={[city.coords[1], city.coords[0]]}>
          <circle
            r={5}
            fill="hsl(270, 70%, 50%)"
            stroke="hsl(0, 0%, 10%)"
            strokeWidth={0.8}
            style={{ cursor: "pointer" }}
            onClick={() => onCityClick?.(city.placeId)}
          />
        </Marker>
      ))}
    </ZoomableGroup>
  </ComposableMap>
  );
});
SoloMapChart.displayName = "SoloMapChart";

// ─── Comparative Map ───
export const CompareMapChart = memo(({ myData, theirData, onCountryClick }: {
  myData: UserMapData;
  theirData: UserMapData;
  onCountryClick?: (alpha2: string) => void;
}) => (
  <ComposableMap
    projection="geoMercator"
    projectionConfig={{ scale: 120, center: [0, 30] }}
    style={{ width: "100%", height: "100%" }}
  >
    <ZoomableGroup>
      <Geographies geography={worldGeography()}>
        {({ geographies }) =>
          geographies.filter((geo) => geo.id !== ANTARCTICA_ID).map((geo) => {
            const alpha2 = numericToAlpha2[geo.id] || "";
            const mine = myData.visitedCodes.has(alpha2);
            const theirs = theirData.visitedCodes.has(alpha2);
            let fill = "hsl(0, 0%, 18%)";
            if (mine && theirs) fill = "hsl(150, 60%, 45%)"; // green = both
            else if (mine) fill = "hsl(217, 91%, 60%)";       // blue = me
            else if (theirs) fill = "hsl(40, 95%, 55%)";      // yellow/orange = them
            const isVisited = mine || theirs;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke="hsl(0, 0%, 12%)"
                strokeWidth={0.5}
                onClick={() => isVisited && onCountryClick?.(alpha2)}
                style={{
                  default: { outline: "none", cursor: isVisited ? "pointer" : "default" },
                  hover: { outline: "none", fill: isVisited ? fill : "hsl(0, 0%, 25%)", cursor: isVisited ? "pointer" : "default", opacity: isVisited ? 0.85 : 1 },
                  pressed: { outline: "none" },
                }}
              />
            );
          })
        }
      </Geographies>
    </ZoomableGroup>
  </ComposableMap>
));
CompareMapChart.displayName = "CompareMapChart";

// ─── Main Component ───
export function MapTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const { t, tn } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalCountries, setTotalCountries] = useState(0);
  const [myData, setMyData] = useState<UserMapData | null>(null);
  const [theirData, setTheirData] = useState<UserMapData | null>(null);
  const [theirUsername, setTheirUsername] = useState("");
  const [coloredMode, setColoredMode] = useState(false);

  const targetUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;
  const isCompare = !isOwnProfile && !!user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const totalRes = await supabase
        .from("places")
        .select("id", { count: "exact", head: true })
        .eq("type", "country");
      setTotalCountries(totalRes.count || 0);

      if (isCompare && user?.id) {
        const [mine, theirs] = await Promise.all([
          fetchUserMapData(user.id),
          fetchUserMapData(targetUserId),
        ]);
        setMyData(mine);
        setTheirData(theirs);
        // fetch their username
        const { data: prof } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", targetUserId)
          .single();
        setTheirUsername(prof?.username || "Them");
      } else {
        const data = await fetchUserMapData(targetUserId);
        setMyData(data);
      }
      setLoading(false);
    })();
  }, [targetUserId, isCompare, user?.id]);

  const handleCountryClick = (alpha2: string) => {
    const placeId = myData?.countryPlaceMap[alpha2] || theirData?.countryPlaceMap[alpha2];
    if (placeId) navigate(`/place/${placeId}`);
  };

  if (loading || !myData) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-64 bg-muted/40 rounded-xl skeleton-shimmer" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-muted/40 rounded-xl skeleton-shimmer" />
          <div className="h-16 bg-muted/40 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    );
  }

  // ─── Compare mode ───
  if (isCompare && theirData) {
    const myVisitedContinents = Object.values(myData.continentStats).filter((s) => s.visited > 0).length;
    const theirVisitedContinents = Object.values(theirData.continentStats).filter((s) => s.visited > 0).length;

    return (
      <motion.div initial={false} animate={{ opacity: 1 }}>
        <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: 300 }}>
          <CompareMapChart myData={myData} theirData={theirData} onCountryClick={handleCountryClick} />
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(217, 91%, 60%)" }} />
            <span>{t("profile.legendYou")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(40, 95%, 55%)" }} />
            <span>{theirUsername}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(150, 60%, 45%)" }} />
            <span>{t("profile.legendBoth")}</span>
          </div>
        </div>

        {/* Comparative stats table */}
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium"></th>
                <th className="text-right px-3 py-2 font-semibold text-primary">{t("profile.legendYou")}</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirUsername}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">{t("profile.countries")}</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{myData.visitedCountries.size}</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirData.visitedCountries.size}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground pl-6">• {t("map.inPercent")}</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{totalCountries > 0 ? ((myData.visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{totalCountries > 0 ? ((theirData.visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">{t("profile.cities")}</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{myData.visitedCitiesCount}</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirData.visitedCitiesCount}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">{t("map.continents")}</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{myVisitedContinents}</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirVisitedContinents}</td>
              </tr>
              {Object.entries(CONTINENTS).map(([continent]) => {
                const myStat = myData.continentStats[continent];
                const theirStat = theirData.continentStats[continent];
                return (
                  <tr key={continent} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 text-muted-foreground pl-6">• {continentLabel(continent, t)}</td>
                    <td className={`text-right px-3 py-2 text-xs font-medium ${myStat?.visited > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {myStat?.total > 0 ? ((myStat.visited / myStat.total) * 100).toFixed(0) : 0}%
                    </td>
                    <td className={`text-right px-3 py-2 text-xs font-medium`} style={{ color: theirStat?.visited > 0 ? "hsl(40, 95%, 55%)" : undefined }}>
                      {theirStat?.total > 0 ? ((theirStat.visited / theirStat.total) * 100).toFixed(0) : 0}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Visited Together Section */}
        <VisitedTogether myUserId={user!.id} theirUserId={targetUserId!} theirUsername={theirUsername} />

        {/* Rating Comparison */}
        <RatingComparison myUserId={user!.id} theirUserId={targetUserId!} theirUsername={theirUsername} />

        {/* Shared Wishlist */}
        <SharedWishlist myUserId={user!.id} theirUserId={targetUserId!} theirUsername={theirUsername} />
      </motion.div>
    );
  }

  // ─── Solo mode ───
  const visitedContinentsCount = Object.values(myData.continentStats).filter((s) => s.visited > 0).length;

  // Top 5 countries by cities
  // Re-compute from raw data isn't stored, so let's compute inline
  // We already have myData but not topCountries. Let's compute it.
  // We'll do a simpler approach: store it in the data fetcher
  // For now, fetch it separately (it's fast since we can derive from visitedCountries)

  return (
    <motion.div initial={false} animate={{ opacity: 1 }}>
      <div className="relative bg-card rounded-xl border border-border overflow-hidden" style={{ height: 300 }}>
        <button
          onClick={() => { hapticSelection(); setColoredMode(!coloredMode); }}
          className={`absolute top-2 right-2 z-10 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            coloredMode
              ? "bg-primary text-primary-foreground"
              : "bg-card/80 backdrop-blur-sm text-muted-foreground border border-border"
          }`}
        >
          {t("map.coloredRatings")}
        </button>
        <SoloMapChart
          data={myData}
          onCountryClick={handleCountryClick}
          onCityClick={(placeId) => navigate(`/place/${placeId}`)}
          coloredMode={coloredMode}
        />
      </div>

      {coloredMode && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background: "hsl(0, 85%, 50%)" }} /><span>5 - 4.5</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background: "hsl(25, 95%, 53%)" }} /><span>4 - 3.5</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background: "hsl(45, 95%, 50%)" }} /><span>3 - 2</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background: "hsl(75, 60%, 45%)" }} /><span>1.5 - 0.5</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ background: "hsl(217, 91%, 60%)" }} /><span>{t("map.noGrade")}</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full" style={{ background: "hsl(270, 70%, 50%)" }} /><span>{t("map.fiveStarCity")}</span></div>
        </div>
      )}

      {/* Country stats */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{myData.visitedCountries.size}</span> {t("map.ofCountries", { total: String(totalCountries) })}
        </p>
        <span className="text-xs font-medium text-primary">
          {totalCountries > 0 ? ((myData.visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%
        </span>
      </div>

      {/* Continent stats */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{visitedContinentsCount}</span> {t("map.ofContinents")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(myData.continentStats).map(([continent, stats]) => (
            <div key={continent} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{continentLabel(continent, t)}</span>
              <span className={`text-xs font-medium ${stats.visited > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {stats.total > 0 ? ((stats.visited / stats.total) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cities visited */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{myData.visitedCitiesCount}</span> {tn("map.citiesVisited", myData.visitedCitiesCount)}
        </p>
      </div>

      {/* Top countries by cities - fetch inline */}
      <TopCountriesByCities userId={targetUserId!} />

    </motion.div>
  );
}

// Small sub-component to fetch top countries by cities
function TopCountriesByCities({ userId }: { userId: string }) {
  const { t, tn, language } = useLanguage();
  const [top, setTop] = useState<{ country: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("places!inner(country, type)")
        .eq("user_id", userId);
      if (!data) return;
      const counts: Record<string, number> = {};
      data.forEach((r: any) => {
        if (r.places.type === "city") {
          counts[r.places.country] = (counts[r.places.country] || 0) + 1;
        }
      });
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([country, count]) => ({ country, count }));
      setTop(sorted);
    })();
  }, [userId]);

  if (top.length === 0) return null;

  return (
    <div className="mt-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">{t("map.topCountriesByCities")}</p>
      {top.map((item) => {
        return (
          <div key={item.country} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
            <span className="text-sm inline-flex items-center gap-1.5">
              <CountryFlag country={item.country} />
              {getCachedPlaceName(item.country, language, true)}
            </span>
            <span className="text-xs font-medium text-primary">{tn("count.city", item.count)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Visited Together ───
function VisitedTogether({ myUserId, theirUserId, theirUsername }: { myUserId: string; theirUserId: string; theirUsername: string }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [countries, setCountries] = useState<{ name: string; placeId: string }[]>([]);
  const [cities, setCities] = useState<{ name: string; country: string; placeId: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Find reviews where I tagged them
      const { data: myTags } = await supabase
        .from("review_tags")
        .select("review_id")
        .eq("tagged_by_user_id", myUserId)
        .eq("tagged_user_id", theirUserId);

      // Find reviews where they tagged me
      const { data: theirTags } = await supabase
        .from("review_tags")
        .select("review_id")
        .eq("tagged_by_user_id", theirUserId)
        .eq("tagged_user_id", myUserId);

      const reviewIds = new Set([
        ...(myTags || []).map(t => t.review_id),
        ...(theirTags || []).map(t => t.review_id),
      ]);

      if (reviewIds.size === 0) { setLoading(false); return; }

      const { data: reviews } = await supabase
        .from("reviews")
        .select("place_id, places!inner(id, name, country, type)")
        .in("id", Array.from(reviewIds));

      const countryMap = new Map<string, { name: string; placeId: string }>();
      const cityMap = new Map<string, { name: string; country: string; placeId: string }>();

      (reviews || []).forEach((r: any) => {
        if (r.places.type === "country") {
          countryMap.set(r.places.id, { name: r.places.name, placeId: r.places.id });
        } else {
          cityMap.set(r.places.id, { name: r.places.name, country: r.places.country, placeId: r.places.id });
        }
      });

      setCountries(Array.from(countryMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setCities(Array.from(cityMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })();
  }, [myUserId, theirUserId]);

  if (loading) return null;
  if (countries.length === 0 && cities.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-foreground mb-3">
        {t("map.visitedTogetherWith", { username: theirUsername })}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {countries.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">
              {t("profile.countries")} ({countries.length})
            </p>
            <div className="space-y-1">
              {countries.map(c => {
                return (
                  <button
                    key={c.placeId}
                    onClick={() => navigate(`/place/${c.placeId}`)} {...placeLinkProps(c.placeId)}
                    className="w-full flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <CountryFlag country={c.name} />
                    <span className="text-xs text-foreground">{getCachedPlaceName(c.name, language, true)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {cities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">
              {t("profile.cities")} ({cities.length})
            </p>
            <div className="space-y-1">
              {cities.map(c => (
                <button
                  key={c.placeId}
                  onClick={() => navigate(`/place/${c.placeId}`)} {...placeLinkProps(c.placeId)}
                  className="w-full flex items-center gap-1.5 bg-muted/30 rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xs text-foreground">{getCachedPlaceName(c.name, language, false)}</span>
                  <span className="text-[11px] text-muted-foreground">({getCachedPlaceName(c.country, language, true)})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rating Comparison ───
function RatingComparison({ myUserId, theirUserId, theirUsername }: { myUserId: string; theirUserId: string; theirUsername: string }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [countries, setCountries] = useState<{ name: string; placeId: string; myRating: number | null; theirRating: number | null }[]>([]);
  const [cities, setCities] = useState<{ name: string; country: string; placeId: string; myRating: number | null; theirRating: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingTab, setRatingTab] = useState<"country" | "city">("country");

  useEffect(() => {
    (async () => {
      const [{ data: myReviews }, { data: theirReviews }] = await Promise.all([
        supabase.from("reviews").select("place_id, rating, visit_year, visit_month, created_at, places!inner(id, name, country, type)").eq("user_id", myUserId),
        supabase.from("reviews").select("place_id, rating, visit_year, visit_month, created_at, places!inner(id, name, country, type)").eq("user_id", theirUserId),
      ]);

      // Dedupe: keep newest per place per user
      const newestByPlace = (reviews: any[]) => {
        const map = new Map<string, any>();
        reviews.sort((a: any, b: any) => {
          if ((a.visit_year ?? 0) !== (b.visit_year ?? 0)) return (b.visit_year ?? 0) - (a.visit_year ?? 0);
          if ((a.visit_month ?? 0) !== (b.visit_month ?? 0)) return (b.visit_month ?? 0) - (a.visit_month ?? 0);
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        for (const r of reviews) {
          if (!map.has(r.place_id)) map.set(r.place_id, r);
        }
        return map;
      };

      const myMap = newestByPlace(myReviews || []);
      const theirMap = newestByPlace(theirReviews || []);

      const sharedCountries: typeof countries = [];
      const sharedCities: typeof cities = [];

      for (const [placeId, myR] of myMap) {
        const theirR = theirMap.get(placeId);
        if (!theirR) continue;
        const place = myR.places;
        const entry = {
          name: place.name,
          country: place.country,
          placeId: place.id,
          myRating: myR.rating != null ? Number(myR.rating) : null,
          theirRating: theirR.rating != null ? Number(theirR.rating) : null,
        };
        if (place.type === "country") sharedCountries.push(entry);
        else sharedCities.push(entry);
      }

      // Sort by closest grades first (smallest difference)
      const sortByClosest = (arr: typeof countries) => arr.sort((a, b) => {
        const diffA = (a.myRating != null && a.theirRating != null) ? Math.abs(a.myRating - a.theirRating) : 999;
        const diffB = (b.myRating != null && b.theirRating != null) ? Math.abs(b.myRating - b.theirRating) : 999;
        return diffA - diffB;
      });

      sortByClosest(sharedCountries);
      sortByClosest(sharedCities);

      setCountries(sharedCountries);
      setCities(sharedCities);
      setLoading(false);
    })();
  }, [myUserId, theirUserId]);

  if (loading) return null;
  if (countries.length === 0 && cities.length === 0) return null;

  const renderRow = (item: { name: string; country?: string; placeId: string; myRating: number | null; theirRating: number | null }, showCountry = false) => {
    return (
      <button
        key={item.placeId}
        onClick={() => navigate(`/place/${item.placeId}`)} {...placeLinkProps(item.placeId)}
        className="w-full flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {!showCountry && <CountryFlag country={item.name} />}
          <span className="text-xs text-foreground truncate">{getCachedPlaceName(item.name, language, !showCountry)}</span>
          {showCountry && <span className="text-[11px] text-muted-foreground">({getCachedPlaceName(item.country ?? "", language, true)})</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-primary">{item.myRating != null ? item.myRating.toFixed(1) : "—"}</span>
          <span className="text-xs font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{item.theirRating != null ? item.theirRating.toFixed(1) : "—"}</span>
        </div>
      </button>
    );
  };

  const activeList = ratingTab === "country" ? countries : cities;

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-foreground mb-2">{t("map.ratingComparison")}</p>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          {(["country", "city"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { if (ratingTab !== tab) hapticSelection(); setRatingTab(tab); }}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
                ratingTab === tab ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {tab === "country" ? t("profile.countries") : t("profile.cities")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-primary">{t("profile.legendYou")}</span>
          <span className="text-[11px] font-medium" style={{ color: "hsl(40, 95%, 55%)" }}>{theirUsername}</span>
        </div>
      </div>

      {activeList.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t(ratingTab === "country" ? "map.noSharedCountries" : "map.noSharedCities")}</p>
      ) : (
        <div className="space-y-1">{activeList.map((c) => renderRow(c, ratingTab === "city"))}</div>
      )}
    </div>
  );
}

// ─── Shared Wishlist ───
function SharedWishlist({ myUserId, theirUserId, theirUsername }: { myUserId: string; theirUserId: string; theirUsername: string }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [countries, setCountries] = useState<{ name: string; placeId: string }[]>([]);
  const [cities, setCities] = useState<{ name: string; country: string; placeId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishTab, setWishTab] = useState<"country" | "city">("country");

  useEffect(() => {
    (async () => {
      const [{ data: myWish }, { data: theirWish }] = await Promise.all([
        supabase.from("wishlists").select("place_id, places!inner(id, name, country, type)").eq("user_id", myUserId),
        supabase.from("wishlists").select("place_id, places!inner(id, name, country, type)").eq("user_id", theirUserId),
      ]);

      const theirSet = new Set((theirWish || []).map((w: any) => w.place_id));
      const sharedCountries: typeof countries = [];
      const sharedCities: typeof cities = [];

      (myWish || []).forEach((w: any) => {
        if (!theirSet.has(w.place_id)) return;
        const p = w.places;
        if (p.type === "country") sharedCountries.push({ name: p.name, placeId: p.id });
        else sharedCities.push({ name: p.name, country: p.country, placeId: p.id });
      });

      sharedCountries.sort((a, b) => a.name.localeCompare(b.name));
      sharedCities.sort((a, b) => a.name.localeCompare(b.name));

      setCountries(sharedCountries);
      setCities(sharedCities);
      setLoading(false);
    })();
  }, [myUserId, theirUserId]);

  if (loading) return null;
  if (countries.length === 0 && cities.length === 0) return null;

  const activeList = wishTab === "country" ? countries : cities;

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-foreground mb-2">{t("map.sharedWishlist")}</p>
      <div className="flex gap-2 mb-3">
        {(["country", "city"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { if (wishTab !== tab) hapticSelection(); setWishTab(tab); }}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
              wishTab === tab ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {tab === "country" ? t("profile.countries") : t("profile.cities")}
          </button>
        ))}
      </div>

      {activeList.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t(wishTab === "country" ? "map.noSharedCountries" : "map.noSharedCities")}</p>
      ) : (
        <div className="space-y-1">
          {activeList.map((c) => {
            return (
              <button key={c.placeId} onClick={() => navigate(`/place/${c.placeId}`)} {...placeLinkProps(c.placeId)} className="w-full flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors text-left">
                {wishTab === "country" && <CountryFlag country={c.name} />}
                <span className="text-xs text-foreground">{getCachedPlaceName(c.name, language, wishTab === "country")}</span>
                {"country" in c && wishTab === "city" && <span className="text-[11px] text-muted-foreground">({getCachedPlaceName((c as any).country, language, true)})</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
