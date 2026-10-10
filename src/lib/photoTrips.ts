/**
 * Turns "where and when photos were taken" into country visits to suggest.
 * Pure functions: the native plugin supplies the cells, countryShapes the
 * point → country lookup.
 */

/** Photos grouped by ~11 km cell and local day (from the PhotoTrips plugin). */
export interface PhotoCell {
  lat: number;
  lng: number;
  /** YYYY-MM-DD */
  day: string;
  count: number;
}

export interface CountryVisits {
  alpha2: string;
  photos: number;
  /** Distinct days with photos there, sorted. */
  days: string[];
}

export interface VisitDate {
  year: number;
  month: number;
}

/** Groups photo cells by the country they fall in. */
export function groupByCountry(
  cells: PhotoCell[],
  locate: (lat: number, lng: number) => string | null
): Map<string, CountryVisits> {
  const byCountry = new Map<string, { photos: number; days: Set<string> }>();
  for (const cell of cells) {
    const alpha2 = locate(cell.lat, cell.lng);
    if (!alpha2) continue;
    const entry = byCountry.get(alpha2) ?? { photos: 0, days: new Set<string>() };
    entry.photos += cell.count;
    entry.days.add(cell.day);
    byCountry.set(alpha2, entry);
  }
  const result = new Map<string, CountryVisits>();
  byCountry.forEach((entry, alpha2) => {
    result.set(alpha2, { alpha2, photos: entry.photos, days: [...entry.days].sort() });
  });
  return result;
}

const monthKey = (day: string) => day.slice(0, 7);
const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

/**
 * The visit date to pre-fill, when the photos show a single visit: all in one
 * month, or in two months back to back (a trip across a month's end). Then
 * it's the month with the most days of photos (the earlier one on a tie).
 * Photos in months further apart mean several visits: no date is suggested.
 */
export function suggestedVisitDate(days: string[]): VisitDate | null {
  const daysPerMonth = new Map<string, number>();
  for (const day of days) daysPerMonth.set(monthKey(day), (daysPerMonth.get(monthKey(day)) ?? 0) + 1);
  const months = [...daysPerMonth.keys()].sort();
  if (months.length === 0 || months.length > 2) return null;
  if (months.length === 2 && monthIndex(months[1]) - monthIndex(months[0]) !== 1) return null;

  const chosen = months.reduce((best, m) => ((daysPerMonth.get(m) ?? 0) > (daysPerMonth.get(best) ?? 0) ? m : best), months[0]);
  return { year: Number(chosen.slice(0, 4)), month: Number(chosen.slice(5, 7)) };
}

/**
 * Not a trip worth suggesting: a single photo, or two from the same day
 * (a layover, a picture someone sent).
 */
export function isLikelyVisit(visits: CountryVisits): boolean {
  return visits.photos >= 3 || visits.days.length >= 2;
}

/**
 * Where the person probably lives: the country with by far the most days of
 * photos (at least 14 days, and twice as many as any other). Null when no
 * country stands out, in which case nothing is set aside as home.
 */
export function detectHomeCountry(all: CountryVisits[]): string | null {
  return detectHome(all)?.alpha2 ?? null;
}

/** The same rule for any kind of place (also where they live among cities). */
export function detectHome<T extends { days: string[] }>(all: T[]): T | null {
  const sorted = [...all].sort((a, b) => b.days.length - a.days.length);
  const [first, second] = sorted;
  if (!first || first.days.length < 14) return null;
  if (second && first.days.length < second.days.length * 2) return null;
  return first;
}

export interface CountrySuggestion extends CountryVisits {
  /** Pre-filled visit date, or null when the photos show several visits. */
  suggestedDate: VisitDate | null;
}

/**
 * The countries to put on cards: likely visits, minus home and anything
 * already logged, most recent first.
 */
export function buildSuggestions(
  visits: Map<string, CountryVisits>,
  { home, alreadyLogged }: { home: string | null; alreadyLogged: Set<string> }
): CountrySuggestion[] {
  return [...visits.values()]
    .filter((v) => v.alpha2 !== home && !alreadyLogged.has(v.alpha2) && isLikelyVisit(v))
    .sort((a, b) => (b.days[b.days.length - 1] ?? "").localeCompare(a.days[a.days.length - 1] ?? ""))
    .map((v) => ({ ...v, suggestedDate: suggestedVisitDate(v.days) }));
}

