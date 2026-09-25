import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Network } from "@/lib/native";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Floating "you're offline" pill. Purely informational — it never blocks
 * taps, and the app keeps rendering whatever it had cached.
 */
export default function OfflineBanner() {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;

    Network.getStatus()
      .then((status) => {
        if (!cancelled) setOffline(!status.connected);
      })
      .catch(() => {});

    Network.addListener("networkStatusChange", (status) => {
      setOffline(!status.connected);
    })
      .then((handle) => {
        if (cancelled) handle.remove();
        else remove = () => handle.remove();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          // Sits above the bottom nav rather than at the top, where it
          // covered the page header and the stats row.
          className="fixed left-0 right-0 z-50 pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }}
        >
          <p className="mx-auto w-fit rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background shadow-lg">
            {t("offline.banner")}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
