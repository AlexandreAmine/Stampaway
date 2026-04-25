import { useCallback } from "react";
import {
  Camera,
  CameraResultType,
  CameraSource,
  Contacts,
  Geolocation,
  Haptics,
  ImpactStyle,
  PushNotifications,
  Share,
  isNative,
} from "@/lib/native";

/**
 * Convenience hook around the Capacitor plugins Stampaway uses.
 *
 * Every method is safe to call on web — they either no-op or return a
 * `{ ok: false }` result so feature code never has to branch on platform.
 *
 * Permission prompts only fire on native devices. We do NOT trigger any
 * permission flows on app start; each helper requests its own permission
 * the first time it is called by a real user action.
 */
export function useNativeFeatures() {
  /** Request notification permission and register for push tokens. */
  const enablePushNotifications = useCallback(async (): Promise<{
    ok: boolean;
    reason?: string;
  }> => {
    if (!isNative()) return { ok: false, reason: "web" };
    try {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return { ok: false, reason: "denied" };
      await PushNotifications.register();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }, []);

  /** Get current GPS coordinates. */
  const getCurrentLocation = useCallback(async () => {
    if (!isNative()) {
      // Browser fallback — uses the standard web geolocation API.
      return new Promise<{ ok: boolean; coords?: { lat: number; lng: number } }>(
        (resolve) => {
          if (!navigator.geolocation) return resolve({ ok: false });
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                ok: true,
                coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              }),
            () => resolve({ ok: false }),
            { enableHighAccuracy: true, timeout: 10_000 }
          );
        }
      );
    }
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });
      return {
        ok: true,
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      };
    } catch {
      return { ok: false };
    }
  }, []);

  /** Open the system contact picker — used for friend suggestions. */
  const pickContacts = useCallback(async () => {
    if (!isNative()) return { ok: false, contacts: [] as unknown[] };
    try {
      const perm = await Contacts.requestPermissions();
      if (perm.contacts !== "granted") return { ok: false, contacts: [] };
      const result = await Contacts.getContacts({
        projection: { name: true, phones: true, emails: true },
      });
      return { ok: true, contacts: result.contacts };
    } catch {
      return { ok: false, contacts: [] };
    }
  }, []);

  /** Native share sheet (with a web `navigator.share` fallback). */
  const share = useCallback(
    async (opts: { title?: string; text?: string; url?: string }) => {
      if (isNative()) {
        try {
          await Share.share(opts);
          return { ok: true };
        } catch {
          return { ok: false };
        }
      }
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await (navigator as Navigator).share(opts);
          return { ok: true };
        } catch {
          return { ok: false };
        }
      }
      // Last resort: copy URL.
      if (opts.url && navigator.clipboard) {
        await navigator.clipboard.writeText(opts.url);
        return { ok: true, copied: true };
      }
      return { ok: false };
    },
    []
  );

  /** Take a photo via the native camera (used for profile pics later). */
  const takePhoto = useCallback(async () => {
    if (!isNative()) return { ok: false, dataUrl: undefined };
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });
      return { ok: true, dataUrl: photo.dataUrl };
    } catch {
      return { ok: false };
    }
  }, []);

  /** Light haptic tap — safe no-op on web. */
  const tap = useCallback(async () => {
    if (!isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      /* ignore */
    }
  }, []);

  return {
    enablePushNotifications,
    getCurrentLocation,
    pickContacts,
    share,
    takePhoto,
    tap,
    isNative: isNative(),
  };
}
