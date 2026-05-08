import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import a1 from "@/assets/avatars/a1.png";
import a2 from "@/assets/avatars/a2.png";
import a3 from "@/assets/avatars/a3.png";
import a4 from "@/assets/avatars/a4.png";
import a5 from "@/assets/avatars/a5.png";
import a6 from "@/assets/avatars/a6.png";
import a7 from "@/assets/avatars/a7.png";
import a8 from "@/assets/avatars/a8.png";

const TOKEN_STORAGE_KEY = "mapbox_public_token_v1";

async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (cached) return cached;
  try {
    const { data, error } = await supabase.functions.invoke("get-mapbox-token");
    if (error || !data?.token) return null;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    return data.token as string;
  } catch {
    return null;
  }
}

interface WelcomePin {
  lat: number;
  lng: number;
  name: string;
  rating: number;
  avatar: string;
}

// 12 pins spread across the world with ratings 2 → 5 in 0.5 steps
const PINS: WelcomePin[] = [
  { lat: 48.8566, lng: 2.3522, name: "Aria", rating: 5, avatar: a1 },        // Paris (was 4.5)
  { lat: 35.6762, lng: 139.6503, name: "Kenji", rating: 5, avatar: a3 },     // Tokyo
  { lat: -33.8688, lng: 151.2093, name: "Liam", rating: 4, avatar: a6 },     // Sydney
  { lat: 40.7128, lng: -74.006, name: "Maya", rating: 3.5, avatar: a2 },     // New York
  { lat: -22.9068, lng: -43.1729, name: "Lucas", rating: 5, avatar: a7 },    // Rio (was 4.5)
  { lat: 55.7558, lng: 37.6173, name: "Nina", rating: 3, avatar: a4 },       // Moscow
  { lat: 1.3521, lng: 103.8198, name: "Ravi", rating: 5, avatar: a5 },       // Singapore
  { lat: -1.2921, lng: 36.8219, name: "Zara", rating: 4, avatar: a2 },       // Nairobi
  { lat: 64.1466, lng: -21.9426, name: "Erik", rating: 2.5, avatar: a6 },    // Reykjavik
  { lat: 19.4326, lng: -99.1332, name: "Sofia", rating: 3.5, avatar: a8 },   // Mexico City
  { lat: 28.6139, lng: 77.209, name: "Ishaan", rating: 2, avatar: a3 },      // New Delhi
  { lat: 41.9028, lng: 12.4964, name: "Giulia", rating: 4.5, avatar: a8 },   // Rome
];

export function WelcomeGlobe({ width, height }: { width: number; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) { setTokenMissing(true); return; }
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        projection: "globe" as any,
        center: [10, 25],
        zoom: 0.8,
        attributionControl: false,
        logoPosition: "bottom-left",
        renderWorldCopies: false,
        interactive: false, // user cannot zoom, drag or click
      });

      const SECONDS_PER_REV = 180;
      const spin = () => {
        if (!mapRef.current) return;
        const center = map.getCenter();
        center.lng -= 360 / SECONDS_PER_REV;
        map.easeTo({ center, duration: 1000, easing: (n) => n });
      };
      map.on("moveend", spin);

      map.on("style.load", () => {
        map.setFog({
          color: "rgb(0, 0, 0)",
          "high-color": "rgb(0, 0, 0)",
          "horizon-blend": 0.02,
          "space-color": "rgb(0, 0, 0)",
          "star-intensity": 0.9,
        } as any);
        try {
          if (map.getLayer("water")) {
            map.setPaintProperty("water", "fill-color", "#7ec5ee");
          }
        } catch {}

        // Add pins
        PINS.forEach((p) => {
          const el = document.createElement("div");
          el.style.pointerEvents = "none";
          const avatar = p.avatar;
          el.innerHTML = `
            <div style="display:flex;align-items:center;gap:3px;background:white;border-radius:20px;padding:3px 8px 3px 3px;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;">
              <img src="${avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span style="font-size:12px;font-weight:700;color:#111;">${p.rating}</span>
            </div>`;
          new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([p.lng, p.lat])
            .addTo(map);
        });

        spin();
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) mapRef.current.resize();
  }, [width, height]);

  if (tokenMissing) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-xs text-muted-foreground">
        Map unavailable.
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      <div ref={containerRef} className="absolute inset-0" />
      <style>{`.mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo { display: none !important; }`}</style>
    </div>
  );
}
