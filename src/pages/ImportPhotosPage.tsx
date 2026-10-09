import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Globe2, ImageOff, Loader2, X } from "lucide-react";
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
import { hapticSuccess } from "@/lib/haptics";
import { PhotoTrips, canFindCountriesInPhotos } from "@/lib/native/photoTrips";
import {
  buildSuggestions,
  detectHomeCountry,
  groupByCountry,
  type CountrySuggestion,
  type CountryVisits,
} from "@/lib/photoTrips";
import { fetchAllPlaces } from "@/lib/placeRankings";
import { emptyReviewDraft, saveReview, type ReviewDraft } from "@/lib/reviewDraft";
import { toastError } from "@/lib/toastError";

interface CountryPlace {
  id: string;
  name: string;
  country: string;
  image: string | null;
}

interface Card extends CountrySuggestion {
  place: CountryPlace;
}

type Phase = "intro" | "denied" | "scanning" | "home" | "cards" | "empty" | "done" | "error";

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

export default function ImportPhotosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, tn, language } = useLanguage();
  const followingLookup = useFollowingLookup();
  const keyboardOpen = useKeyboardOpen();

  const [phase, setPhase] = useState<Phase>("intro");
  const [limited, setLimited] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  // Which way the last card left: 1 = saved (right), -1 = skipped (left).
  const [direction, setDirection] = useState(1);
  const [home, setHome] = useState<Card | null>(null);
  // Everything the scan found, kept so the home-country answer can rebuild the cards.
  const scanRef = useRef<{ visits: Map<string, CountryVisits>; places: Map<string, CountryPlace>; logged: Set<string> } | null>(null);

  const close = () =>
    dismissModal(() => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate("/profile", { replace: true });
    });

  useEffect(() => {
    if (!canFindCountriesInPhotos()) navigate("/profile", { replace: true });
  }, [navigate]);

  const showCards = (homeAlpha2: string | null) => {
    const scan = scanRef.current;
    if (!scan) return;
    const next = buildSuggestions(scan.visits, { home: homeAlpha2, alreadyLogged: scan.logged }).flatMap((s) => {
      const place = scan.places.get(s.alpha2);
      return place ? [{ ...s, place }] : [];
    });
    setCards(next);
    setDrafts(
      Object.fromEntries(
        next.map((card) => [
          card.alpha2,
          {
            ...emptyReviewDraft(),
            visitYear: card.suggestedDate?.year ?? "",
            visitMonth: card.suggestedDate?.month ?? "",
          },
        ])
      )
    );
    setIndex(0);
    setPhase(next.length > 0 ? "cards" : "empty");
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

      // The app's country pages, by country code.
      const places = new Map<string, CountryPlace>();
      for (const p of allPlaces as (CountryPlace & { type: string })[]) {
        if (p.type !== "country") continue;
        const code = getCountryCode(p.name);
        if (code && !places.has(code)) places.set(code, p);
      }

      const visits = groupByCountry(scan.cells, makeCountryLocator(polygons));
      for (const code of [...visits.keys()]) if (!places.has(code)) visits.delete(code);

      const logged = new Set<string>();
      places.forEach((p, code) => {
        if (loggedIds.has(p.id)) logged.add(code);
      });
      scanRef.current = { visits, places, logged };

      const wait = MIN_SCAN_MS - (Date.now() - startedAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      // Where they live is only asked about if it isn't logged already.
      const homeCode = detectHomeCountry([...visits.values()]);
      const homePlace = homeCode && !logged.has(homeCode) ? places.get(homeCode) : undefined;
      if (homeCode && homePlace) {
        setHome({ ...visits.get(homeCode)!, suggestedDate: null, place: homePlace });
        setPhase("home");
      } else {
        showCards(null);
      }
    } catch (error) {
      console.error("Finding countries in photos failed:", error);
      setPhase("error");
    }
  };

  const current = cards[index];
  const advance = (dir: 1 | -1) => {
    setDirection(dir);
    if (index + 1 >= cards.length) setPhase("done");
    else setIndex(index + 1);
  };

  const skip = () => {
    if (saving) return;
    advance(-1);
  };

  const save = async () => {
    if (!user || !current || saving) return;
    setSaving(true);
    const reviewId = await saveReview(user.id, { id: current.place.id, type: "country" }, drafts[current.alpha2]);
    setSaving(false);
    if (reviewId === null) {
      toastError(t("importPhotos.saveFailed"));
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
    <div className="flex items-center justify-between pt-12 pb-4">
      <button
        type="button"
        onClick={close}
        aria-label={t("common.close")}
        className="w-9 h-9 -ml-1 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
      >
        <X className="w-5 h-5 text-foreground" />
      </button>
      {phase === "cards" && (
        <span className="text-sm font-semibold text-muted-foreground">
          {t("importPhotos.progress", { current: String(index + 1), total: String(cards.length) })}
        </span>
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
              key={current.alpha2}
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
                  type="country"
                  image={current.place.image}
                  className="w-full h-full"
                  renderWidth={700}
                  priority
                />
              </motion.div>
              <VisitLine card={current} language={language} />
              <p className="mt-1 mb-6 text-xs text-muted-foreground">{t("importPhotos.swipeHint")}</p>
              <ReviewFormFields
                draft={drafts[current.alpha2]}
                onChange={(update) => setDrafts((prev) => ({ ...prev, [current.alpha2]: update(prev[current.alpha2]) }))}
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
                <Globe2 className="w-10 h-10 text-primary" aria-hidden />
              </div>
              <h1 className="page-title mt-6">{t("importPhotos.title")}</h1>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{t("importPhotos.body")}</p>
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
              body={t("importPhotos.deniedBody")}
              action={{ label: t("importPhotos.openSettings"), onClick: () => void PhotoTrips.openSettings() }}
            />
          )}

          {phase === "scanning" && (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden />
              <p className="mt-5 text-base font-semibold text-foreground">{t("importPhotos.scanning")}</p>
            </>
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
              onSkipIt={() => showCards(home.alpha2)}
              onSuggestIt={() => showCards(null)}
            />
          )}

          {phase === "empty" && (
            <>
              <EmptyState icon={Globe2} title={t("importPhotos.noneTitle")} body={t("importPhotos.noneBody")} />
              <button type="button" onClick={close} className={buttonVariants({ variant: "secondary", className: "w-full max-w-xs" })}>
                {t("importPhotos.done")}
              </button>
            </>
          )}

          {phase === "done" && (
            <>
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <Globe2 className="w-10 h-10 text-primary" aria-hidden />
              </div>
              <h1 className="page-title mt-6">
                {savedCount > 0 ? tn("importPhotos.added", savedCount) : t("importPhotos.addedNone")}
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

          {limited && (phase === "cards" || phase === "home" || phase === "empty") && (
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

function HomeQuestion({ home, onSkipIt, onSuggestIt }: { home: Card; onSkipIt: () => void; onSuggestIt: () => void }) {
  const { t } = useLanguage();
  const name = useLocalizedPlaceName(home.place.name, true);
  return (
    <div className="w-full max-w-xs flex flex-col items-center">
      <div className="w-40">
        <DestinationPoster
          placeId={home.place.id}
          name={home.place.name}
          country={home.place.country}
          type="country"
          image={home.place.image}
          priority
        />
      </div>
      <h1 className="page-title mt-6">{t("importPhotos.homeTitle", { country: name })}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("importPhotos.homeBody")}</p>
      <button type="button" onClick={onSkipIt} className={buttonVariants({ className: "mt-8 w-full" })}>
        {t("importPhotos.homeYes")}
      </button>
      <button type="button" onClick={onSuggestIt} className={buttonVariants({ variant: "secondary", className: "mt-3 w-full" })}>
        {t("importPhotos.homeNo")}
      </button>
    </div>
  );
}
