import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import { loadMapboxGl } from "@/lib/mapboxLoader";
import { supabase } from "@/integrations/supabase/client";

type MapboxModule = typeof mapboxgl;

// Set once the dynamic module is loaded; the pins effect only runs after
// mapReady, which is only set after loading, so this is always present there.
let loadedMapbox: MapboxModule | null = null;

export interface MapPin {
  id: string;
  user_id: string;
  username: string;
  profile_picture: string | null;
  place_id: string;
  place_name: string;
  place_country: string;
  place_type: string;
  rating: number | null;
  created_at: string;
  lat: number;
  lng: number;
  visit_month: number | null;
  visit_year: number | null;
  duration_days: number | null;
  review_text: string | null;
}

interface Props {
  pins: MapPin[];
  loading: boolean;
  width: number;
  height: number;
  onPinClick: (pin: MapPin) => void;
  onLabelClick: (text: string, type: "city" | "country") => void;
  selectedPinId: string | null;
}

const TOKEN_STORAGE_KEY = "mapbox_public_token_v1";
let cachedToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
let tokenPromise: Promise<string | null> | null = null;

function fetchTokenFromServer(): Promise<string | null> {
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-mapbox-token");
      if (error || !data?.token) {
        console.error("Failed to load mapbox token", error);
        return null;
      }
      cachedToken = data.token;
      try { window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token); } catch {}
      return cachedToken;
    } catch (e) {
      console.error("Mapbox token fetch error", e);
      return null;
    }
  })();
  return tokenPromise;
}

// Kick off token fetch as soon as this module is imported, so by the time
// the component mounts the token is usually already in memory.
if (typeof window !== "undefined" && !cachedToken) {
  fetchTokenFromServer();
}

async function getMapboxToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  return fetchTokenFromServer();
}

// ---------------------------------------------------------------------------
// Persistent map instance (Checkpoint 6, step 2).
//
// Creating a Mapbox map costs a full style parse + satellite tile fetches —
// the visible "map reloading" moment every time the user returned to Home.
// Instead of destroying the map on unmount, one instance lives in a detached
// host element and is re-attached on the next mount. To keep the user-visible
// behavior IDENTICAL to a fresh mount, `attach()` resets the camera to the
// default view and re-enables the auto-spin — only the expensive init work
// (style, tiles, WebGL setup) is skipped.
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [10, 25];
const DEFAULT_ZOOM = 0.8;

type PersistentGlobe = {
  map: mapboxgl.Map;
  attach: (container: HTMLDivElement) => void;
  detach: () => void;
  setLabelClickHandler: (fn: ((text: string, type: "city" | "country") => void) | null) => void;
};

let persistentGlobe: PersistentGlobe | null = null;

