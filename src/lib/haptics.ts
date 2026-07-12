import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "@/lib/native/platform";

/**
 * Fire-and-forget haptic helpers. No-ops on web; never throw.
 *
 * Conventions (matching iOS platform feel):
 * - light  → small state toggles the user directly caused (like, bookmark, star)
 * - medium → heavier direct actions (follow, accept request, pull-to-refresh trigger)
 * - success → a multi-step action completed (trip logged, entry saved)
 */
export function hapticLight() {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function hapticMedium() {
  if (!isNative()) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

export function hapticSuccess() {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
