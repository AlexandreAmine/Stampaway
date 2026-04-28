import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";

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

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const token = await getMapboxToken();
      if (cancelled) return;
      if (!token) {
        setTokenMissing(true);
        return;
      }
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        projection: "globe" as any,
        center: [10, 25],
        zoom: 1,
        attributionControl: false,
        logoPosition: "bottom-left",
        renderWorldCopies: false,
      });

      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      // Auto-rotate the globe until the user interacts (any zoom/drag stops it permanently)
      const SECONDS_PER_REV = 180;
      let userInteracted = false;

      const spinGlobe = () => {
        if (!mapRef.current || userInteracted) return;
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

      // Pins are added immediately (see below). Spin starts after style loads.

      map.on("style.load", () => {
        // Starry deep-space background around the globe
        map.setFog({
          color: "rgb(10, 12, 22)",
          "high-color": "rgb(20, 30, 60)",
          "horizon-blend": 0.04,
          "space-color": "rgb(0, 0, 0)",
          "star-intensity": 0.85,
        } as any);
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

      // Click on city/country labels rendered by Mapbox
      map.on("click", (e) => {
        const available = LABEL_LAYERS.filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(e.point, { layers: available });
        if (features && features.length > 0) {
          const f = features[0];
          const name = (f.properties?.name_en as string) || (f.properties?.name as string);
          if (!name) return;
          const isCountry = f.layer.id.includes("country");
          onLabelClick(name, isCountry ? "country" : "city");
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

      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [onLabelClick]);

  // Resize when container size changes
  useEffect(() => {
    if (mapRef.current) mapRef.current.resize();
  }, [width, height]);

  // Render pins
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
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
        `https://ui-avatars.com/api/?name=${encodeURIComponent(pin.username)}&background=3B82F6&color=fff&size=40`;
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:3px;background:white;border-radius:20px;padding:3px 8px 3px 3px;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;">
          <img src="${avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />
          ${
            pin.rating != null
              ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="hsl(217,91%,60%)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
