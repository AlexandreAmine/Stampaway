import { useState, useEffect, useRef, useCallback } from "react";
import { Star, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlaceCoordinates } from "@/lib/cityCoordinates";
import Globe from "react-globe.gl";

interface FriendActivity {
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
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFollowing, setHasFollowing] = useState(true);
  const [globeWidth, setGlobeWidth] = useState(380);

  useEffect(() => {
    if (containerRef.current) {
      setGlobeWidth(Math.min(containerRef.current.offsetWidth, 500));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      // Get who the user follows
      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];
      if (followingIds.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      // Calculate 2 months ago based on visit date
      const now = new Date();
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const minYear = twoMonthsAgo.getFullYear();
      const minMonth = twoMonthsAgo.getMonth() + 1; // 1-indexed

      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, user_id, place_id, rating, created_at, visit_year, visit_month, places!inner(name, country, type)")
        .in("user_id", followingIds)
        .not("visit_year", "is", null)
        .not("visit_month", "is", null)
        .order("created_at", { ascending: false });

      // Filter client-side for visit dates within last 2 months
      const filtered = (reviews || []).filter((r: any) => {
        const vy = r.visit_year;
        const vm = r.visit_month;
        return (vy > minYear) || (vy === minYear && vm >= minMonth);
      });

      if (filtered.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      // Get profiles for these users
      const userIds = [...new Set(filtered.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, profile_picture")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const mapped: FriendActivity[] = [];
      filtered.forEach((r: any) => {
        const coords = getPlaceCoordinates(r.places.name, r.places.country);
        if (!coords) return;
        const prof = profileMap.get(r.user_id);
        mapped.push({
          id: r.id,
          user_id: r.user_id,
          username: prof?.username || "User",
          profile_picture: prof?.profile_picture || null,
          place_id: r.place_id,
          place_name: r.places.name,
          place_country: r.places.country,
          place_type: r.places.type,
          rating: r.rating != null ? Number(r.rating) : null,
          created_at: r.created_at,
          lat: coords[0],
          lng: coords[1],
        });
      });

      setActivities(mapped);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.4;
      globeRef.current.controls().enableZoom = false;
      globeRef.current.pointOfView({ altitude: 2.2 });
    }
  }, [loading]);

  const getAvatarUrl = (a: FriendActivity) =>
    a.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.username)}&background=3B82F6&color=fff&size=40`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  // Custom HTML marker for globe pins
  const markerHtml = useCallback((d: object) => {
    const a = d as FriendActivity;
    const avatar = getAvatarUrl(a);
    const el = document.createElement("div");
    el.style.cursor = "pointer";
    el.style.pointerEvents = "auto";
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:3px;background:white;border-radius:20px;padding:3px 8px 3px 3px;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;pointer-events:auto;">
        <img src="${avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />
        ${a.rating != null ? `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="hsl(217,91%,60%)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span style="font-size:12px;font-weight:700;color:#111;">${a.rating}</span>
        ` : `<span style="font-size:11px;color:#666;">logged</span>`}
      </div>
    `;
    // Use mousedown to beat orbit controls which use mouseup
    let isDrag = false;
    el.addEventListener("mousedown", () => { isDrag = false; });
    el.addEventListener("mousemove", () => { isDrag = true; });
    el.addEventListener("mouseup", (e) => {
      if (!isDrag) {
        e.stopPropagation();
        navigate(`/place/${a.place_id}`);
      }
    });
    el.addEventListener("touchend", (e) => {
      e.stopPropagation();
      navigate(`/place/${a.place_id}`);
    });
    return el;
  }, [navigate]);

  const nightTexture = "//unpkg.com/three-globe/example/img/earth-night.jpg";
  const bumpTexture = "//unpkg.com/three-globe/example/img/earth-topology.png";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="pt-12 pb-2 px-5 text-center">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Travel'D</h1>
      </div>

      {/* Globe */}
      <div ref={containerRef} className="relative mx-auto flex items-center justify-center overflow-hidden" style={{ height: globeWidth }}>
        {loading ? (
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <Globe
            ref={globeRef}
            width={globeWidth}
            height={globeWidth}
            globeImageUrl={nightTexture}
            bumpImageUrl={bumpTexture}
            backgroundImageUrl=""
            backgroundColor="rgba(0,0,0,0)"
            htmlElementsData={activities}
            htmlElement={markerHtml}
            htmlAltitude={0.05}
            
            atmosphereColor="hsl(217, 91%, 60%)"
            atmosphereAltitude={0.15}
          />
        )}
      </div>

      {/* Friends activities */}
      <div className="px-5 mt-4">
        <h2 className="text-xl font-bold text-foreground mb-4">Recent friend activities</h2>
        {activities.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No recent activity from friends. Follow people to see their trips here!</p>
        )}
        <div className="space-y-1">
          {activities.map((a, i) => (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/place/${a.place_id}`)}
              className="flex items-center gap-3 py-2.5 w-full text-left"
            >
              <button
                onClick={(e) => { e.stopPropagation(); navigate(a.user_id === user?.id ? "/profile" : `/profile/${a.user_id}`); }}
                className="shrink-0"
              >
                <img
                  src={getAvatarUrl(a)}
                  alt={a.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-foreground">{a.username}</span>
                  <span className="text-xs text-muted-foreground">• {formatDate(a.created_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate">{a.place_name}</span>
                  {a.rating != null ? (
                    <>
                      <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">{a.rating}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">logged</span>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
