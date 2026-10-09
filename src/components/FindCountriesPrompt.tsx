import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RemoveScroll } from "react-remove-scroll";
import { Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { buttonVariants } from "@/components/ui/button";
import { canFindCountriesInPhotos } from "@/lib/native/photoTrips";

// Shown at most once per app launch (this module lives as long as the app).
let shownThisLaunch = false;

// Lets the screen the app opens on appear first.
const SHOW_DELAY_MS = 1200;

// Screens where a pop-up would interrupt something.
const QUIET_PATHS = new Set(["/welcome", "/auth", "/add", "/import-photos"]);

/** Whether the user has logged at least one country. */
async function hasLoggedCountry(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("reviews")
    .select("id, places!inner(type)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("places.type", "country");
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * On opening the app, someone who hasn't logged a single country yet is
 * offered to find them in their photos. Once they've logged one, it's never
 * shown again; "Not now" hides it until the next launch.
 */
export default function FindCountriesPrompt() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Waits for the username step, which new accounts go through first.
  const ready = !!user && !!profile && !profile.needs_username;

  useEffect(() => {
    if (!ready || shownThisLaunch || !canFindCountriesInPhotos() || QUIET_PATHS.has(location.pathname)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      hasLoggedCountry(user!.id)
        .then((logged) => {
          if (cancelled || logged || shownThisLaunch) return;
          shownThisLaunch = true;
          setOpen(true);
        })
        .catch(() => {});
    }, SHOW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, user, location.pathname]);

  if (!open) return null;

  const findCountries = () => {
    setOpen(false);
    navigate("/import-photos");
  };

  return (
    <RemoveScroll>
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-6" data-overlay-open>
        <motion.div
          className="absolute inset-0 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setOpen(false)}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="find-countries-title"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="relative w-full max-w-sm rounded-2xl bg-secondary p-6 text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-background flex items-center justify-center">
            <Globe2 className="w-8 h-8 text-primary" aria-hidden />
          </div>
          <h2 id="find-countries-title" className="section-title mt-5">{t("importPhotos.title")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("importPhotos.promptBody")}</p>
          <button type="button" onClick={findCountries} className={buttonVariants({ className: "mt-6 w-full" })}>
            {t("importPhotos.cta")}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "ghost", className: "mt-1 w-full" })}>
            {t("importPhotos.notNow")}
          </button>
        </motion.div>
      </div>
    </RemoveScroll>
  );
}
