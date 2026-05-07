import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function ListDetailPage() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!listId) return;
    const fetchData = async () => {
      const { data: listData } = await supabase.from("lists").select("id, name, description, user_id").eq("id", listId).single();
      if (!listData) { setLoading(false); return; }
      setList(listData);

      const { data: profile } = await supabase.from("profiles").select("user_id, username, profile_picture").eq("user_id", listData.user_id).single();
      setOwner(profile);

      const { data: itemsData } = await supabase
        .from("list_items")
        .select("id, places!inner(id, name, country, type, image)")
        .eq("list_id", listId);

      setItems((itemsData || []).map((i: any) => ({
        id: i.id,
        place: i.places,
      })));

      // Fetch like count
      const { count } = await supabase.from("list_likes").select("*", { count: "exact", head: true }).eq("list_id", listId);
      setLikeCount(count || 0);

      // Check if current user liked
      if (profile && user) {
        const { data: myLike } = await supabase.from("list_likes").select("id").eq("list_id", listId).eq("user_id", user.id).maybeSingle();
        setLiked(!!myLike);
      }

      setLoading(false);
    };
    fetchData();
  }, [listId, user]);

  const toggleLike = async () => {
    if (!user || !listId || toggling) return;
    setToggling(true);
    if (liked) {
      await supabase.from("list_likes").delete().eq("list_id", listId).eq("user_id", user.id);
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from("list_likes").insert({ list_id: listId, user_id: user.id });
      setLiked(true);
      setLikeCount(c => c + 1);
    }
    setToggling(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-12 px-5 max-w-lg mx-auto">
        <div className="space-y-3">
          <div className="h-7 w-48 bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-background pt-12 px-5">
        <button onClick={() => navigate(-1)} className="mb-4"><ChevronLeft className="w-6 h-6 text-foreground" /></button>
        <p className="text-sm text-muted-foreground text-center">List not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground flex-1" data-no-translate>{list.name}</h1>
          {user && (
            <button onClick={toggleLike} className="flex items-center gap-1.5 active:scale-95 transition-transform">
              <Heart className={`w-5 h-5 transition-colors ${liked ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
              {likeCount > 0 && <span className="text-sm text-muted-foreground">{likeCount}</span>}
            </button>
          )}
        </div>

        {owner && (
          <button onClick={() => navigate(`/profile/${owner.user_id}`)} className="flex items-center gap-2 mb-4">
            <Avatar className="w-7 h-7">
              <AvatarImage src={owner.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.username)}&background=3B82F6&color=fff`} />
              <AvatarFallback>{owner.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{owner.username}</span>
          </button>
        )}

        {list.description && <p className="text-sm text-muted-foreground mb-5">{list.description}</p>}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No destinations in this list</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => navigate(`/place/${item.place.id}`)}
                className="aspect-[3/4] w-full"
              >
                <DestinationPoster
                  placeId={item.place.id}
                  name={item.place.name}
                  country={item.place.country}
                  type={item.place.type as "city" | "country"}
                  image={item.place.image}
                  className="w-full h-full"
                />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
