import { useState, useEffect } from "react";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Section = "visitors" | "reviews" | "lists";

export default function PlaceSubPage() {
  const { id, section } = useParams<{ id: string; section: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [placeName, setPlaceName] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && section) fetchData();
  }, [id, section]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const { data: place } = await supabase.from("places").select("name").eq("id", id).maybeSingle();
    setPlaceName(place?.name || "");

    if (section === "visitors") {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, rating, user_id, review_text, liked, created_at")
        .eq("place_id", id)
        .order("created_at", { ascending: false });

      // Most recent per user
      const seen = new Set<string>();
      const unique = (reviews || []).filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });

      const userIds = unique.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);

      setData(
        unique.map((r) => {
          const p = (profiles || []).find((pr: any) => pr.user_id === r.user_id);
          return { ...r, profile: p, has_review: !!(r.review_text && r.review_text.trim() !== "") };
        })
      );
    } else if (section === "reviews") {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, rating, user_id, review_text, liked, created_at")
        .eq("place_id", id)
        .not("review_text", "is", null)
        .neq("review_text", "")
        .order("created_at", { ascending: false });

      // Most recent written review per user
      const seen = new Set<string>();
      const unique = (reviews || []).filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });

      const userIds = unique.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", userIds);

      setData(
        unique.map((r) => {
          const p = (profiles || []).find((pr: any) => pr.user_id === r.user_id);
          return { ...r, profile: p };
        })
      );
    } else if (section === "lists") {
      const { data: listItems } = await supabase
        .from("list_items")
        .select("list_id, lists!inner(id, name, user_id)")
        .eq("place_id", id);

      if (listItems && listItems.length > 0) {
        const listUserIds = [...new Set((listItems as any[]).map((li: any) => li.lists.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, profile_picture").in("user_id", listUserIds);
        setData(
          (listItems as any[]).map((li: any) => {
            const p = (profiles || []).find((pr: any) => pr.user_id === li.lists.user_id);
            return { list_id: li.lists.id, list_name: li.lists.name, profile: p };
          })
        );
      }
    }

    setLoading(false);
  };

  const title = section === "visitors" ? "Visitors" : section === "reviews" ? "Reviews" : "Lists";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground">{placeName}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No {title.toLowerCase()} yet</p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {section === "visitors" &&
              data.map((v: any) => (
                <div key={v.user_id} className="flex items-center gap-3 w-full">
                  <button onClick={() => navigate(v.user_id === user?.id ? "/profile" : `/profile/${v.user_id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={v.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.profile?.username || "?")}&background=3B82F6&color=fff`} />
                      <AvatarFallback>{v.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-foreground flex-1">{v.profile?.username || "User"}</p>
                  </button>
                  {v.rating != null ? (
                    <button onClick={() => navigate(`/review/${v.id}`)} className="flex items-center gap-1.5 active:scale-95 transition-transform">
                      <StarRating rating={Number(v.rating)} size={12} liked={v.liked} />
                      {v.has_review && <MessageSquare className="w-3 h-3 text-primary" />}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">logged</span>
                  )}
                </div>
              ))}

            {section === "reviews" &&
              data.map((rv: any) => (
                <button key={rv.id} onClick={() => navigate(`/review/${rv.id}`)} className="bg-card rounded-xl p-3 border border-border w-full text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={rv.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(rv.profile?.username || "?")}&background=3B82F6&color=fff`} />
                      <AvatarFallback>{rv.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-foreground flex-1">{rv.profile?.username || "User"}</p>
                    <StarRating rating={rv.rating} size={11} liked={rv.liked} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{rv.review_text}</p>
                </button>
              ))}

            {section === "lists" &&
              data.map((l: any, i: number) => (
                <button key={i} onClick={() => navigate(l.profile?.user_id === user?.id ? "/profile" : `/profile/${l.profile?.user_id}`)} className="flex items-center gap-3 w-full text-left">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={l.profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.profile?.username || "?")}&background=3B82F6&color=fff`} />
                    <AvatarFallback>{l.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{l.list_name}</p>
                    <p className="text-xs text-muted-foreground">by {l.profile?.username || "User"}</p>
                  </div>
                </button>
              ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