function createPersistentGlobe(mapboxgl: MapboxModule): PersistentGlobe {
  const hostEl = document.createElement("div");
  hostEl.style.position = "absolute";
  hostEl.style.inset = "0";

  const map = new mapboxgl.Map({
    container: hostEl,
    style: "mapbox://styles/mapbox/satellite-streets-v12",
    projection: "globe" as any,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    attributionControl: false,
    logoPosition: "bottom-left",
    renderWorldCopies: false,
  });

  let labelClickHandler: ((text: string, type: "city" | "country") => void) | null = null;
  let detached = false;

  // Auto-rotate the globe until the user interacts (any zoom/drag stops it
  // for the current Home visit; it restarts on the next visit, exactly like
  // the previous fresh-mount behavior).
  const SECONDS_PER_REV = 180;
  let userInteracted = false;
  let spinPaused = false;

  const spinGlobe = () => {
    if (detached || userInteracted || spinPaused) return;
    const distancePerSecond = 360 / SECONDS_PER_REV;
    const center = map.getCenter();
    center.lng -= distancePerSecond;
    map.easeTo({ center, duration: 1000, easing: (n) => n });
  };

  const stopSpin = () => { userInteracted = true; };
  map.on("mousedown", stopSpin);
  map.on("touchstart", stopSpin);
  map.on("dragstart", stopSpin);
  map.on("zoomstart", stopSpin);
  map.on("wheel", stopSpin);
  map.on("moveend", () => { spinGlobe(); });

  // Performance (step 1): pause the spin while the activity list scrolls over
  // the map or while the app/tab is hidden. The WebGL camera animation would
  // otherwise compete with scrolling for GPU time (scroll jank) and keep
  // rendering in the background (battery). Visually nothing changes — the
  // globe spins exactly as before whenever it is visible and idle.
  const pauseSpin = () => {
    if (spinPaused) return;
    spinPaused = true;
    // Halt the in-flight ease so repainting stops immediately
    try { map.stop(); } catch { /* map may be mid-teardown */ }
  };
  const resumeSpin = () => {
    if (!spinPaused) return;
    spinPaused = false;
    spinGlobe();
  };

  // Only treat the map as hidden when it is scrolled COMPLETELY off-screen.
  // (An earlier half-covered threshold interacted badly with restored scroll
  // positions: returning to Home with a mid-page scroll left a visible globe
  // frozen because no scroll event ever fired to resume it.)
  const isFullyHidden = () => {
    const h = hostEl.getBoundingClientRect().height || 0;
    return window.scrollY > h;
  };

  let scrollSettleTimer: number | null = null;
  const onScroll = () => {
    if (detached) return;
    pauseSpin();
    if (scrollSettleTimer !== null) window.clearTimeout(scrollSettleTimer);
    scrollSettleTimer = window.setTimeout(() => {
      scrollSettleTimer = null;
      if (!detached && !document.hidden && !isFullyHidden()) resumeSpin();
    }, 250);
  };

  const onVisibilityChange = () => {
    if (detached) return;
    if (document.hidden) pauseSpin();
    else if (!isFullyHidden()) resumeSpin();
  };

  // The instance lives for the app session, so these are registered once and
  // never removed (they no-op while detached).
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);

  map.on("style.load", () => {
    // Black deep-space background around the globe
    map.setFog({
      color: "rgb(0, 0, 0)",
      "high-color": "rgb(0, 0, 0)",
      "horizon-blend": 0.02,
      "space-color": "rgb(0, 0, 0)",
      "star-intensity": 0.9,
    } as any);

    // Brighten the ocean (water layer) to a more vivid blue
    try {
      if (map.getLayer("water")) {
        map.setPaintProperty("water", "fill-color", "#7ec5ee");
      }
    } catch {}
    spinGlobe();
  });

  // Layers in the satellite-streets style that carry place labels we can click
  const LABEL_LAYERS = [
    "settlement-major-label",
    "settlement-minor-label",
    "settlement-subdivision-label",
    "country-label",
    "state-label",
    "place-city-lg-n",
    "place-city-md-n",
    "place-city-sm",
    "place-town",
    "place-village",
  ];

  // Click on city/country labels rendered by Mapbox (reads the current
  // mount's handler through the holder, so closures never go stale)
  map.on("click", (e) => {
    if (!labelClickHandler) return;
    const available = LABEL_LAYERS.filter((id) => map.getLayer(id));
    const features = map.queryRenderedFeatures(e.point, { layers: available });
    if (features && features.length > 0) {
      const f = features[0];
      const name = (f.properties?.name_en as string) || (f.properties?.name as string);
      if (!name) return;
      const isCountry = f.layer.id.includes("country");
      labelClickHandler(name, isCountry ? "country" : "city");
    }
  });

  // Cursor feedback on labels
  const setHoverCursor = () => (map.getCanvas().style.cursor = "pointer");
  const resetCursor = () => (map.getCanvas().style.cursor = "");
  map.on("idle", () => {
    LABEL_LAYERS.forEach((id) => {
      if (!map.getLayer(id)) return;
      map.off("mouseenter", id, setHoverCursor);
      map.off("mouseleave", id, resetCursor);
      map.on("mouseenter", id, setHoverCursor);
      map.on("mouseleave", id, resetCursor);
    });
  });

  const attach = (container: HTMLDivElement) => {
    container.appendChild(hostEl);
    detached = false;
    // Replicate fresh-mount behavior: default view, spin re-enabled
    userInteracted = false;
    spinPaused = false;
    try {
      map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      map.resize();
    } catch { /* map may be mid-teardown */ }
    if (document.hidden || isFullyHidden()) {
      spinPaused = true;
    } else {
      spinGlobe();
    }
  };

  const detach = () => {
    detached = true;
    if (scrollSettleTimer !== null) {
      window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = null;
    }
    // Stop all rendering while off-screen
    try { map.stop(); } catch { /* map may be mid-teardown */ }
    hostEl.remove();
  };

  return {
    map,
    attach,
    detach,
    setLabelClickHandler: (fn) => { labelClickHandler = fn; },
  };
}

