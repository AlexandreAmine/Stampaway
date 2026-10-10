import { registerPlugin } from "@capacitor/core";
import { isIOS, isNative } from "@/lib/native/platform";

interface PlaceGeocoderPlugin {
  /** found: lat/lng are set. Not found: retry says whether asking again later may work. */
  geocode(options: { query: string; countryCode?: string }): Promise<{ found: boolean; lat?: number; lng?: number; retry?: boolean }>;
  /** The place names around a point, most specific first (city, county, region), in English. */
  reverseGeocode(options: { lat: number; lng: number }): Promise<{ found: boolean; names?: string[]; countryCode?: string; retry?: boolean }>;
}

/** Native plugin in native/photo-trips (iOS only): Apple's geocoder. */
export const PlaceGeocoder = registerPlugin<PlaceGeocoderPlugin>("PlaceGeocoder");

export const canGeocodePlaces = (): boolean => isNative() && isIOS();
