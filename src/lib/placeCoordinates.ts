import { useEffect, useMemo, useState } from "react";
import { getCityCoordinates, getCountryCoordinates } from "@/lib/cityCoordinates";
import { getCountryCode } from "@/lib/countryFlags";
import { createPersistentCache } from "@/lib/persistentCache";
import { PlaceGeocoder, canGeocodePlaces } from "@/lib/native/placeGeocoder";

type Coords = [number, number];
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Where each city is, as found by the phone's geocoder. Cities don't move,
// so answers are kept for a year; "not found" is kept too, so a name the
// geocoder doesn't know isn't asked about on every visit.
const cityCache = createPersistentCache<Coords | "none">("city_coordinates", { maxEntries: 3000, ttlMs: YEAR_MS });

const keyOf = (name: string, country: string) => `${name}|${country}`;

/**
 * The best known position for a place right now: a country's centre; for a
 * city, where the geocoder found it, else the built-in list of big cities
 * (matched by name only), else its country's centre.
 */
export function placeCoordinates(name: string, country: string, type: string): Coords | null {
  if (type !== "city") return getCountryCoordinates(name) || getCountryCoordinates(country) || getCityCoordinates(name);
  const cached = cityCache.get(keyOf(name, country));
  if (cached && cached !== "none") return cached;
  return getCityCoordinates(name) || getCountryCoordinates(country) || null;
}

/**
 * Where a city is, without guessing: where the geocoder found it, else the
 * built-in list of big cities; null when not known yet (unlike
 * placeCoordinates, never its country's centre).
 */
export function cityPosition(name: string, country: string): Coords | null {
  const cached = cityCache.get(keyOf(name, country));
  if (cached && cached !== "none") return cached;
  if (cached === "none") return null;
  return getCityCoordinates(name) || null;
}

const listeners = new Set<() => void>();
const queued = new Set<string>();
const queue: { name: string; country: string }[] = [];
let running = false;

async function drain() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const { name, country } = queue.shift()!;
    const key = keyOf(name, country);
    try {
      const result = await PlaceGeocoder.geocode({
        query: `${name}, ${country}`,
        countryCode: getCountryCode(country) ?? undefined,
      });
      if (result.found && result.lat != null && result.lng != null) {
        cityCache.set(key, [result.lat, result.lng]);
        listeners.forEach((notify) => notify());
      } else if (!result.retry) {
        cityCache.set(key, "none");
      }
    } catch {
      // Leave it uncached: tried again on a later visit.
    }
    queued.delete(key);
  }
  running = false;
}

/** Ask the phone where these cities are (once each), one at a time. */
function locateCities(cities: { name: string; country: string }[]) {
  if (!canGeocodePlaces()) return;
  for (const city of cities) {
    const key = keyOf(city.name, city.country);
    if (queued.has(key) || cityCache.get(key) !== undefined) continue;
    queued.add(key);
    queue.push(city);
  }
  void drain();
}

/**
 * Gives `items` with their best known position, and looks up the cities not
 * yet located; when an answer arrives the component re-renders and the pin
 * moves onto the city. Items with no position at all are left out.
 */
export function useAccuratePositions<T extends { place_name: string; place_country: string; place_type: string }>(
  items: T[]
): (T & { lat: number; lng: number })[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const notify = () => setVersion((v) => v + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    locateCities(
      items
        .filter((item) => item.place_type === "city")
        .map((item) => ({ name: item.place_name, country: item.place_country }))
    );
  }, [items]);

  // A stable array between answers, so the map doesn't redo its pins on
  // every render.
  return useMemo(
    () =>
      items.flatMap((item) => {
        const coords = placeCoordinates(item.place_name, item.place_country, item.place_type);
        return coords ? [{ ...item, lat: coords[0], lng: coords[1] }] : [];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, version]
  );
}

/**
 * The same for city pins on the profile map: each city at its best known
 * position (cities not located yet are left out until they are), looking up
 * the ones not asked about yet.
 */
export function useCityPositions<T extends { name: string; country: string }>(
  cities: T[]
): (T & { coords: Coords })[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const notify = () => setVersion((v) => v + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    locateCities(cities.map((city) => ({ name: city.name, country: city.country })));
  }, [cities]);

  return useMemo(
    () =>
      cities.flatMap((city) => {
        const coords = cityPosition(city.name, city.country);
        return coords ? [{ ...city, coords }] : [];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, version]
  );
}
