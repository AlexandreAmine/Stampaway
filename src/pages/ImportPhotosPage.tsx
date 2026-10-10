import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Building2, Globe2, ImageOff, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { EmptyState } from "@/components/EmptyState";
import { ReviewFormFields, useFollowingLookup } from "@/components/ReviewFormFields";
import { buttonVariants } from "@/components/ui/button";
import { useKeyboardOpen } from "@/hooks/useKeyboardOpen";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";
import { dismissModal } from "@/lib/backTransition";
import { loadCountryShapes, makeCountryLocator } from "@/lib/countryShapes";
import { getCountryCode } from "@/lib/countryFlags";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import type { TranslationKey } from "@/i18n/translations";
import { PhotoTrips, canFindCountriesInPhotos } from "@/lib/native/photoTrips";
import { PlaceGeocoder } from "@/lib/native/placeGeocoder";
import {
  type CitySuggestion,
  buildCitySuggestions,
  buildSuggestions,
  clusterCells,
  detectHome,
  detectHomeCountry,
  groupByCity,
  groupByCountry,
  isLikelyClusterVisit,
  type CityVisits,
  type CountryVisits,
  type PhotoCell,
  type VisitDate,
} from "@/lib/photoTrips";
import { makeCityMatcher, makeNearbyCityFinder, nameClusters, type CatalogCity } from "@/lib/photoCities";
import { cityPosition } from "@/lib/placeCoordinates";
import { fetchAllPlaces } from "@/lib/placeRankings";
import { emptyReviewDraft, saveReview, type ReviewDraft } from "@/lib/reviewDraft";
import { toastError } from "@/lib/toastError";

interface CatalogPlace {
  id: string;
  name: string;
  country: string;
  image: string | null;
}

type Kind = "country" | "city";

/** One suggestion: a country (key: its code) or a city (key: its place id). */
interface Card {
  key: string;
  place: CatalogPlace;
  photos: number;
  days: string[];
  suggestedDate: VisitDate | null;
}

// "waiting": every card seen while cities are still being found.
type Phase = "intro" | "denied" | "scanning" | "naming" | "home" | "cards" | "waiting" | "empty" | "done" | "error";

/** What a scan found, kept so the "where do you live" answer can rebuild the cards. */
type Scan =
  | { kind: "country"; visits: Map<string, CountryVisits>; places: Map<string, CatalogPlace>; logged: Set<string> }
  | { kind: "city"; visits: Map<string, CityVisits>; places: Map<string, CatalogPlace>; logged: Set<string> };


// A swipe on the poster further than this saves (right) or skips (left).
const SWIPE_PX = 110;
// The scanning screen stays at least this long, so it reads as a step
// rather than a flash.
const MIN_SCAN_MS = 900;

/** The user's logged place ids, to leave already-logged countries out. */
async function fetchLoggedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("reviews").select("place_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.place_id));
}

const draftFor = (card: Card): ReviewDraft => ({
  ...emptyReviewDraft(),
  visitYear: card.suggestedDate?.year ?? "",
  visitMonth: card.suggestedDate?.month ?? "",
});

const cityCard = (s: CitySuggestion, places: Map<string, CatalogPlace>): Card[] => {
  const place = places.get(s.placeId);
  return place ? [{ key: s.placeId, place, photos: s.photos, days: s.days, suggestedDate: s.suggestedDate }] : [];
};

