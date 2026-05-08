import { isNative } from "./platform";

/**
 * Capgo OTA live updates bootstrap.
 *
 * Call once on app startup. On native builds it tells Capgo the freshly
 * loaded bundle booted successfully — without this, Capgo auto-rolls back
 * to the previous version after a few seconds.
 *
 * No-op on web (Lovable preview, published web app).
 */
export async function initLiveUpdates(): Promise<void> {
  if (!isNative()) return;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch (err) {
    // Plugin may not be linked yet on first sync — fail silently.
    console.warn("[LiveUpdates] notifyAppReady skipped:", err);
  }
}
