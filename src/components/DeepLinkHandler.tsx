import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { isNative } from "@/lib/native/platform";

/**
 * Handles Universal Links (iOS) / App Links (Android).
 *
 * When a user taps a shared profile link like
 *   https://stampaway.lovable.app/profile/<id>
 * and the Stampaway app is installed, iOS/Android open the app and dispatch
 * an `appUrlOpen` event. We strip the origin and navigate inside the SPA so
 * the user lands directly on the in-app profile screen — no browser, no
 * Google search, no extra taps.
 */
export default function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative()) return;

    const sub = CapApp.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (path && path !== "/") navigate(path);
      } catch {
        /* ignore malformed urls */
      }
    });

    return () => {
      sub.then((s) => s.remove());
    };
  }, [navigate]);

  return null;
}