// ─── Cities ───

/** Photos within ~10 km of each other in one country: looked up as one place. */
export interface PhotoCluster {
  /** Stable across scans (country + grid square), to remember lookups. */
  key: string;
  alpha2: string;
  /** Where most of its photo days are: looked up to name the city. */
  lat: number;
  lng: number;
  photos: number;
  days: string[];
}

export const CLUSTER_DEG = 0.1;

/**
 * Groups photo cells into ~10 km squares per country. Each square is named
 * by the cell where most of its days were spent, which is where people take
 * photos in a city (its centre), rather than an average that could fall in
 * a suburb.
 */
export function clusterCells(
  cells: PhotoCell[],
  locate: (lat: number, lng: number) => string | null
): PhotoCluster[] {
  const clusters = new Map<
    string,
    { alpha2: string; photos: number; days: Set<string>; spots: Map<string, { lat: number; lng: number; days: Set<string>; photos: number }> }
  >();
  for (const cell of cells) {
    const alpha2 = locate(cell.lat, cell.lng);
    if (!alpha2) continue;
    const key = `${alpha2}|${Math.floor(cell.lat / CLUSTER_DEG)}|${Math.floor(cell.lng / CLUSTER_DEG)}`;
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { alpha2, photos: 0, days: new Set(), spots: new Map() };
      clusters.set(key, cluster);
    }
    cluster.photos += cell.count;
    cluster.days.add(cell.day);
    const spotKey = `${cell.lat},${cell.lng}`;
    const spot = cluster.spots.get(spotKey) ?? { lat: cell.lat, lng: cell.lng, days: new Set<string>(), photos: 0 };
    spot.days.add(cell.day);
    spot.photos += cell.count;
    cluster.spots.set(spotKey, spot);
  }
  return [...clusters].map(([key, c]) => {
    const busiest = [...c.spots.values()].reduce((best, spot) =>
      spot.days.size > best.days.size || (spot.days.size === best.days.size && spot.photos > best.photos) ? spot : best
    );
    return { key, alpha2: c.alpha2, lat: busiest.lat, lng: busiest.lng, photos: c.photos, days: [...c.days].sort() };
  });
}

export interface CityVisits {
  placeId: string;
  photos: number;
  /** Distinct days with photos there, sorted. */
  days: string[];
}

/** Adds up the squares that turned out to be the same city. */
export function groupByCity(clusters: PhotoCluster[], cityOf: (cluster: PhotoCluster) => string | null): Map<string, CityVisits> {
  const byCity = new Map<string, { photos: number; days: Set<string> }>();
  for (const cluster of clusters) {
    const placeId = cityOf(cluster);
    if (!placeId) continue;
    const entry = byCity.get(placeId) ?? { photos: 0, days: new Set<string>() };
    entry.photos += cluster.photos;
    cluster.days.forEach((day) => entry.days.add(day));
    byCity.set(placeId, entry);
  }
  const result = new Map<string, CityVisits>();
  byCity.forEach((entry, placeId) => result.set(placeId, { placeId, photos: entry.photos, days: [...entry.days].sort() }));
  return result;
}

export interface CitySuggestion extends CityVisits {
  suggestedDate: VisitDate | null;
}

/** Cities to put on cards: likely visits, minus home and anything already logged, most recent first. */
export function buildCitySuggestions(
  visits: Map<string, CityVisits>,
  { home, alreadyLogged }: { home: string | null; alreadyLogged: Set<string> }
): CitySuggestion[] {
  return [...visits.values()]
    .filter((v) => v.placeId !== home && !alreadyLogged.has(v.placeId) && (v.photos >= 3 || v.days.length >= 2))
    .sort((a, b) => (b.days[b.days.length - 1] ?? "").localeCompare(a.days[a.days.length - 1] ?? ""))
    .map((v) => ({ ...v, suggestedDate: suggestedVisitDate(v.days) }));
}

/** Squares worth looking up: the same "likely visit" bar as countries. */
export const isLikelyClusterVisit = (cluster: PhotoCluster) => cluster.photos >= 3 || cluster.days.length >= 2;
