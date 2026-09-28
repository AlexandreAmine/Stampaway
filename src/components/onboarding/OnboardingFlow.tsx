import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, TrendingUp } from "lucide-react";
import { PlaceCard } from "@/components/PlaceCard";
import { StarRating } from "@/components/StarRating";
import { DestinationPoster } from "@/components/DestinationPoster";
import { WelcomeGlobe } from "@/components/WelcomeGlobe";
import { SoloMapChart, type UserMapData } from "@/components/MapTab";
import { places } from "@/data/mockData";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { subCategoryLabel } from "@/lib/subCategories";
import type { TranslationKey } from "@/i18n/translations";
import avatarElena from "@/assets/avatars/a1.webp";

/**
 * First-launch intro. Each panel is a small preview assembled from the same
 * markup and components as the real screen it describes.
 */

const SCREEN_COUNT = 4;
const FRIENDS_INDEX = 2;
const EASE = [0.32, 0.72, 0, 1] as const;
const SWIPE_THRESHOLD = 60;
const PANEL_PADDING_X = 48;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function PanelCopy({ titleKey, bodyKey }: { titleKey: TranslationKey; bodyKey: TranslationKey }) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="shrink-0"
    >
      <h2 className="font-brand text-[32px] leading-[1.1] font-normal text-foreground tracking-tight">
        {t(titleKey)}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-[19rem]">
        {t(bodyKey)}
      </p>
    </motion.div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full shrink-0 h-full overflow-y-auto scrollbar-hide px-6">
      {/* Top-weighted rather than centred so short panels don't leave a dead
          gap under the progress bars; tall ones still flow and scroll. */}
      <div className="min-h-full flex flex-col justify-start gap-7 pt-[5vh] pb-8">
        {children}
      </div>
    </div>
  );
}

function appear(active: boolean, delay: number, y = 14) {
  return {
    initial: { opacity: 0, y },
    animate: active ? { opacity: 1, y: 0 } : { opacity: 0, y },
    transition: { duration: 0.45, delay, ease: EASE },
  };
}

/* 1 — Been somewhere? Stamp it. Mirrors AddPlacePage's review step. */

const SUB_RATINGS: [string, number][] = [
  ["Affordability", 3.5],
  ["Natural Beauty", 4.5],
  ["Culture & Heritage", 5],
  ["Safety & Security", 4],
  ["Food", 5],
  ["Hospitality & People", 4.5],
  ["Weather", 4],
  ["Entertainment & Nightlife", 4.5],
];

