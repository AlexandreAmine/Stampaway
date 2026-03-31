import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCountryCode } from "@/lib/countryFlags";
import { getCityCoordinates } from "@/lib/cityCoordinates";
import {
  EUROPE_COUNTRIES, ASIA_COUNTRIES, NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES, AFRICA_COUNTRIES, OCEANIA_COUNTRIES,
} from "@/lib/continents";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const ANTARCTICA_ID = "010";

const numericToAlpha2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","020":"AD","024":"AO","028":"AG","032":"AR","051":"AM",
  "036":"AU","040":"AT","031":"AZ","044":"BS","048":"BH","050":"BD","052":"BB","112":"BY",
  "056":"BE","084":"BZ","204":"BJ","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR",
  "096":"BN","100":"BG","854":"BF","108":"BI","132":"CV","116":"KH","120":"CM","124":"CA",
  "140":"CF","148":"TD","152":"CL","156":"CN","170":"CO","174":"KM","178":"CG","180":"CD",
  "188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","262":"DJ","212":"DM",
  "214":"DO","218":"EC","818":"EG","222":"SV","226":"GQ","232":"ER","233":"EE","748":"SZ",
  "231":"ET","242":"FJ","246":"FI","250":"FR","266":"GA","270":"GM","268":"GE","276":"DE",
  "288":"GH","300":"GR","308":"GD","320":"GT","324":"GN","624":"GW","328":"GY","332":"HT",
  "340":"HN","348":"HU","352":"IS","356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE",
  "376":"IL","380":"IT","384":"CI","388":"JM","392":"JP","400":"JO","398":"KZ","404":"KE",
  "296":"KI","408":"KP","410":"KR","414":"KW","417":"KG","418":"LA","428":"LV","422":"LB",
  "426":"LS","430":"LR","434":"LY","438":"LI","440":"LT","442":"LU","450":"MG","454":"MW",
  "458":"MY","462":"MV","466":"ML","470":"MT","584":"MH","478":"MR","480":"MU","484":"MX",
  "583":"FM","498":"MD","492":"MC","496":"MN","499":"ME","504":"MA","508":"MZ","104":"MM",
  "516":"NA","520":"NR","524":"NP","528":"NL","554":"NZ","558":"NI","562":"NE","566":"NG",
  "807":"MK","578":"NO","512":"OM","586":"PK","585":"PW","275":"PS","591":"PA","598":"PG",
  "600":"PY","604":"PE","608":"PH","616":"PL","620":"PT","634":"QA","642":"RO","643":"RU",
  "646":"RW","659":"KN","662":"LC","670":"VC","882":"WS","674":"SM","678":"ST","682":"SA",
  "686":"SN","688":"RS","690":"SC","694":"SL","702":"SG","703":"SK","705":"SI","090":"SB",
  "706":"SO","710":"ZA","728":"SS","724":"ES","144":"LK","729":"SD","740":"SR","752":"SE",
  "756":"CH","760":"SY","158":"TW","762":"TJ","834":"TZ","764":"TH","626":"TL","768":"TG",
  "776":"TO","780":"TT","788":"TN","792":"TR","795":"TM","798":"TV","800":"UG","804":"UA",
  "784":"AE","826":"GB","840":"US","858":"UY","860":"UZ","548":"VU","336":"VA","862":"VE",
  "704":"VN","887":"YE","894":"ZM","716":"ZW","-99":"XK",
};

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
  fiveStarCities: { name: string; coords: [number, number]; placeId: string }[];
  visitedCountries: Set<string>;
  visitedCitiesCount: number;
  continentStats: Record<string, { visited: number; total: number }>;
  countryPlaceMap: Record<string, string>;
}

