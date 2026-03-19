import { useState, useEffect, memo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCountryCode } from "@/lib/countryFlags";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO numeric → alpha-2 mapping for matching
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

const MapChart = memo(({ visitedCodes }: { visitedCodes: Set<string> }) => (
  <ComposableMap
    projection="geoMercator"
    projectionConfig={{ scale: 120, center: [0, 30] }}
    style={{ width: "100%", height: "100%" }}
  >
    <ZoomableGroup>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const alpha2 = numericToAlpha2[geo.id] || "";
            const isVisited = visitedCodes.has(alpha2);
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={isVisited ? "hsl(217, 91%, 60%)" : "hsl(0, 0%, 18%)"}
                stroke="hsl(0, 0%, 12%)"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: isVisited ? "hsl(217, 91%, 70%)" : "hsl(0, 0%, 25%)" },
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
MapChart.displayName = "MapChart";

export function MapTab() {
  const { user } = useAuth();
  const [visitedCodes, setVisitedCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get all unique countries from user's reviews
      const { data } = await supabase
        .from("reviews")
        .select("places!inner(country)")
        .eq("user_id", user.id);

      if (data) {
        const codes = new Set<string>();
        data.forEach((r: any) => {
          const code = getCountryCode(r.places.country);
          if (code) codes.add(code);
        });
        setVisitedCodes(codes);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{visitedCodes.size} countries visited</p>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: 300 }}>
        <MapChart visitedCodes={visitedCodes} />
      </div>
    </motion.div>
  );
}