function ScreenRate({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const paris = places[0];
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (!active) {
      setRating(0);
      return;
    }
    if (prefersReducedMotion()) {
      setRating(5);
      return;
    }
    let value = 0;
    const id = window.setInterval(() => {
      value += 0.5;
      setRating(value);
      if (value >= 5) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, [active]);

  return (
    <Panel>
      <PanelCopy titleKey="onboarding.rate.title" bodyKey="onboarding.rate.body" />
      <motion.div
        {...appear(active, 0.08, 18)}
        className="shrink-0 rounded-2xl border border-border bg-[hsl(0,0%,4%)] p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-[60px] rounded-lg overflow-hidden shrink-0">
              <img src={paris.image} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("review.iStamped")}</p>
              <p className="text-lg font-bold text-foreground leading-tight">Paris</p>
              <p className="text-[11px] text-muted-foreground">France</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">{t("save")}</span>
        </div>

        <p className="mt-5 text-sm font-semibold text-foreground mb-2">{t("review.yourRating")}</p>
        <div className="flex items-center justify-between">
          <StarRating rating={rating} size={30} />
          <motion.span
            key={rating >= 5 ? "liked" : "unliked"}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 320 }}
            className="text-xl"
          >
            {rating >= 5 ? "❤️" : "🤍"}
          </motion.span>
        </div>

        <div className="mt-4 space-y-2">
          {SUB_RATINGS.map(([category, value], i) => (
            <motion.div
              key={category}
              {...appear(active, 0.3 + i * 0.05, 6)}
              className="flex items-center justify-between"
            >
              <span className="text-xs text-muted-foreground">{subCategoryLabel(category, t)}</span>
              <StarRating rating={value} size={13} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </Panel>
  );
}

/* 2 — Your travel identity. Mirrors ProfilePage's favourites and map preview. */

const FAVOURITE_CITIES = [
  { id: "onb-paris", name: "Paris", country: "France", image: places[0].image },
  { id: "onb-tokyo", name: "Tokyo", country: "Japan", image: places[2].image },
  { id: "onb-london", name: "London", country: "United Kingdom", image: places[4].image },
  { id: "onb-nyc", name: "New York", country: "United States", image: places[5].image },
];

const VISITED_CODES = [
  "FR", "IT", "ES", "PT", "GB", "DE", "NL", "GR", "CH", "IS", "NO",
  "US", "CA", "MX", "BR", "AR", "PE", "JP", "TH", "VN", "ID", "AU", "MA", "ZA",
];

const PREVIEW_MAP_DATA: UserMapData = {
  visitedCodes: new Set(VISITED_CODES),
  fiveStarCountryCodes: new Set(),
  fiveStarCities: [],
  visitedCountries: new Set(),
  visitedCitiesCount: 0,
  continentStats: {},
  countryPlaceMap: {},
  countryRatings: {},
  ratedCities: [],
};

function ScreenProfile({ active }: { active: boolean }) {
  const { t } = useLanguage();
  return (
    <Panel>
      <PanelCopy titleKey="onboarding.profile.title" bodyKey="onboarding.profile.body" />
      <div className="shrink-0">
        <motion.h3 {...appear(active, 0.06, 8)} className="text-lg font-bold text-foreground mb-3">
          {t("profile.favoriteCities")}
        </motion.h3>
        <div className="grid grid-cols-4 gap-2">
          {FAVOURITE_CITIES.map((city, i) => (
            <motion.div
              key={city.id}
              {...appear(active, 0.1 + i * 0.07, 16)}
              className="w-full aspect-[3/4]"
            >
              <DestinationPoster
                placeId={city.id}
                name={city.name}
                country={city.country}
                type="city"
                image={city.image}
                renderWidth={200}
                className="w-full h-full"
              />
            </motion.div>
          ))}
        </div>

        <motion.div {...appear(active, 0.38, 12)} className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground">{t("profile.map")}</h3>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
          {/* Decorative: the real map pans and zooms, which here would steal
              the horizontal swipe that moves between panels. */}
          <div
            className="pointer-events-none bg-card rounded-xl border border-border overflow-hidden"
            style={{ height: 220 }}
          >
            <SoloMapChart data={PREVIEW_MAP_DATA} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{VISITED_CODES.length}</span> {t("onboarding.ofCountries")}
          </p>
        </motion.div>
      </div>
    </Panel>
  );
}

/* 3 — See where your friends are going. The Welcome globe's friend pins. */

function ScreenFriends({
  active,
  mountGlobe,
  contentWidth,
}: {
  active: boolean;
  mountGlobe: boolean;
  contentWidth: number;
}) {
  const size = Math.max(0, Math.min(contentWidth, 360));
  return (
    <Panel>
      <PanelCopy titleKey="onboarding.friends.title" bodyKey="onboarding.friends.body" />
      <div className="shrink-0 relative flex justify-center">
        {/* The globe is non-interactive already; pointer-events-none keeps the
            canvas from ever absorbing the panel swipe. */}
        <div className="pointer-events-none" style={{ width: size, height: size }}>
          {mountGlobe && size > 0 && <WelcomeGlobe width={size} height={size} />}
        </div>

        {/* Centred by a flex wrapper, not translate-x: framer-motion writes its
            own inline transform for the slide-up, which would override a
            Tailwind translate and push the card off-centre. */}
        <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
          <motion.div
            {...appear(active, 0.5, 18)}
            className="flex items-center gap-3 rounded-full bg-card/90 backdrop-blur-md border border-border py-2 pl-2 pr-4 shadow-lg whitespace-nowrap"
          >
            <img src={avatarElena} alt="" className="w-8 h-8 rounded-full object-cover" />
            <div className="leading-tight">
              <p className="text-xs text-muted-foreground">elena · 2h</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🇯🇵</span>
                <span className="text-sm font-bold text-foreground">Tokyo</span>
                <StarRating rating={5} size={11} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Panel>
  );
}

/* 4 — Where to next? */

function ScreenDiscover({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const trending = [places[3], places[4], places[1]];

  return (
    <Panel>
      <PanelCopy titleKey="onboarding.discover.title" bodyKey="onboarding.discover.body" />
      <div className="shrink-0 space-y-5">
        <div>
          <motion.div {...appear(active, 0.08, 0)} className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t("onboarding.trending")}</span>
          </motion.div>
          {/* Bleeds to the screen edge so the row reads as more content
              rather than a card clipped by the page padding. */}
          <div className="-mx-6 px-6 overflow-hidden">
            <div className="flex gap-3 w-max">
              {trending.map((place, i) => (
                <motion.div key={place.id} {...appear(active, 0.14 + i * 0.09, 20)}>
                  <PlaceCard place={place} variant="small" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          {...appear(active, 0.44, 12)}
          className="bg-card rounded-xl p-4 border border-border space-y-3"
        >
          {[
            { rank: "01", name: "Japan", flag: "🇯🇵", score: 4.9 },
            { rank: "02", name: "Portugal", flag: "🇵🇹", score: 4.8 },
            { rank: "03", name: "Italy", flag: "🇮🇹", score: 4.7 },
          ].map((row) => (
            <div key={row.name} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground tabular-nums w-5">
                {row.rank}
              </span>
              <span className="text-sm">{row.flag}</span>
              <span className="text-sm font-bold text-foreground flex-1 truncate">{row.name}</span>
              <StarRating rating={row.score} size={11} />
              <span className="text-xs font-semibold text-foreground tabular-nums">{row.score}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </Panel>
  );
}

export default function OnboardingFlow({ onFinish }: { onFinish: () => void }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  // Mapbox is heavy, so the globe starts loading one panel early and then
  // stays mounted — backing up to it again never shows a reload.
  const [globeWanted, setGlobeWanted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => setWidth(trackRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (index >= FRIENDS_INDEX - 1) setGlobeWanted(true);
  }, [index]);

  const isLast = index === SCREEN_COUNT - 1;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(SCREEN_COUNT - 1, next));
    if (clamped === index) return;
    hapticLight();
    setIndex(clamped);
  };

  const finish = () => {
    hapticSuccess();
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="safe-top shrink-0">
        <div className="px-6 pt-4 pb-3 flex items-center gap-4">
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: SCREEN_COUNT }).map((_, i) => (
              <div key={i} className="h-[3px] flex-1 rounded-full bg-foreground/15 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-foreground"
                  initial={false}
                  animate={{ width: i <= index ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: EASE }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={finish}
            className="text-sm font-medium text-muted-foreground active:opacity-60 shrink-0"
          >
            {t("onboarding.skip")}
          </button>
        </div>
      </div>

      <div ref={trackRef} className="flex-1 overflow-hidden">
        <motion.div
          className="flex h-full"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_THRESHOLD) goTo(index + 1);
            else if (info.offset.x > SWIPE_THRESHOLD) goTo(index - 1);
          }}
          animate={{ x: -index * width }}
          transition={{ duration: 0.42, ease: EASE }}
        >
          <ScreenRate active={index === 0} />
          <ScreenProfile active={index === 1} />
          <ScreenFriends
            active={index === FRIENDS_INDEX}
            mountGlobe={globeWanted}
            contentWidth={width - PANEL_PADDING_X}
          />
          <ScreenDiscover active={index === 3} />
        </motion.div>
      </div>

      <div className="safe-bottom shrink-0">
        <div className="px-6 pt-3 pb-4">
          <button
            type="button"
            onClick={() => (isLast ? finish() : goTo(index + 1))}
            className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            {isLast ? t("onboarding.start") : t("onboarding.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
