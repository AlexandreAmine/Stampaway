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
import { MapPin } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Antarctica numeric id = "010"
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

interface CountryPlaceMap {
  [alpha2: string]: string;
}

interface FiveStarCity {
  name: string;
  coords: [number, number];
  placeId: string;
}

const CONTINENTS: Record<string, string[]> = {
  "Africa": AFRICA_COUNTRIES,
  "Asia": ASIA_COUNTRIES,
  "Europe": EUROPE_COUNTRIES,
  "North America": NORTH_AMERICA_COUNTRIES,
  "South America": SOUTH_AMERICA_COUNTRIES,
  "Oceania": OCEANIA_COUNTRIES,
};

function getContinent(country: string): string | null {
  for (const [continent, countries] of Object.entries(CONTINENTS)) {
    if (countries.includes(country)) return continent;
  }
  return null;
}

const MapChart = memo(({ visitedCodes, onCountryClick, fiveStarCities, onCityClick }: {
  visitedCodes: Set<string>;
  onCountryClick?: (alpha2: string) => void;
  fiveStarCities: FiveStarCity[];
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
          geographies
            .filter((geo) => geo.id !== ANTARCTICA_ID)
            .map((geo) => {
              const alpha2 = numericToAlpha2[geo.id] || "";
              const isVisited = visitedCodes.has(alpha2);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isVisited ? "hsl(217, 91%, 60%)" : "hsl(0, 0%, 18%)"}
                  stroke="hsl(0, 0%, 12%)"
                  strokeWidth={0.5}
                  onClick={() => isVisited && onCountryClick?.(alpha2)}
                  style={{
                    default: { outline: "none", cursor: isVisited ? "pointer" : "default" },
                    hover: { outline: "none", fill: isVisited ? "hsl(217, 91%, 70%)" : "hsl(0, 0%, 25%)", cursor: isVisited ? "pointer" : "default" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
        }
      </Geographies>
      {fiveStarCities.map((city) => (
        <Marker key={city.name} coordinates={[city.coords[1], city.coords[0]]}>
          <circle
            r={3}
            fill="hsl(45, 100%, 60%)"
            stroke="hsl(0, 0%, 10%)"
            strokeWidth={0.5}
            style={{ cursor: "pointer" }}
            onClick={() => onCityClick?.(city.placeId)}
          />
        </Marker>
      ))}
    </ZoomableGroup>
  </ComposableMap>
));
MapChart.displayName = "MapChart";

export function MapTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visitedCodes, setVisitedCodes] = useState<Set<string>>(new Set());
  const [countryPlaceMap, setCountryPlaceMap] = useState<CountryPlaceMap>({});
  const [loading, setLoading] = useState(true);
  const [fiveStarCities, setFiveStarCities] = useState<FiveStarCity[]>([]);

  // Stats
  const [visitedCountries, setVisitedCountries] = useState<Set<string>>(new Set());
  const [totalCountries, setTotalCountries] = useState(0);
  const [visitedCitiesCount, setVisitedCitiesCount] = useState(0);
  const [continentStats, setContinentStats] = useState<Record<string, { visited: number; total: number }>>({});
  const [topCountriesByCities, setTopCountriesByCities] = useState<{ country: string; count: number }[]>([]);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const [reviewsRes, totalRes] = await Promise.all([
        supabase
          .from("reviews")
          .select("place_id, rating, places!inner(name, country, type)")
          .eq("user_id", targetUserId),
        supabase
          .from("places")
          .select("id", { count: "exact", head: true })
          .eq("type", "country"),
      ]);

      if (reviewsRes.data) {
        const codes = new Set<string>();
        const placeMap: CountryPlaceMap = {};
        const visitedCountryNames = new Set<string>();
        const cityCountByCountry: Record<string, number> = {};
        let cityCount = 0;
        const fiveStars: FiveStarCity[] = [];

        reviewsRes.data.forEach((r: any) => {
          const code = getCountryCode(r.places.country);
          if (code) {
            codes.add(code);
            if (r.places.type === "country") {
              placeMap[code] = r.place_id;
              visitedCountryNames.add(r.places.country);
            } else if (!placeMap[code]) {
              placeMap[code] = r.place_id;
            }
          }

          if (r.places.type === "country") {
            visitedCountryNames.add(r.places.country);
          }

          if (r.places.type === "city") {
            cityCount++;
            const c = r.places.country;
            cityCountByCountry[c] = (cityCountByCountry[c] || 0) + 1;

            if (r.rating === 5) {
              const coords = getCityCoordinates(r.places.name);
              if (coords) {
                fiveStars.push({ name: r.places.name, coords, placeId: r.place_id });
              }
            }
          }
        });

        setVisitedCodes(codes);
        setCountryPlaceMap(placeMap);
        setVisitedCountries(visitedCountryNames);
        setVisitedCitiesCount(cityCount);
        setFiveStarCities(fiveStars);

        // Continent stats
        const cStats: Record<string, { visited: number; total: number }> = {};
        for (const [continent, countries] of Object.entries(CONTINENTS)) {
          const visited = countries.filter((c) => visitedCountryNames.has(c)).length;
          cStats[continent] = { visited, total: countries.length };
        }
        setContinentStats(cStats);

        // Top 5 countries by cities
        const sorted = Object.entries(cityCountByCountry)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([country, count]) => ({ country, count }));
        setTopCountriesByCities(sorted);
      }

      setTotalCountries(totalRes.count || 0);
      setLoading(false);
    })();
  }, [targetUserId]);

  const handleCountryClick = (alpha2: string) => {
    const placeId = countryPlaceMap[alpha2];
    if (placeId) navigate(`/place/${placeId}`);
  };

  const visitedContinentsCount = Object.values(continentStats).filter((s) => s.visited > 0).length;

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: 300 }}>
        <MapChart
          visitedCodes={visitedCodes}
          onCountryClick={handleCountryClick}
          fiveStarCities={fiveStarCities}
          onCityClick={(placeId) => navigate(`/place/${placeId}`)}
        />
      </div>

      {/* Country stats */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{visitedCountries.size}</span> / {totalCountries} countries
        </p>
        <span className="text-xs font-medium text-primary">
          {totalCountries > 0 ? ((visitedCountries.size / totalCountries) * 100).toFixed(1) : 0}%
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
          {Object.entries(continentStats).map(([continent, stats]) => (
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
          <span className="text-foreground font-semibold">{visitedCitiesCount}</span> cities visited
        </p>
      </div>

      {/* Top 5 countries by cities */}
      {topCountriesByCities.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Top countries by cities</p>
          {topCountriesByCities.map((item, i) => {
            const code = getCountryCode(item.country);
            const flag = code
              ? String.fromCodePoint(...code.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
              : "";
            return (
              <div key={item.country} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
                <span className="text-sm">
                  {flag} {item.country}
                </span>
                <span className="text-xs font-medium text-primary">{item.count} {item.count === 1 ? "city" : "cities"}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(217, 91%, 60%)" }} />
          <span>Visited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: "hsl(45, 100%, 60%)" }} />
          <span>5★ cities</span>
        </div>
      </div>
    </motion.div>
  );
}
