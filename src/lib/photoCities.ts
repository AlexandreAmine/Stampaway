/**
 * Names the places in a photo scan: each ~10 km group of photos is looked
 * up once with Apple's geocoder (only its coordinates are sent) and matched
 * to the app's cities. Answers are kept on the phone, so looking again later
 * only asks about new places.
 */
import { createPersistentCache } from "@/lib/persistentCache";
import { normalizeSearchText } from "@/lib/placeSearch";
import { getCountryCode } from "@/lib/countryFlags";
import type { PhotoCluster } from "@/lib/photoTrips";

export interface PlaceNames {
  /** Most specific first: city, then county, then region. */
  names: string[];
  countryCode: string;
}

export type ReverseGeocode = (point: { lat: number; lng: number }) => Promise<{
  found: boolean;
  names?: string[];
  countryCode?: string;
  retry?: boolean;
}>;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const lookups = createPersistentCache<PlaceNames | "none">("photo_city_lookups", { maxEntries: 5000, ttlMs: YEAR_MS });

// Apple limits how many lookups an app makes in a short time; when it says
// "later", wait longer each time. After the last wait, stop and show what
// was found (the rest is looked up on a later scan).
export const RETRY_WAITS_MS = [5_000, 15_000, 30_000, 60_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface LookupOptions {
  reverseGeocode: ReverseGeocode;
  /**
   * Called as each place is named (in any order), with how many are done,
   * that place's names (null: none) and the place itself.
   */
  onProgress?: (done: number, named: PlaceNames | null, cluster: PhotoCluster) => void;
  /** Checked between lookups: true stops early with what was found. */
  shouldStop?: () => boolean;
  wait?: (ms: number) => Promise<unknown>;
  /** Lookups in flight at once (Apple's limit is per minute, not per request). */
  concurrency?: number;
}

export const LOOKUP_CONCURRENCY = 3;

/**
 * Names for each group (by key), asking only about groups not looked up
 * before: remembered answers come back at once, then the rest are looked
 * up a few at a time, in the order given. `complete` is false when it
 * stopped early (asked to, or the geocoder stayed unavailable).
 */
export async function nameClusters(
  clusters: PhotoCluster[],
  { reverseGeocode, onProgress, shouldStop, wait = sleep, concurrency = LOOKUP_CONCURRENCY }: LookupOptions
): Promise<{ names: Map<string, PlaceNames>; complete: boolean }> {
  const names = new Map<string, PlaceNames>();
  let done = 0;
  const report = (cluster: PhotoCluster) => {
    done++;
    onProgress?.(done, names.get(cluster.key) ?? null, cluster);
  };

  const toAsk: PhotoCluster[] = [];
  for (const cluster of clusters) {
    const cached = lookups.get(cluster.key);
    if (cached === undefined) {
      toAsk.push(cluster);
      continue;
    }
    if (cached !== "none") names.set(cluster.key, cached);
    report(cluster);
  }

  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (!stopped && next < toAsk.length) {
      if (shouldStop?.()) {
        stopped = true;
        return;
      }
      const cluster = toAsk[next++];
      const answer = await lookUp(cluster, reverseGeocode, wait, () => stopped || !!shouldStop?.());
      if (answer === "unavailable") {
        stopped = true;
        return;
      }
      lookups.set(cluster.key, answer);
      if (answer !== "none") names.set(cluster.key, answer);
      report(cluster);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { names, complete: !stopped && done === clusters.length };
}

async function lookUp(
  cluster: PhotoCluster,
  reverseGeocode: ReverseGeocode,
  wait: (ms: number) => Promise<unknown>,
  shouldStop?: () => boolean
): Promise<PlaceNames | "none" | "unavailable"> {
  for (let attempt = 0; ; attempt++) {
    let result: Awaited<ReturnType<ReverseGeocode>>;
    try {
      result = await reverseGeocode({ lat: cluster.lat, lng: cluster.lng });
    } catch {
      result = { found: false, retry: true };
    }
    if (result.found && result.names?.length && result.countryCode) {
      return { names: result.names, countryCode: result.countryCode };
    }
    if (!result.retry) return "none";
    if (attempt >= RETRY_WAITS_MS.length || shouldStop?.()) return "unavailable";
    await wait(RETRY_WAITS_MS[attempt]);
  }
}

export interface CatalogCity {
  id: string;
  name: string;
  country: string;
}

/**
 * Finds the app's city for looked-up names: same country, and the city's
 * name equal to the first of the names that matches (accents and case
 * ignored). Null when the app has no such city.
 */
export function makeCityMatcher(catalog: CatalogCity[]): (place: PlaceNames) => CatalogCity | null {
  const byCountry = new Map<string, Map<string, CatalogCity>>();
  for (const city of catalog) {
    const code = getCountryCode(city.country);
    if (!code) continue;
    const cities = byCountry.get(code) ?? new Map<string, CatalogCity>();
    const key = normalizeSearchText(city.name);
    if (!cities.has(key)) cities.set(key, city);
    byCountry.set(code, cities);
  }
  return (place) => {
    const cities = byCountry.get(place.countryCode.toUpperCase());
    if (!cities) return null;
    for (const name of place.names) {
      const city = cities.get(normalizeSearchText(name));
      if (city) return city;
    }
    return null;
  };
}

/** Distance in km between two points. */
function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Photos this close to the centre of a city the app already knows the
// position of are in that city: no lookup needed.
export const NEARBY_CITY_KM = 8;

/**
 * Names groups of photos without asking anyone, when they're within a few
 * km of the centre of one of the app's cities in the same country whose
 * position is already on the phone (big cities, and cities shown on maps).
 */
export function makeNearbyCityFinder(
  catalog: CatalogCity[],
  positionOf: (name: string, country: string) => [number, number] | null
): (cluster: PhotoCluster) => CatalogCity | null {
  const known: { city: CatalogCity; code: string; at: [number, number] }[] = [];
  for (const city of catalog) {
    const code = getCountryCode(city.country);
    const at = code ? positionOf(city.name, city.country) : null;
    if (code && at) known.push({ city, code, at });
  }
  return (cluster) => {
    let best: CatalogCity | null = null;
    let bestKm = NEARBY_CITY_KM;
    for (const k of known) {
      if (k.code !== cluster.alpha2) continue;
      const km = distanceKm(k.at, [cluster.lat, cluster.lng]);
      if (km <= bestKm) {
        best = k.city;
        bestKm = km;
      }
    }
    return best;
  };
}
