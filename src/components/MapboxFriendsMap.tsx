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

let cachedToken: string | null = null;

async function getMapboxToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const { data, error } = await supabase.functions.invoke("get-mapbox-token");
    if (error || !data?.token) {
      console.error("Failed to load mapbox token", error);
      return null;
    }
    cachedToken = data.token;
    return cachedToken;
  } catch (e) {
    console.error("Mapbox token fetch error", e);
    return null;
  }
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
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe" as any,
        center: [10, 25],
        zoom: 1.4,
        attributionControl: false,
        logoPosition: "bottom-left",
      });

      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("style.load", () => {
        map.setFog({
          color: "rgb(10, 10, 15)",
          "high-color": "rgb(30, 50, 90)",
          "horizon-blend": 0.1,
          "space-color": "rgb(0, 0, 0)",
          "star-intensity": 0.6,
        } as any);
        setMapReady(true);
      });

      // Click on city/country labels rendered by Mapbox
      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["settlement-major-label", "settlement-minor-label", "country-label"],
        });
        if (features && features.length > 0) {
          const f = features[0];
          const name = (f.properties?.name_en as string) || (f.properties?.name as string);
          if (!name) return;
          const isCountry = f.layer.id === "country-label";
          onLabelClick(name, isCountry ? "country" : "city");
        }
      });

      // Cursor feedback on labels
      const setHoverCursor = () => (map.getCanvas().style.cursor = "pointer");
      const resetCursor = () => (map.getCanvas().style.cursor = "");
      ["settlement-major-label", "settlement-minor-label", "country-label"].forEach((id) => {
        map.on("mouseenter", id, setHoverCursor);
        map.on("mouseleave", id, resetCursor);
      });

      mapRef.current = map;
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
    <div className="relative" style={{ width, height }}>
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />
      {(loading || !mapReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm rounded-2xl">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
