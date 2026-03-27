import { useState, useEffect } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const filterTabs = ["Destinations", "Lists", "Users"] as const;
type FilterTab = (typeof filterTabs)[number];

export default function SearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("Destinations");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    supabase.from("followers").select("following_id").eq("follower_id", user.id).then(({ data }) => {
      setFollowingIds(new Set((data || []).map((f) => f.following_id)));
    });
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => search(), 250);
    return () => clearTimeout(t);
  }, [query, activeFilter]);

  useEffect(() => { search(); }, [activeFilter]);

  const search = async () => {
    setLoading(true);
    const q = query.trim();

    if (activeFilter === "Destinations") {
      const { data: counts } = await supabase.rpc("get_place_review_counts");
      const countMap = new Map((counts || []).map((c: any) => [c.place_id, Number(c.review_count)]));

      let qb = supabase.from("places").select("id, name, country, type, image");
      if (q) qb = qb.ilike("name", `%${q}%`);
      qb = qb.limit(200);
      const { data } = await qb;
      const sorted = (data || []).sort((a, b) => {
        const diff = (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }).slice(0, 30);
      setPlaces(sorted);

      // Save clicked destinations to recent searches
      if (q && sorted.length > 0) {
        // We'll save when user clicks, not on search
      }
    } else if (activeFilter === "Lists") {
      let qb = supabase.from("lists").select("id, name, description, user_id");
      if (q) qb = qb.ilike("name", `%${q}%`);
      qb = qb.order("created_at", { ascending: false }).limit(30);
      const { data } = await qb;
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((l: any) => l.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setLists(data.map((l: any) => ({ ...l, profiles: profileMap.get(l.user_id) || null })));
      } else {
        setLists([]);
      }
    } else if (activeFilter === "Users") {
      let qb = supabase.from("profiles").select("id, user_id, username, profile_picture");
      if (q) qb = qb.ilike("username", `%${q}%`);
      qb = qb.order("username").limit(30);
      const { data } = await qb;
      setUsers(data || []);
    } else if (activeFilter === "Reviews") {
      let qb = supabase.from("reviews").select("id, rating, review_text, liked, created_at, place_id, user_id, places!inner(name, country, type, image)");
      if (q) qb = qb.ilike("places.name", `%${q}%`);
      qb = qb.order("created_at", { ascending: false }).limit(30);
      const { data } = await qb;
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r: any) => r.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setReviews(data.map((r: any) => ({ ...r, profiles: profileMap.get(r.user_id) || null })));
      } else {
        setReviews([]);
      }
    }
    setLoading(false);
  };

  const renderResults = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (activeFilter === "Destinations") {
      if (!places.length) return <EmptyState text="No destinations found" />;
      return (
        <div className="grid grid-cols-3 gap-3">
          {places.map((p) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => {
                // Save to recent searches
                try {
                  const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]");
                  const filtered = saved.filter((s: any) => s.id !== p.id);
                  const updated = [{ id: p.id, name: p.name, country: p.country, type: p.type, image: p.image }, ...filtered].slice(0, 15);
                  localStorage.setItem("recentSearches", JSON.stringify(updated));
                } catch { /* ignore */ }
                navigate(`/place/${p.id}`);
              }}
              className="aspect-[3/4] w-full"
            >
              <DestinationPoster placeId={p.id} name={p.name} country={p.country} type={p.type as "city" | "country"} image={p.image} className="w-full h-full" />
            </motion.button>
          ))}
        </div>
      );
    }

    if (activeFilter === "Lists") {
      if (!lists.length) return <EmptyState text="No lists found" />;
      return (
        <div className="space-y-3">
          {lists.map((l: any) => (
            <motion.button key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate(`/list/${l.id}`)} className="w-full text-left bg-card rounded-xl p-4 border border-border">
              <p className="text-sm font-semibold text-foreground">{l.name}</p>
              {l.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
              {l.profiles && <p className="text-xs text-muted-foreground mt-2">by {(l.profiles as any).username}</p>}
            </motion.button>
          ))}
        </div>
      );
    }

    if (activeFilter === "Users") {
      if (!users.length) return <EmptyState text="No users found" />;
      return (
        <div className="space-y-3">
          {users.map((u: any) => {
            const isMe = u.user_id === user?.id;
            const isFollowing = followingIds.has(u.user_id);
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between py-3">
                <button onClick={() => navigate(isMe ? "/profile" : `/profile/${u.user_id}`)} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{u.username}</p>
                    
                  </div>
                </button>
                {!isMe && !isFollowing && (
                  <button
                    onClick={async () => {
                      if (!user) return;
                      const { error } = await supabase.from("followers").insert({ follower_id: user.id, following_id: u.user_id });
                      if (error) { toast.error("Failed to follow"); return; }
                      setFollowingIds((prev) => new Set([...prev, u.user_id]));
                      toast.success(`Following ${u.username}!`);
                    }}
                    className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium"
                  >
                    Follow
                  </button>
                )}
                {!isMe && isFollowing && (
                  <span className="text-xs text-muted-foreground px-3 py-1.5">Following</span>
                )}
              </motion.div>
            );
          })}
        </div>
      );
    }

    if (activeFilter === "Reviews") {
      if (!reviews.length) return <EmptyState text="No reviews found" />;
      return (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/place/${r.place_id}`)}
              className="w-full text-left bg-card rounded-xl p-4 border border-border"
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-foreground">{(r.places as any)?.name}</p>
                <span className="text-xs text-muted-foreground">⭐ {r.rating}</span>
              </div>
              {r.review_text && <p className="text-xs text-muted-foreground line-clamp-2">{r.review_text}</p>}
              {r.profiles && <p className="text-xs text-muted-foreground mt-2">by {(r.profiles as any)?.username}</p>}
            </motion.button>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Search</h1>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations, lists and users..."
            className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {renderResults()}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
