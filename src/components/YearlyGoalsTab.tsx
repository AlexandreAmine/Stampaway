import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Check, Target, Trophy, MapPin, Globe, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  EUROPE_COUNTRIES, ASIA_COUNTRIES, NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES, AFRICA_COUNTRIES, OCEANIA_COUNTRIES
} from "@/lib/continents";

const CONTINENTS = ["total", "Europe", "Asia", "North America", "South America", "Africa", "Oceania"] as const;

const CONTINENT_LABELS: Record<string, Record<string, string>> = {
  total: { en: "Overall", fr: "Global", es: "Global", it: "Globale", pt: "Global", nl: "Totaal" },
  Europe: { en: "Europe", fr: "Europe", es: "Europa", it: "Europa", pt: "Europa", nl: "Europa" },
  Asia: { en: "Asia", fr: "Asie", es: "Asia", it: "Asia", pt: "Ásia", nl: "Azië" },
  "North America": { en: "North America", fr: "Amérique du Nord", es: "América del Norte", it: "Nord America", pt: "América do Norte", nl: "Noord-Amerika" },
  "South America": { en: "South America", fr: "Amérique du Sud", es: "América del Sur", it: "Sud America", pt: "América do Sul", nl: "Zuid-Amerika" },
  Africa: { en: "Africa", fr: "Afrique", es: "África", it: "Africa", pt: "África", nl: "Afrika" },
  Oceania: { en: "Oceania", fr: "Océanie", es: "Oceanía", it: "Oceania", pt: "Oceania", nl: "Oceanië" },
};

function getContinentForCountry(country: string): string {
  if (EUROPE_COUNTRIES.includes(country)) return "Europe";
  if (ASIA_COUNTRIES.includes(country)) return "Asia";
  if (NORTH_AMERICA_COUNTRIES.includes(country)) return "North America";
  if (SOUTH_AMERICA_COUNTRIES.includes(country)) return "South America";
  if (AFRICA_COUNTRIES.includes(country)) return "Africa";
  if (OCEANIA_COUNTRIES.includes(country)) return "Oceania";
  return "Other";
}

interface GoalRow {
  continent: string;
  country_goal: number;
  city_goal: number;
}

interface GoalPlace {
  id: string;
  place_id: string;
  completed: boolean;
  place?: { name: string; country: string; type: string; id: string };
}

interface YearlyGoalsTabProps {
  userId: string;
}