export default function ImportPhotosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?type= picks countries or cities; without it (Settings) the user chooses.
  const typeParam = searchParams.get("type");
  const fixedKind: Kind | null = typeParam === "city" || typeParam === "country" ? typeParam : null;
  const [kind, setKind] = useState<Kind>(fixedKind ?? "country");
  const forKind = (country: string, city: string) => (kind === "city" ? city : country);
  const KindIcon = kind === "city" ? Building2 : Globe2;
  const { user } = useAuth();
  const { t, tn, language } = useLanguage();
  const followingLookup = useFollowingLookup();
  const keyboardOpen = useKeyboardOpen();

  const [phase, setPhaseState] = useState<Phase>("intro");
  // The background search reads the phase between renders, so it's kept
  // current the moment it changes.
  const phaseRef = useRef<Phase>("intro");
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };
  const [limited, setLimited] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  // Which way the last card left: 1 = saved (right), -1 = skipped (left).
  const [direction, setDirection] = useState(1);
  const [home, setHome] = useState<Card | null>(null);
  const scanRef = useRef<Scan | null>(null);
  // Naming cities: progress, and how many cities are ready to log. It goes on
  // in the background once the cards are open, adding cities as it finds them.
  const [naming, setNaming] = useState({ done: 0, total: 0, found: 0 });
  const [searching, setSearchingState] = useState(false);
  const searchingRef = useRef(false);
  const setSearching = (value: boolean) => {
    searchingRef.current = value;
    setSearchingState(value);
  };
  const stopNamingRef = useRef(false);
  const homeKeyRef = useRef<string | null>(null);
  // Latest values for the background search's callbacks.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(
    () => () => {
      stopNamingRef.current = true;
    },
    []
  );

  const close = () =>
    dismissModal(() => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate("/profile", { replace: true });
    });

  useEffect(() => {
    if (!canFindCountriesInPhotos()) navigate("/profile", { replace: true });
  }, [navigate]);

  const showCards = (homeKey: string | null) => {
    const scan = scanRef.current;
    if (!scan) return;
    homeKeyRef.current = homeKey;
    const next: Card[] =
      scan.kind === "country"
        ? buildSuggestions(scan.visits, { home: homeKey, alreadyLogged: scan.logged }).flatMap((s) => {
            const place = scan.places.get(s.alpha2);
            return place ? [{ key: s.alpha2, place, photos: s.photos, days: s.days, suggestedDate: s.suggestedDate }] : [];
          })
        : buildCitySuggestions(scan.visits, { home: homeKey, alreadyLogged: scan.logged }).flatMap((s) =>
            cityCard(s, scan.places)
          );
    setCards(next);
    setDrafts(
      Object.fromEntries(
        next.map((card) => [
          card.key,
          draftFor(card),
        ])
      )
    );
    setIndex(0);
    // No city ready yet but the search goes on: wait for the first one.
    setPhase(next.length > 0 ? "cards" : searchingRef.current ? "waiting" : "empty");
  };

  /**
   * Cities found while the cards are open: they join the cards not seen yet
   * (which are re-sorted, most recent first). Returns how many cards are
   * still to come.
   */
  const addFoundCities = (): number => {
    const scan = scanRef.current;
    if (!scan || scan.kind !== "city") return 0;
    const deck = cardsRef.current;
    const seenCount = phaseRef.current === "waiting" ? deck.length : indexRef.current + 1;
    const seen = deck.slice(0, seenCount);
    const seenKeys = new Set(seen.map((card) => card.key));
    const upcoming = buildCitySuggestions(scan.visits, { home: homeKeyRef.current, alreadyLogged: scan.logged })
      .filter((s) => !seenKeys.has(s.placeId))
      .flatMap((s) => cityCard(s, scan.places));
    setCards([...seen, ...upcoming]);
    setDrafts((prev) => ({ ...prev, ...Object.fromEntries(upcoming.map((card) => [card.key, draftFor(card)])) }));
    if (phaseRef.current === "waiting" && upcoming.length > 0) {
      setIndex(seen.length);
      setPhase("cards");
    }
    return upcoming.length;
  };

  /** Asks about where they live first, when the photos make it obvious and it isn't logged. */
  const askHomeOrShowCards = (scan: Scan) => {
    let homeCard: Card | null = null;
    if (scan.kind === "country") {
      const code = detectHomeCountry([...scan.visits.values()]);
      const place = code && !scan.logged.has(code) ? scan.places.get(code) : undefined;
      if (code && place) homeCard = { key: code, place, ...scan.visits.get(code)!, suggestedDate: null };
    } else {
      const homeCity = detectHome([...scan.visits.values()]);
      const place = homeCity && !scan.logged.has(homeCity.placeId) ? scan.places.get(homeCity.placeId) : undefined;
      if (homeCity && place) homeCard = { key: homeCity.placeId, place, photos: homeCity.photos, days: homeCity.days, suggestedDate: null };
    }
    if (homeCard) {
      setHome(homeCard);
      setPhase("home");
    } else {
      showCards(null);
    }
  };

  const start = async () => {
    if (!user) return;
    let { access } = await PhotoTrips.checkAccess();
    if (access === "prompt") access = (await PhotoTrips.requestAccess()).access;
    if (access === "denied" || access === "prompt") {
      setPhase("denied");
      return;
    }
    setLimited(access === "limited");
    setPhase("scanning");

    const startedAt = Date.now();
    try {
      const [scan, polygons, allPlaces, loggedIds] = await Promise.all([
        PhotoTrips.scan(),
        loadCountryShapes(),
        fetchAllPlaces(),
        fetchLoggedPlaceIds(user.id),
      ]);
      const locate = makeCountryLocator(polygons);
      const catalog = allPlaces as (CatalogPlace & { type: string })[];
      let result: Scan;

      if (kind === "country") {
        // The app's country pages, by country code.
        const places = new Map<string, CatalogPlace>();
        for (const p of catalog) {
          if (p.type !== "country") continue;
          const code = getCountryCode(p.name);
          if (code && !places.has(code)) places.set(code, p);
        }
        const visits = groupByCountry(scan.cells, locate);
        for (const code of [...visits.keys()]) if (!places.has(code)) visits.delete(code);
        const logged = new Set<string>();
        places.forEach((p, code) => {
          if (loggedIds.has(p.id)) logged.add(code);
        });
        result = { kind: "country", visits, places, logged };
      } else {
        startFindingCities(scan.cells, locate, catalog, loggedIds);
        return;
      }
      scanRef.current = result;

      const wait = MIN_SCAN_MS - (Date.now() - startedAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      askHomeOrShowCards(result);
    } catch (error) {
      console.error("Finding places in photos failed:", error);
      setPhase("error");
    }
  };

  /**
   * Cities: groups of photos near a city whose position the phone knows are
   * named at once; the rest are looked up a few at a time, the places with
   * the most days first. The cards can open as soon as one city is found,
   * and the search goes on behind them.
   */
  const startFindingCities = (
    cells: PhotoCell[],
    locate: (lat: number, lng: number) => string | null,
    catalog: (CatalogPlace & { type: string })[],
    loggedIds: Set<string>
  ) => {
    const cities = catalog.filter((p) => p.type === "city");
    const places = new Map<string, CatalogPlace>(cities.map((c) => [c.id, c]));
    const matchCity = makeCityMatcher(cities as CatalogCity[]);
    const nearbyCity = makeNearbyCityFinder(cities as CatalogCity[], cityPosition);
    const clusters = clusterCells(cells, locate)
      .filter(isLikelyClusterVisit)
      .sort((a, b) => b.days.length - a.days.length || b.photos - a.photos);

    const cityOfCluster = new Map<string, string | null>();
    const toLookUp = clusters.filter((cluster) => {
      const city = nearbyCity(cluster);
      if (city) cityOfCluster.set(cluster.key, city.id);
      return !city;
    });
    const namedNearby = clusters.length - toLookUp.length;

    const refresh = () => {
      const visits = groupByCity(clusters, (cluster) => cityOfCluster.get(cluster.key) ?? null);
      scanRef.current = { kind: "city", visits, places, logged: loggedIds };
      const found = buildCitySuggestions(visits, { home: null, alreadyLogged: loggedIds }).length;
      setNaming((n) => ({ ...n, found }));
      if (phaseRef.current === "cards" || phaseRef.current === "waiting") addFoundCities();
    };

    const finish = () => {
      if (stopNamingRef.current) return;
      setSearching(false);
      const scan = scanRef.current;
      if (phaseRef.current === "naming" && scan) askHomeOrShowCards(scan);
      else if (phaseRef.current === "waiting" && addFoundCities() === 0) setPhase("done");
    };

    stopNamingRef.current = false;
    setNaming({ done: namedNearby, total: clusters.length, found: 0 });
    refresh();
    setPhase("naming");
    if (toLookUp.length === 0) {
      finish();
      return;
    }
    setSearching(true);
    void nameClusters(toLookUp, {
      reverseGeocode: (point) => PlaceGeocoder.reverseGeocode(point),
      shouldStop: () => stopNamingRef.current,
      onProgress: (done, named, cluster) => {
        if (stopNamingRef.current) return;
        cityOfCluster.set(cluster.key, named ? matchCity(named)?.id ?? null : null);
        setNaming((n) => ({ ...n, done: namedNearby + done }));
        refresh();
      },
    })
      .catch(() => {})
      .then(finish);
  };

  const current = cards[index];
  const advance = (dir: 1 | -1) => {
    setDirection(dir);
    if (index + 1 < cards.length) setIndex(index + 1);
    // Out of cards while cities are still being found: wait for the next.
    else setPhase(searching ? "waiting" : "done");
  };

  const skip = () => {
    if (saving) return;
    advance(-1);
  };

  const save = async () => {
    if (!user || !current || saving) return;
    setSaving(true);
    const reviewId = await saveReview(user.id, { id: current.place.id, type: kind }, drafts[current.key]);
    setSaving(false);
    if (reviewId === null) {
      toastError(t(forKind("importPhotos.saveFailed", "importPhotos.saveFailedCity") as TranslationKey));
      return;
    }
    hapticSuccess();
    setSavedCount((n) => n + 1);
    advance(1);
  };

  const onPosterDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_PX) void save();
    else if (info.offset.x < -SWIPE_PX) skip();
  };

  const header = (
    <div className="flex items-center justify-between pt-header pb-4">
      <button
        type="button"
        onClick={close}
        aria-label={t("common.close")}
        className="w-9 h-9 -ml-1 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
      >
        <X className="w-5 h-5 text-foreground" />
      </button>
      {phase === "cards" && (
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-muted-foreground">
            {t("importPhotos.progress", { current: String(index + 1), total: String(cards.length) })}
          </span>
          {searching && (
            <span className="mt-0.5 text-[11px] text-muted-foreground/80 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              {t("importPhotos.findingCities", { done: String(naming.done), total: String(naming.total) })}
            </span>
          )}
        </div>
      )}
      <span className="w-9" aria-hidden />
    </div>
  );

  if (phase === "cards" && current) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] pb-40">
        <div className="px-5">
          {header}
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={current.key}
              custom={direction}
              initial={{ x: direction * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * 320, opacity: 0, rotate: direction * 4 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={onPosterDragEnd}
                whileDrag={{ scale: 0.98 }}
                className="h-56 touch-pan-y"
              >
                <DestinationPoster
                  placeId={current.place.id}
                  name={current.place.name}
                  country={current.place.country}
                  type={kind}
                  image={current.place.image}
                  className="w-full h-full"
                  renderWidth={700}
                  priority
                />
              </motion.div>
              <VisitLine card={current} language={language} />
              <p className="mt-1 mb-6 text-xs text-muted-foreground">{t("importPhotos.swipeHint")}</p>
              <ReviewFormFields
                draft={drafts[current.key]}
                onChange={(update) => setDrafts((prev) => ({ ...prev, [current.key]: update(prev[current.key]) }))}
                followingLookup={followingLookup}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {!keyboardOpen && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[hsl(0,0%,4%)]/95 border-t border-border safe-bottom">
            <div className="max-w-lg mx-auto flex gap-3 px-5 py-3">
              <button type="button" onClick={skip} disabled={saving} className={buttonVariants({ variant: "secondary", className: "flex-1" })}>
                {t("importPhotos.skip")}
              </button>
              <button type="button" onClick={() => void save()} disabled={saving} className={buttonVariants({ className: "flex-1" })}>
                {saving ? <Loader2 className="animate-spin" /> : t("save")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)]">
      <div className="px-5 flex flex-col min-h-screen">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center text-center pb-24">
          {phase === "intro" && (
            <>
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <KindIcon className="w-10 h-10 text-primary" aria-hidden />
              </div>
              <h1 className="page-title mt-6">{t(forKind("importPhotos.title", "importPhotos.titleCities") as TranslationKey)}</h1>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t(forKind("importPhotos.body", "importPhotos.bodyCities") as TranslationKey)}
              </p>
              {!fixedKind && (
                <div role="radiogroup" className="mt-6 flex gap-2">
                  {(["country", "city"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={kind === option}
                      onClick={() => {
                        if (kind !== option) hapticSelection();
                        setKind(option);
                      }}
                      className={`px-5 h-9 rounded-full text-sm font-semibold transition-colors ${
                        kind === option ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {t(option === "country" ? "profile.countries" : "profile.cities")}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => void start()} className={buttonVariants({ className: "mt-8 w-full max-w-xs" })}>
                {t("importPhotos.start")}
              </button>
              <button type="button" onClick={close} className={buttonVariants({ variant: "ghost", className: "mt-2" })}>
                {t("importPhotos.notNow")}
              </button>
            </>
          )}

          {phase === "denied" && (
            <EmptyState
              icon={ImageOff}
              title={t("importPhotos.deniedTitle")}
              body={t(forKind("importPhotos.deniedBody", "importPhotos.deniedBodyCities") as TranslationKey)}
              action={{ label: t("importPhotos.openSettings"), onClick: () => void PhotoTrips.openSettings() }}
            />
          )}

          {phase === "scanning" && (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden />
              <p className="mt-5 text-base font-semibold text-foreground">{t("importPhotos.scanning")}</p>
            </>
          )}

          {(phase === "naming" || phase === "waiting") && (
            <div className="w-full max-w-xs flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden />
              <p className="mt-5 text-base font-semibold text-foreground">
                {t("importPhotos.findingCities", { done: String(naming.done), total: String(naming.total) })}
              </p>
              <div
                className="mt-4 h-1.5 w-full rounded-full bg-secondary overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={naming.total}
                aria-valuenow={naming.done}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${naming.total ? (naming.done / naming.total) * 100 : 0}%` }}
                />
              </div>
              {/* Opens the cards right away; the search goes on behind them. */}
              {phase === "naming" && naming.found > 0 && (
                <button
                  type="button"
                  onClick={() => scanRef.current && askHomeOrShowCards(scanRef.current)}
                  className={buttonVariants({ className: "mt-8 w-full" })}
                >
                  {tn("importPhotos.showFound", naming.found)}
                </button>
              )}
              {phase === "waiting" && (
                <button
                  type="button"
                  onClick={() => {
                    stopNamingRef.current = true;
                    setSearching(false);
                    setPhase("done");
                  }}
                  className={buttonVariants({ variant: "secondary", className: "mt-8 w-full" })}
                >
                  {t("importPhotos.done")}
                </button>
              )}
            </div>
          )}

          {phase === "error" && (
            <EmptyState
              icon={ImageOff}
              title={t("importPhotos.failed")}
              action={{ label: t("importPhotos.start"), onClick: () => void start() }}
            />
          )}

          {phase === "home" && home && (
            <HomeQuestion
              home={home}
              kind={kind}
              onSkipIt={() => showCards(home.key)}
              onSuggestIt={() => showCards(null)}
            />
          )}

          {phase === "empty" && (
            <>
              <EmptyState
                icon={KindIcon}
                title={t(forKind("importPhotos.noneTitle", "importPhotos.noneTitleCities") as TranslationKey)}
                body={t(forKind("importPhotos.noneBody", "importPhotos.noneBodyCities") as TranslationKey)}
              />
              <button type="button" onClick={close} className={buttonVariants({ variant: "secondary", className: "w-full max-w-xs" })}>
                {t("importPhotos.done")}
              </button>
            </>
          )}

          {phase === "done" && (
            <>
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <KindIcon className="w-10 h-10 text-primary" aria-hidden />
              </div>
              <h1 className="page-title mt-6">
                {savedCount > 0
                  ? tn(kind === "city" ? "importPhotos.addedCities" : "importPhotos.added", savedCount)
                  : t(forKind("importPhotos.addedNone", "importPhotos.addedNoneCities") as TranslationKey)}
              </h1>
              {savedCount > 0 && <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t("importPhotos.doneBody")}</p>}
              {savedCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/profile", { replace: true })}
                  className={buttonVariants({ className: "mt-8 w-full max-w-xs" })}
                >
                  {t("importPhotos.seeProfile")}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className={buttonVariants({ variant: savedCount > 0 ? "ghost" : "secondary", className: savedCount > 0 ? "mt-2" : "mt-8 w-full max-w-xs" })}
              >
                {t("importPhotos.done")}
              </button>
            </>
          )}

          {limited && (phase === "cards" || phase === "naming" || phase === "home" || phase === "empty") && (
            <p className="mt-6 max-w-xs text-xs text-muted-foreground">{t("importPhotos.limited")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** "In your photos · May 2023", or "· several trips, 2019–2024". Never the photos themselves. */
function VisitLine({ card, language }: { card: Card; language: string }) {
  const { t } = useLanguage();
  const text = useMemo(() => {
    if (card.suggestedDate) {
      const date = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(
        new Date(card.suggestedDate.year, card.suggestedDate.month - 1, 1)
      );
      return t("importPhotos.oneTrip", { date });
    }
    const first = card.days[0]?.slice(0, 4) ?? "";
    const last = card.days[card.days.length - 1]?.slice(0, 4) ?? "";
    return t("importPhotos.severalTrips", { years: first === last ? first : `${first}–${last}` });
  }, [card, language, t]);
  return <p className="mt-4 text-sm font-medium text-foreground">{text}</p>;
}

function HomeQuestion({ home, kind, onSkipIt, onSuggestIt }: { home: Card; kind: Kind; onSkipIt: () => void; onSuggestIt: () => void }) {
  const { t } = useLanguage();
  const name = useLocalizedPlaceName(home.place.name, kind === "country");
  return (
    <div className="w-full max-w-xs flex flex-col items-center">
      <div className="w-40">
        <DestinationPoster
          placeId={home.place.id}
          name={home.place.name}
          country={home.place.country}
          type={kind}
          image={home.place.image}
          priority
        />
      </div>
      <h1 className="page-title mt-6">
        {kind === "city" ? t("importPhotos.homeTitleCity", { city: name }) : t("importPhotos.homeTitle", { country: name })}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t(kind === "city" ? "importPhotos.homeBodyCity" : "importPhotos.homeBody")}
      </p>
      <button type="button" onClick={onSkipIt} className={buttonVariants({ className: "mt-8 w-full" })}>
        {t("importPhotos.homeYes")}
      </button>
      <button type="button" onClick={onSuggestIt} className={buttonVariants({ variant: "secondary", className: "mt-3 w-full" })}>
        {t("importPhotos.homeNo")}
      </button>
    </div>
  );
}
