import { registerPlugin } from "@capacitor/core";
import { isIOS, isNative } from "@/lib/native/platform";

interface PlaceGeocoderPlugin {
  /** found: lat/lng are set. Not found: retry says whether asking again later may work. */
  geocode(options: { query: string; countryCode?: string }): Promise<{ found: boolean; lat?: number; lng?: number; retry?: boolean }>;
}

/** Native plugin in native/photo-trips (iOS only): Apple's geocoder. */
export const PlaceGeocoder = registerPlugin<PlaceGeocoderPlugin>("PlaceGeocoder");

export const canGeocodePlaces = (): boolean => isNative() && isIOS();