export function YearlyGoalsTab({ userId }: YearlyGoalsTabProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const isOwn = user?.id === userId;

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalPlaces, setGoalPlaces] = useState<GoalPlace[]>([]);
  const [editing, setEditing] = useState(false);
  const [editGoals, setEditGoals] = useState<Record<string, { countries: number; cities: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [progress, setProgress] = useState<{ countriesVisited: number; citiesVisited: number; byContinent: Record<string, { countries: number; cities: number }> }>({ countriesVisited: 0, citiesVisited: 0, byContinent: {} });

  const fetchGoals = useCallback(async () => {
    const [goalsRes, placesRes] = await Promise.all([
      supabase.from("yearly_goals").select("*").eq("user_id", userId).eq("year", currentYear),
      supabase.from("yearly_goal_places").select("id, place_id, completed, places!inner(name, country, type, id)").eq("user_id", userId).eq("year", currentYear),
    ]);
    if (goalsRes.data) setGoals(goalsRes.data as any);
    if (placesRes.data) setGoalPlaces(placesRes.data.map((p: any) => ({ ...p, place: p.places })));
  }, [userId, currentYear]);

  const fetchProgress = useCallback(async () => {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("place_id, visit_year, places!inner(name, country, type)")
      .eq("user_id", userId)
      .eq("visit_year", currentYear);

    if (!reviews) return;

    const uniqueCountries = new Set<string>();
    const uniqueCities = new Set<string>();
    const byCont: Record<string, { countries: Set<string>; cities: Set<string> }> = {};

    reviews.forEach((r: any) => {
      const place = r.places;
      const continent = getContinentForCountry(place.country);
      if (!byCont[continent]) byCont[continent] = { countries: new Set(), cities: new Set() };

      if (place.type === "country") {
        uniqueCountries.add(place.name);
        byCont[continent]?.countries.add(place.name);
      } else {
        uniqueCities.add(place.name);
        byCont[continent]?.cities.add(place.name);
      }
    });

    const byContNum: Record<string, { countries: number; cities: number }> = {};
    Object.entries(byCont).forEach(([k, v]) => {
      byContNum[k] = { countries: v.countries.size, cities: v.cities.size };
    });

    setProgress({ countriesVisited: uniqueCountries.size, citiesVisited: uniqueCities.size, byContinent: byContNum });
  }, [userId, currentYear]);

  useEffect(() => { fetchGoals(); fetchProgress(); }, [fetchGoals, fetchProgress]);

  const handleSaveGoals = async () => {
    if (!user) return;
    for (const [continent, vals] of Object.entries(editGoals)) {
      if (vals.countries === 0 && vals.cities === 0) continue;
      await supabase.from("yearly_goals").upsert({
        user_id: user.id, year: currentYear, continent,
        country_goal: vals.countries, city_goal: vals.cities,
      }, { onConflict: "user_id,year,continent" });
    }
    setEditing(false);
    fetchGoals();
    toast.success(t("save"));
  };

  const startEditing = () => {
    const map: Record<string, { countries: number; cities: number }> = {};
    CONTINENTS.forEach(c => {
      const existing = goals.find(g => g.continent === c);
      map[c] = { countries: existing?.country_goal || 0, cities: existing?.city_goal || 0 };
    });
    setEditGoals(map);
    setEditing(true);
  };

  const handleSearchPlace = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("places").select("id, name, country, type").ilike("name", `%${q}%`).limit(10);
    setSearchResults(data || []);
  };

  const addGoalPlace = async (placeId: string) => {
    if (!user) return;
    const existing = goalPlaces.find(p => p.place_id === placeId);
    if (existing) { toast.error("Already added"); return; }
    await supabase.from("yearly_goal_places").insert({ user_id: user.id, year: currentYear, place_id: placeId });
    setSearchQuery("");
    setSearchResults([]);
    fetchGoals();
  };

  const removeGoalPlace = async (id: string) => {
    await supabase.from("yearly_goal_places").delete().eq("id", id);
    fetchGoals();
  };

  const toggleCompleted = async (id: string, current: boolean) => {
    await supabase.from("yearly_goal_places").update({ completed: !current }).eq("id", id);
    fetchGoals();
  };

  const totalGoal = goals.find(g => g.continent === "total");
  const totalCountryGoal = totalGoal?.country_goal || 0;
  const totalCityGoal = totalGoal?.city_goal || 0;
  const countryPct = totalCountryGoal > 0 ? Math.min(100, Math.round((progress.countriesVisited / totalCountryGoal) * 100)) : 0;
  const cityPct = totalCityGoal > 0 ? Math.min(100, Math.round((progress.citiesVisited / totalCityGoal) * 100)) : 0;

  const goalCountries = goalPlaces.filter(p => p.place?.type === "country");
  const goalCities = goalPlaces.filter(p => p.place?.type === "city");

  const labels = {
    yearlyGoals: { en: "Yearly Goals", fr: "Objectifs annuels", es: "Objetivos anuales", it: "Obiettivi annuali", pt: "Metas anuais", nl: "Jaardoelen" },
    countries: { en: "Countries", fr: "Pays", es: "Países", it: "Paesi", pt: "Países", nl: "Landen" },
    cities: { en: "Cities", fr: "Villes", es: "Ciudades", it: "Città", pt: "Cidades", nl: "Steden" },
    setGoals: { en: "Set Goals", fr: "Définir", es: "Definir", it: "Imposta", pt: "Definir", nl: "Instellen" },
    editGoals: { en: "Edit Goals", fr: "Modifier", es: "Editar", it: "Modifica", pt: "Editar", nl: "Bewerken" },
    noGoals: { en: "No goals set for this year yet.", fr: "Aucun objectif défini pour cette année.", es: "Sin objetivos este año.", it: "Nessun obiettivo per quest'anno.", pt: "Sem metas este ano.", nl: "Nog geen doelen voor dit jaar." },
    mustVisit: { en: "Must-Visit List", fr: "Liste incontournable", es: "Lista imprescindible", it: "Lista imperdibile", pt: "Lista obrigatória", nl: "Must-visit lijst" },
    addPlace: { en: "Search destinations to add...", fr: "Rechercher des destinations...", es: "Buscar destinos...", it: "Cerca destinazioni...", pt: "Pesquisar destinos...", nl: "Zoek bestemmingen..." },
    byContinent: { en: "By Continent", fr: "Par continent", es: "Por continente", it: "Per continente", pt: "Por continente", nl: "Per continent" },
    visited: { en: "visited", fr: "visité(s)", es: "visitados", it: "visitati", pt: "visitados", nl: "bezocht" },
    overall: { en: "Overall Progress", fr: "Progression globale", es: "Progreso global", it: "Progresso globale", pt: "Progresso global", nl: "Algemene voortgang" },
  };
  const l = (key: keyof typeof labels) => labels[key][language] || labels[key].en;

  const hasAnyGoal = goals.some(g => g.country_goal > 0 || g.city_goal > 0) || goalPlaces.length > 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          {l("yearlyGoals")} {currentYear}
        </h2>
        {isOwn && (
          <Button size="sm" variant="outline" onClick={editing ? handleSaveGoals : startEditing}>
            {editing ? <Check className="w-4 h-4 mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
            {editing ? t("save") : (hasAnyGoal ? l("editGoals") : l("setGoals"))}
          </Button>
        )}
      </div>

      {/* Editing mode */}
      {editing && (
        <div className="space-y-4 rounded-xl border border-border p-4 bg-card">
          {CONTINENTS.map(continent => (
            <div key={continent} className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {CONTINENT_LABELS[continent]?.[language] || continent}
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">{l("countries")}</label>
                  <Input
                    type="number" min={0} max={200}
                    value={editGoals[continent]?.countries || 0}
                    onChange={e => setEditGoals(prev => ({ ...prev, [continent]: { ...prev[continent], countries: parseInt(e.target.value) || 0 } }))}
                    className="h-8"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">{l("cities")}</label>
                  <Input
                    type="number" min={0} max={500}
                    value={editGoals[continent]?.cities || 0}
                    onChange={e => setEditGoals(prev => ({ ...prev, [continent]: { ...prev[continent], cities: parseInt(e.target.value) || 0 } }))}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No goals state */}
      {!hasAnyGoal && !editing && (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{l("noGoals")}</p>
        </div>
      )}

      {/* Overall progress */}
      {hasAnyGoal && !editing && (
        <>
          <div className="rounded-xl border border-border p-4 bg-card space-y-4">
            <h3 className="font-semibold text-sm">{l("overall")}</h3>
            {totalCountryGoal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {l("countries")}</span>
                  <span className="font-mono">{progress.countriesVisited}/{totalCountryGoal}</span>
                </div>
                <Progress value={countryPct} className="h-3" />
                <p className="text-xs text-muted-foreground text-right">{countryPct}%</p>
              </div>
            )}
            {totalCityGoal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {l("cities")}</span>
                  <span className="font-mono">{progress.citiesVisited}/{totalCityGoal}</span>
                </div>
                <Progress value={cityPct} className="h-3" />
                <p className="text-xs text-muted-foreground text-right">{cityPct}%</p>
              </div>
            )}
          </div>

          {/* By continent */}
          {goals.filter(g => g.continent !== "total" && (g.country_goal > 0 || g.city_goal > 0)).length > 0 && (
            <div className="rounded-xl border border-border p-4 bg-card space-y-3">
              <h3 className="font-semibold text-sm">{l("byContinent")}</h3>
              {goals.filter(g => g.continent !== "total" && (g.country_goal > 0 || g.city_goal > 0)).map(g => {
                const contProgress = progress.byContinent[g.continent] || { countries: 0, cities: 0 };
                const cPct = g.country_goal > 0 ? Math.min(100, Math.round((contProgress.countries / g.country_goal) * 100)) : 0;
                const ciPct = g.city_goal > 0 ? Math.min(100, Math.round((contProgress.cities / g.city_goal) * 100)) : 0;
                return (
                  <div key={g.continent} className="space-y-2 pb-2 border-b border-border last:border-0">
                    <p className="text-xs font-medium">{CONTINENT_LABELS[g.continent]?.[language] || g.continent}</p>
                    {g.country_goal > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{l("countries")}</span>
                          <span>{contProgress.countries}/{g.country_goal}</span>
                        </div>
                        <Progress value={cPct} className="h-2" />
                      </div>
                    )}
                    {g.city_goal > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{l("cities")}</span>
                          <span>{contProgress.cities}/{g.city_goal}</span>
                        </div>
                        <Progress value={ciPct} className="h-2" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Must-visit places */}
          <div className="rounded-xl border border-border p-4 bg-card space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {l("mustVisit")}
            </h3>

            {isOwn && (
              <div className="relative">
                <Input
                  placeholder={l("addPlace")}
                  value={searchQuery}
                  onChange={e => handleSearchPlace(e.target.value)}
                  className="h-9"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(place => (
                      <button
                        key={place.id}
                        onClick={() => addGoalPlace(place.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                      >
                        {place.type === "country" ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        <span>{place.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{place.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Countries */}
            {goalCountries.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{l("countries")}</p>
                <div className="space-y-1">
                  {goalCountries.map(gp => (
                    <div key={gp.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                      {isOwn && (
                        <button onClick={() => toggleCompleted(gp.id, gp.completed)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${gp.completed ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {gp.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                        </button>
                      )}
                      {!isOwn && gp.completed && <Check className="w-4 h-4 text-primary" />}
                      <span className={`text-sm flex-1 cursor-pointer ${gp.completed ? "line-through text-muted-foreground" : ""}`}
                        onClick={() => navigate(`/place/${gp.place_id}`)}>
                        {gp.place?.name}
                      </span>
                      {isOwn && (
                        <button onClick={() => removeGoalPlace(gp.id)} className="opacity-0 group-hover:opacity-100">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cities */}
            {goalCities.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{l("cities")}</p>
                <div className="space-y-1">
                  {goalCities.map(gp => (
                    <div key={gp.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                      {isOwn && (
                        <button onClick={() => toggleCompleted(gp.id, gp.completed)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${gp.completed ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {gp.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                        </button>
                      )}
                      {!isOwn && gp.completed && <Check className="w-4 h-4 text-primary" />}
                      <span className={`text-sm flex-1 cursor-pointer ${gp.completed ? "line-through text-muted-foreground" : ""}`}
                        onClick={() => navigate(`/place/${gp.place_id}`)}>
                        {gp.place?.name}
                        <span className="text-muted-foreground text-xs ml-1">({gp.place?.country})</span>
                      </span>
                      {isOwn && (
                        <button onClick={() => removeGoalPlace(gp.id)} className="opacity-0 group-hover:opacity-100">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {goalPlaces.length === 0 && !isOwn && (
              <p className="text-sm text-muted-foreground text-center py-4">—</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
