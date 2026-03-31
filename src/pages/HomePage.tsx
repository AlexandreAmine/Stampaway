import { useState, useEffect, useRef, useCallback } from "react";
import { Star, UserPlus, Bell } from "lucide-react";
import { getFlagEmoji } from "@/lib/countryFlags";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlaceCoordinates } from "@/lib/cityCoordinates";
import { countryLabels, cityLabels } from "@/lib/globeLabels";
import { GlobeActivityPopup } from "@/components/GlobeActivityPopup";
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
  visit_month: number | null;
  visit_year: number | null;
  duration_days: number | null;
  review_text: string | null;
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
  const [selectedActivity, setSelectedActivity] = useState<FriendActivity | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      setGlobeWidth(Math.min(containerRef.current.offsetWidth, 500));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];
      setHasFollowing(followingIds.length > 0);
      if (followingIds.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const now = new Date();
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const minYear = twoMonthsAgo.getFullYear();
      const minMonth = twoMonthsAgo.getMonth() + 1;

      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, user_id, place_id, rating, created_at, visit_year, visit_month, duration_days, review_text, places!inner(name, country, type)")
        .in("user_id", followingIds)
        .not("visit_year", "is", null)
        .not("visit_month", "is", null)
        .order("created_at", { ascending: false });

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
          visit_month: r.visit_month,
          visit_year: r.visit_year,
          duration_days: r.duration_days,
          review_text: r.review_text,
        });
      });

      setActivities(mapped);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableZoom = true;
      globeRef.current.pointOfView({ altitude: 2.2 });

      controls.addEventListener("start", () => {
        controls.autoRotate = false;
      });
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

  const handlePinClick = useCallback((a: FriendActivity) => {
    if (selectedActivity?.id === a.id) {
      // Second click → navigate
      navigate(`/place/${a.place_id}`);
      return;
    }
    // First click → zoom + show popup
    setSelectedActivity(a);
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: a.lat, lng: a.lng, altitude: 1.2 }, 800);
      const controls = globeRef.current.controls();
      controls.autoRotate = false;
    }
  }, [selectedActivity, navigate]);

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
        ` : ``}
      </div>
    `;
    let isDrag = false;
    el.addEventListener("mousedown", () => { isDrag = false; });
    el.addEventListener("mousemove", () => { isDrag = true; });
    el.addEventListener("mouseup", (e) => {
      if (!isDrag) {
        e.stopPropagation();
        handlePinClick(a);
      }
    });
    el.addEventListener("touchstart", () => { isDrag = false; }, { passive: true });
    el.addEventListener("touchmove", () => { isDrag = true; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (!isDrag) {
        e.stopPropagation();
        handlePinClick(a);
      }
    });
    return el;
  }, [handlePinClick]);

  // Globe label click handler
  const handleLabelClick = useCallback((label: object) => {
    const l = label as { text: string; type: string };
    // Search for a place matching this label
    (async () => {
      const { data } = await supabase
        .from("places")
        .select("id")
        .eq("name", l.text)
        .eq("type", l.type === "country" ? "country" : "city")
        .limit(1)
        .maybeSingle();
      if (data) {
        navigate(`/place/${data.id}`);
      }
    })();
  }, [navigate]);

  const allLabels = [...countryLabels, ...cityLabels];

  const dayTexture = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
  const bumpTexture = "//unpkg.com/three-globe/example/img/earth-topology.png";

  const globeHeight = Math.round(globeWidth * 1.1);

  return (
    <div className="min-h-screen bg-background pb-24 relative">
      {/* Globe section - fixed behind content */}
      <div className="sticky top-0 z-0">
        {/* Header */}
        <div className="pt-12 pb-2 px-5 text-center relative z-10">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Travel'D</h1>
        </div>

        <div ref={containerRef} className="relative mx-auto flex items-center justify-center overflow-hidden" style={{ height: globeHeight }}>
          {/* Stars */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: `${Math.random() * 2 + 1}px`,
                  height: `${Math.random() * 2 + 1}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.7 + 0.2,
                  animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                }}
              />
            ))}
          </div>
          {loading ? (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Globe
              ref={globeRef}
              width={globeWidth}
              height={globeHeight}
              globeImageUrl={dayTexture}
              bumpImageUrl={bumpTexture}
              backgroundImageUrl=""
              backgroundColor="rgba(0,0,0,0)"
              htmlElementsData={activities}
              htmlElement={markerHtml}
              htmlAltitude={0.05}
              atmosphereColor="hsl(217, 91%, 60%)"
              atmosphereAltitude={0.15}
              labelsData={allLabels}
              labelText="text"
              labelSize={(d: any) => d.size || 0.5}
              labelColor={() => "rgba(255, 255, 255, 0.75)"}
              labelResolution={2}
              labelAltitude={0.01}
              labelDotRadius={0}
              onLabelClick={handleLabelClick}
            />
          )}

          {/* Activity popup overlay */}
          <GlobeActivityPopup
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
            onNavigate={() => {
              if (selectedActivity) navigate(`/place/${selectedActivity.place_id}`);
            }}
          />
        </div>
      </div>

      {/* Bottom sheet style activity list */}
      <div className="relative z-10 -mt-6">
        <div className="bg-background rounded-t-3xl pt-3 px-5 min-h-[50vh]">
          {/* Drag handle */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-4">Friends activities</h2>

          {!hasFollowing && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm text-muted-foreground text-center">Follow friends to see their travel activities here!</p>
              <button
                onClick={() => navigate("/search")}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Find friends
              </button>
            </div>
          ) : activities.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No recent activity from friends yet.</p>
          ) : null}

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
                    {getFlagEmoji(a.place_country) && (
                      <span className="text-sm shrink-0">{getFlagEmoji(a.place_country)}</span>
                    )}
                    <span className="text-sm font-bold text-foreground truncate">{a.place_name}</span>
                    {a.rating != null && (
                      <>
                        <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">{a.rating}</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
