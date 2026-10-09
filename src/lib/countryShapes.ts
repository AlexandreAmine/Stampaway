import { feature } from "topojson-client";
import type { FeatureCollection, Geometry, Position } from "geojson";
import { featureAlpha2 } from "@/lib/isoCountryCodes";

// Natural Earth 1:50m country outlines (world-atlas 2.0.2, bundled with the
// app like countries-110m.json). Detailed enough for small countries such as
// Monaco, Singapore or Malta, which the 110m file used by the maps leaves out.
const SHAPES_URL = "/countries-50m.json";

/**
 * One landmass (or island) of a country, with its own bounding box: a
 * country's overall box can span the globe (France with its overseas
 * regions), so per-polygon boxes are what keep lookups fast.
 */
export interface CountryPolygon {
  alpha2: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  /**
   * The polygon's edges (outer ring and holes) bucketed by latitude band,
   * each as x1,y1,x2,y2: a point only needs the edges of its own band.
   */
  bands: Float64Array[];
}

// Latitude band height for the edge index.
const BAND_DEG = 0.25;

function buildPolygon(alpha2: string, rings: Position[][]): CountryPolygon {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of rings[0]) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const bandCount = Math.max(1, Math.ceil((maxLat - minLat) / BAND_DEG) + 1);
  const buckets: number[][] = Array.from({ length: bandCount }, () => []);
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      if (y1 === y2) continue; // horizontal edges never cross a horizontal ray
      const from = Math.max(0, Math.floor((Math.min(y1, y2) - minLat) / BAND_DEG));
      const to = Math.min(bandCount - 1, Math.floor((Math.max(y1, y2) - minLat) / BAND_DEG));
      for (let b = from; b <= to; b++) buckets[b].push(x1, y1, x2, y2);
    }
  }
  return { alpha2, minLng, minLat, maxLng, maxLat, bands: buckets.map((edges) => Float64Array.from(edges)) };
}

let shapesPromise: Promise<CountryPolygon[]> | null = null;

function polygonsOf(geometry: Geometry | null): Position[][][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/** Loads and prepares the country outlines once per app session. */
export function loadCountryShapes(): Promise<CountryPolygon[]> {
  if (!shapesPromise) {
    shapesPromise = fetch(SHAPES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Country shapes failed to load (${res.status})`);
        return res.json();
      })
      .then((topology) => {
        const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry>;
        const polygons: CountryPolygon[] = [];
        for (const f of collection.features) {
          const alpha2 = featureAlpha2(f.id, (f.properties as { name?: string } | null)?.name);
          if (!alpha2) continue;
          for (const rings of polygonsOf(f.geometry)) polygons.push(buildPolygon(alpha2, rings));
        }
        return polygons;
      })
      .catch((error) => {
        shapesPromise = null;
        throw error;
      });
  }
  return shapesPromise;
}

/**
 * Even-odd ray casting (outer ring and holes alike) on plain longitude and
 * latitude, using only the edges in the point's latitude band. Natural Earth
 * splits shapes at the antimeridian, so no polygon wraps around it.
 */
function containsPoint(polygon: CountryPolygon, lng: number, lat: number): boolean {
  const edges = polygon.bands[Math.floor((lat - polygon.minLat) / BAND_DEG)];
  if (!edges) return false;
  let inside = false;
  for (let k = 0; k < edges.length; k += 4) {
    const x1 = edges[k], y1 = edges[k + 1], x2 = edges[k + 2], y2 = edges[k + 3];
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

// A point just outside every outline (a harbour, a beach, a small island the
// simplified coastline misses) takes the country up to ~10 km away.
const NEARBY_STEPS = [0.02, 0.05, 0.1];

// 1° grid → the polygons whose box overlaps that square, so a lookup only
// looks at the few outlines nearby instead of all ~1,300.
const gridKey = (lat: number, lng: number) => (Math.floor(lat) + 90) * 360 + (Math.floor(lng) + 180);

function buildGrid(polygons: CountryPolygon[]): Map<number, CountryPolygon[]> {
  const grid = new Map<number, CountryPolygon[]>();
  for (const p of polygons) {
    for (let lat = Math.floor(p.minLat); lat <= Math.floor(p.maxLat); lat++) {
      for (let lng = Math.floor(p.minLng); lng <= Math.floor(p.maxLng); lng++) {
        const key = gridKey(lat, lng);
        const list = grid.get(key);
        if (list) list.push(p);
        else grid.set(key, [p]);
      }
    }
  }
  return grid;
}

/** Returns a function giving the country (alpha-2) for a point, or null. */
export function makeCountryLocator(polygons: CountryPolygon[]): (lat: number, lng: number) => string | null {
  const cache = new Map<string, string | null>();
  const grid = buildGrid(polygons);
  const exact = (lat: number, lng: number) => {
    const nearby = grid.get(gridKey(lat, lng));
    if (!nearby) return null;
    for (const p of nearby) {
      if (lat < p.minLat || lat > p.maxLat || lng < p.minLng || lng > p.maxLng) continue;
      if (containsPoint(p, lng, lat)) return p.alpha2;
    }
    return null;
  };

  return (lat, lng) => {
    const key = `${lat},${lng}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    let found = exact(lat, lng);
    for (const step of NEARBY_STEPS) {
      if (found) break;
      for (const dLat of [-step, 0, step]) {
        for (const dLng of [-step, 0, step]) {
          if (found || (dLat === 0 && dLng === 0)) continue;
          found = exact(lat + dLat, lng + dLng);
        }
      }
    }
    cache.set(key, found);
    return found;
  };
}
