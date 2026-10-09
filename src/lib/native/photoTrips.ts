import { registerPlugin } from "@capacitor/core";
import { isIOS, isNative } from "@/lib/native/platform";
import type { PhotoCell } from "@/lib/photoTrips";

export type PhotoAccess = "granted" | "limited" | "prompt" | "denied";

interface PhotoTripsPlugin {
  checkAccess(): Promise<{ access: PhotoAccess }>;
  requestAccess(): Promise<{ access: PhotoAccess }>;
  /** Where and when photos were taken, grouped by ~1 km cell and day. Never the photos. */
  scan(): Promise<{ access: PhotoAccess; total: number; located: number; cells: PhotoCell[] }>;
  openSettings(): Promise<void>;
}

/** Native plugin in native/photo-trips (iOS only). */
export const PhotoTrips = registerPlugin<PhotoTripsPlugin>("PhotoTrips");

/** Finding countries in photos needs the iOS app; nothing on the web. */
export const canFindCountriesInPhotos = (): boolean => isNative() && isIOS();
