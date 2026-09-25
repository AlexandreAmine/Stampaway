import { Preferences } from "@capacitor/preferences";
import { isNative } from "@/lib/native/platform";

/**
 * First-launch intro, shown before any account exists — so this is a
 * per-device flag, not a per-user one.
 *
 * Stored the same way as the auth session (see nativeAuthStorage): on native
 * the flag lives in Capacitor Preferences, which iOS never evicts, with a
 * localStorage mirror as the fast synchronous check. localStorage alone would
 * be fragile — WKWebView can clear it under storage pressure, which would
 * replay the intro on a device that has already seen it.
 */

const KEY = "stampaway_intro_seen_v1";

function readLocal(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocal() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // The Preferences copy is the durable one on native.
  }
}

/** Fast path — true when this device has definitely seen the intro. */
export function hasSeenIntroSync(): boolean {
  return readLocal();
}

/** Authoritative check, including the Preferences copy on native. */
export async function hasSeenIntro(): Promise<boolean> {
  if (readLocal()) return true;
  if (!isNative()) return false;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value === "1") {
      writeLocal();
      return true;
    }
  } catch {
    // Unreadable storage: treat as unseen, the intro is harmless to repeat.
  }
  return false;
}

export async function markIntroSeen(): Promise<void> {
  writeLocal();
  if (!isNative()) return;
  try {
    await Preferences.set({ key: KEY, value: "1" });
  } catch {
    // The localStorage mirror still suppresses it on the next launch.
  }
}
