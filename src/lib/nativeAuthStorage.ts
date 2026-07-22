import { Preferences } from "@capacitor/preferences";
import { isNative } from "@/lib/native/platform";

/**
 * Supabase session storage adapter (auth hardening).
 *
 * iOS can evict WKWebView localStorage under storage pressure, which logged
 * users out at random — the worst possible UX event. On native builds the
 * session now lives in Capacitor Preferences (iOS UserDefaults), which the
 * OS never evicts.
 *
 * Safety properties:
 * - MIGRATION: the first read after this update falls back to the old
 *   localStorage value and copies it into Preferences, so already-signed-in
 *   users stay signed in.
 * - MIRROR: writes also go to localStorage, so rolling this change back
 *   would not log anyone out either.
 * - WEB: browser builds keep using plain localStorage exactly as before.
 *
 * This changes only WHERE the token is stored on-device. Sign-up, sign-in,
 * Apple Sign-In, and all server-side user records (auth.users / profiles —
 * i.e. user counts and analytics) are untouched.
 */
export const nativeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative()) return window.localStorage.getItem(key);

    const { value } = await Preferences.get({ key });
    if (value !== null) return value;

    // One-time migration from the previous localStorage-based session
    const legacy = window.localStorage.getItem(key);
    if (legacy !== null) {
      try {
        await Preferences.set({ key, value: legacy });
      } catch {
        // Migration is best-effort; the legacy value is still returned
      }
    }
    return legacy;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isNative()) {
      window.localStorage.setItem(key, value);
      return;
    }
    await Preferences.set({ key, value });
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Mirror is best-effort only
    }
  },

  async removeItem(key: string): Promise<void> {
    if (!isNative()) {
      window.localStorage.removeItem(key);
      return;
    }
    await Preferences.remove({ key });
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Mirror is best-effort only
    }
  },
};