async function fetchUserMapData(userId: string): Promise<UserMapData> {
  const res = await supabase
    .from("reviews")
    .select("place_id, rating, places!inner(name, country, type)")
    .eq("user_id", userId);

  const codes = new Set<string>();
  const fiveStarCountryCodes = new Set<string>();
  const placeMap: Record<string, string> = {};
  const visitedCountryNames = new Set<string>();
  const cityCountByCountry: Record<string, number> = {};
  let cityCount = 0;
  const fiveStars: { name: string; coords: [number, number]; placeId: string }[] = [];

  (res.data || []).forEach((r: any) => {
    const code = getCountryCode(r.places.country);
    if (code) {
      codes.add(code);
      if (r.places.type === "country") {
        placeMap[code] = r.place_id;
        visitedCountryNames.add(r.places.country);
        if (r.rating === 5) fiveStarCountryCodes.add(code);
      } else if (!placeMap[code]) {
        placeMap[code] = r.place_id;
      }
    }
    if (r.places.type === "country") visitedCountryNames.add(r.places.country);
    if (r.places.type === "city") {
      cityCount++;
      const c = r.places.country;
      cityCountByCountry[c] = (cityCountByCountry[c] || 0) + 1;
      if (r.rating === 5) {
        const coords = getCityCoordinates(r.places.name);
        if (coords) fiveStars.push({ name: r.places.name, coords, placeId: r.place_id });
      }
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
  };
}

// ─── Solo Map ───
export { fetchUserMapData };
export type { UserMapData };

export const SoloMapChart = memo(({ data, onCountryClick, onCityClick }: {
  data: UserMapData;
  onCountryClick?: (alpha2: string) => void;
  onCityClick?: (placeId: string) => void;
}) => (
  <ComposableMap
    projection="geoMercator"
    projectionConfig={{ scale: 120, center: [0, 30] }}
    style={{ width: "100%", height: "100%" }}
  >
    <ZoomableGroup>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.filter((geo) => geo.id !== ANTARCTICA_ID).map((geo) => {
            const alpha2 = numericToAlpha2[geo.id] || "";
            const isVisited = data.visitedCodes.has(alpha2);
            const isFiveStar = data.fiveStarCountryCodes.has(alpha2);
            const fill = isFiveStar
              ? "hsl(25, 95%, 53%)"      // orange for 5/5 countries
              : isVisited
                ? "hsl(217, 91%, 60%)"    // blue for visited
                : "hsl(0, 0%, 18%)";
            const hoverFill = isFiveStar
              ? "hsl(25, 95%, 63%)"
              : isVisited
                ? "hsl(217, 91%, 70%)"
                : "hsl(0, 0%, 25%)";
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
                  hover: { outline: "none", fill: hoverFill, cursor: isVisited ? "pointer" : "default" },
                  pressed: { outline: "none" },
                }}
              />
            );
          })
        }
      </Geographies>
      {data.fiveStarCities.map((city) => (
        <Marker key={city.name} coordinates={[city.coords[1], city.coords[0]]}>
          <circle
            r={5}
            fill="hsl(35, 100%, 55%)"
            stroke="hsl(0, 0%, 10%)"
            strokeWidth={0.8}
            style={{ cursor: "pointer" }}
            onClick={() => onCityClick?.(city.placeId)}
          />
        </Marker>
      ))}
    </ZoomableGroup>
  </ComposableMap>
));
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
      <Geographies geography={GEO_URL}>
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalCountries, setTotalCountries] = useState(0);
  const [myData, setMyData] = useState<UserMapData | null>(null);
  const [theirData, setTheirData] = useState<UserMapData | null>(null);
  const [theirUsername, setTheirUsername] = useState("");

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
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // ─── Compare mode ───
  if (isCompare && theirData) {
    const myVisitedContinents = Object.values(myData.continentStats).filter((s) => s.visited > 0).length;
    const theirVisitedContinents = Object.values(theirData.continentStats).filter((s) => s.visited > 0).length;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: 300 }}>
          <CompareMapChart myData={myData} theirData={theirData} onCountryClick={handleCountryClick} />
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(217, 91%, 60%)" }} />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(40, 95%, 55%)" }} />
            <span>{theirUsername}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(150, 60%, 45%)" }} />
            <span>Both</span>
          </div>
        </div>

        {/* Comparative stats table */}
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium"></th>
                <th className="text-right px-3 py-2 font-semibold text-primary">You</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirUsername}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">Countries</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{myData.visitedCountries.size}</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirData.visitedCountries.size}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground pl-6">• In Percent</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{totalCountries > 0 ? ((myData.visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{totalCountries > 0 ? ((theirData.visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">Cities</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{myData.visitedCitiesCount}</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirData.visitedCitiesCount}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="px-3 py-2 text-muted-foreground">Continents</td>
                <td className="text-right px-3 py-2 font-semibold text-primary">{myVisitedContinents}</td>
                <td className="text-right px-3 py-2 font-semibold" style={{ color: "hsl(40, 95%, 55%)" }}>{theirVisitedContinents}</td>
              </tr>
              {Object.entries(CONTINENTS).map(([continent]) => {
                const myStat = myData.continentStats[continent];
                const theirStat = theirData.continentStats[continent];
                return (
                  <tr key={continent} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 text-muted-foreground pl-6">• {continent}</td>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: 300 }}>
        <SoloMapChart
          data={myData}
          onCountryClick={handleCountryClick}
          onCityClick={(placeId) => navigate(`/place/${placeId}`)}
        />
      </div>

      {/* Country stats */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{myData.visitedCountries.size}</span> / {totalCountries} countries
        </p>
        <span className="text-xs font-medium text-primary">
          {totalCountries > 0 ? ((myData.visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%
        </span>
      </div>

      {/* Continent stats */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{visitedContinentsCount}</span> / 6 continents
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(myData.continentStats).map(([continent, stats]) => (
            <div key={continent} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{continent}</span>
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
          <span className="text-foreground font-semibold">{myData.visitedCitiesCount}</span> cities visited
        </p>
      </div>

      {/* Top countries by cities - fetch inline */}
      <TopCountriesByCities userId={targetUserId!} />

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(217, 91%, 60%)" }} />
          <span>Visited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(25, 95%, 53%)" }} />
          <span>5★ country</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: "hsl(35, 100%, 55%)" }} />
          <span>5★ city</span>
        </div>
      </div>
    </motion.div>
  );
}

// Small sub-component to fetch top countries by cities
function TopCountriesByCities({ userId }: { userId: string }) {
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
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Top countries by cities</p>
      {top.map((item) => {
        const code = getCountryCode(item.country);
        const flag = code
          ? String.fromCodePoint(...code.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
          : "";
        return (
          <div key={item.country} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
            <span className="text-sm">{flag} {item.country}</span>
            <span className="text-xs font-medium text-primary">{item.count} {item.count === 1 ? "city" : "cities"}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Visited Together ───
function VisitedTogether({ myUserId, theirUserId, theirUsername }: { myUserId: string; theirUserId: string; theirUsername: string }) {
  const navigate = useNavigate();
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
        Visited together with {theirUsername}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {countries.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Countries ({countries.length})
            </p>
            <div className="space-y-1">
              {countries.map(c => {
                const code = getCountryCode(c.name);
                const flag = code
                  ? String.fromCodePoint(...code.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
                  : "";
                return (
                  <button
                    key={c.placeId}
                    onClick={() => navigate(`/place/${c.placeId}`)}
                    className="w-full flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-sm">{flag}</span>
                    <span className="text-xs text-foreground">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {cities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Cities ({cities.length})
            </p>
            <div className="space-y-1">
              {cities.map(c => (
                <button
                  key={c.placeId}
                  onClick={() => navigate(`/place/${c.placeId}`)}
                  className="w-full flex items-center gap-1.5 bg-muted/30 rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xs text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">({c.country})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}