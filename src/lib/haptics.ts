import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "@/lib/native/platform";

/**
 * Fire-and-forget haptic helpers. No-ops on web; never throw.
 *
 * One rule per kind of moment (matching iOS):
 * - selection → each step of a value being picked: every half-star while
 *               dragging a rating, switching Countries/Cities or the map
 *               mode, picking a sort option
 * - light     → small toggles the user directly caused: like, bookmark /
 *               wishlist, the heart on the rating page, follow / unfollow,
 *               the pull-to-refresh point where letting go refreshes
 * - medium    → accepting a follow request; dropping a reordered item
 * - success   → something was saved or sent: review, diary entry, new list,
 *               profile, report
 * - error     → a save or action failed (always alongside the error message)
 * - none      → tab bar, back, navigating, opening sheets, scrolling, typing
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

export function hapticError() {
  if (!isNative()) return;
  Haptics.notification({ type: NotificationType.Error }).catch(() => {});
}

// iOS only plays selection ticks from a generator prepared by
// selectionStart(); prepare it once and keep it.
let selectionReady: Promise<void> | null = null;

export function hapticSelection() {
  if (!isNative()) return;
  if (!selectionReady) selectionReady = Haptics.selectionStart().catch(() => {});
  selectionReady.then(() => Haptics.selectionChanged()).catch(() => {});
}