export function MapboxFriendsMap({
  pins,
  loading,
  width,
  height,
  onPinClick,
  onLabelClick,
  selectedPinId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  const onLabelClickRef = useRef(onLabelClick);
  onLabelClickRef.current = onLabelClick;

  // Attach the persistent map (creating it on the first Home visit only)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    (async () => {
      if (!persistentGlobe) {
        // Token fetch and the ~1.75 MB mapbox-gl chunk load in parallel;
        // the chunk is usually already warm from the idle preload.
        const [token, mapboxgl] = await Promise.all([getMapboxToken(), loadMapboxGl()]);
        if (cancelled) return;
        if (!token) {
          setTokenMissing(true);
          return;
        }
        loadedMapbox = mapboxgl;
        mapboxgl.accessToken = token;
        persistentGlobe = createPersistentGlobe(mapboxgl);
      }
      if (cancelled) return;

      persistentGlobe.setLabelClickHandler((text, type) => onLabelClickRef.current(text, type));
      persistentGlobe.attach(container);
      mapRef.current = persistentGlobe.map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      if (persistentGlobe) {
        persistentGlobe.setLabelClickHandler(null);
        persistentGlobe.detach();
      }
      mapRef.current = null;
    };
  }, []);

  // Resize when container size changes
  useEffect(() => {
    if (mapRef.current) mapRef.current.resize();
  }, [width, height]);

  // Render pins
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const mapboxgl = loadedMapbox;
    if (!mapboxgl) return;
    const map = mapRef.current;
    const seen = new Set<string>();

    pins.forEach((pin) => {
      seen.add(pin.id);
      let marker = markersRef.current.get(pin.id);
      if (marker) return;

      const el = document.createElement("div");
      el.style.cursor = "pointer";
      const avatar =
        pin.profile_picture ||
        fallbackAvatarUrl(pin.username);
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:3px;background:white;border-radius:20px;padding:3px 8px 3px 3px;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;">
          <img src="${avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />
          ${
            pin.rating != null
              ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                 <span style="font-size:12px;font-weight:700;color:#111;">${pin.rating}</span>`
              : ``
          }
        </div>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onPinClick(pin);
      });

      marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      markersRef.current.set(pin.id, marker);
    });

    // Remove stale markers
    markersRef.current.forEach((m, id) => {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    });
  }, [pins, mapReady, onPinClick]);

  // Fly to selected pin
  useEffect(() => {
    if (!mapRef.current || !selectedPinId) return;
    const pin = pins.find((p) => p.id === selectedPinId);
    if (!pin) return;
    mapRef.current.flyTo({
      center: [pin.lng, pin.lat],
      zoom: 5,
      speed: 1.2,
      curve: 1.4,
      essential: true,
    });
  }, [selectedPinId, pins]);

  if (tokenMissing) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-xs text-muted-foreground px-6 text-center"
      >
        Map unavailable. Please configure MAPBOX_PUBLIC_TOKEN.
      </div>
    );
  }

  return (
    <div className="relative mapbox-friends" style={{ width, height }}>
      <div ref={containerRef} className="absolute inset-0" />
      <style>{`
        .mapbox-friends .mapboxgl-ctrl-attrib {
          background: rgba(0,0,0,0.35) !important;
          color: rgba(255,255,255,0.55) !important;
          font-size: 9px !important;
          padding: 1px 5px !important;
          border-radius: 6px !important;
          margin: 0 4px 4px 0 !important;
        }
        .mapbox-friends .mapboxgl-ctrl-attrib a { color: rgba(255,255,255,0.7) !important; }
        .mapbox-friends .mapboxgl-ctrl-logo {
          transform: scale(0.7);
          transform-origin: bottom left;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
